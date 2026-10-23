import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openEditorBridge } from '../../src/bridge/availability.ts';
import { EditorBridge } from '../../src/bridge/server.ts';
import { createMcp } from '../../src/mcp/server.ts';
import { ProjectFiles } from '../../src/security/files.ts';
import { OperationError } from '../../src/core/errors.ts';

const token='t'.repeat(48);
const busy=()=>{throw Object.assign(new Error('private bind diagnostic'),{code:'EADDRINUSE'});};
const disconnected=()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:32123});

test('successful startup retains the actual bridge and its ownership',()=>{
  let closed=0;
  const bridge={status:()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:32123}),call:async()=>({}),close:()=>{closed++;}};
  const result=openEditorBridge(token,32123,(key,port)=>{expect(key).toBe(token);expect(port).toBe(32123);return bridge;});
  expect(result.portInUse).toBe(false);expect(result.bridge).toBe(bridge);
  result.bridge.close();expect(closed).toBe(1);
});
test('occupied-port client forwards direct calls to a paired owner without owning its socket',async()=>{
  const requests:Array<{type:string;method?:string}>=[];
  const send=(async (_url:string|URL|Request,init?:RequestInit)=>{
    expect(init?.headers).toMatchObject({authorization:`Bearer ${token}`});
    const body=JSON.parse(String(init?.body));requests.push(body);
    if(body.type==='status') return Response.json({ok:true,result:{...disconnected(),connected:true,sessionId:'owner-session'}});
    return Response.json({ok:true,result:{documents:[]}});
  }) as typeof fetch;
  const result=openEditorBridge(token,32123,busy,send);
  expect(await result.bridge.statusAsync?.()).toMatchObject({connected:true,sessionId:'owner-session'});
  expect(await result.bridge.call('list_documents',{})).toEqual({documents:[]});
  expect(await result.bridge.call('draw_pixels',{documentId:'sprite-1'},true)).toEqual({documents:[]});
  expect(requests.map(request=>request.type+('method' in request?`:${request.method}`:''))).toEqual(['status','call:list_documents','status','call:draw_pixels']);
  expect(result.portInUse).toBe(true);result.bridge.close();
});
test('shared edit transport failure reports uncertain outcome and never resends it',async()=>{
  let edits=0;
  const send=(async (_url:string|URL|Request,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body));
    if(body.type==='status') return Response.json({ok:true,result:disconnected()});
    edits++;throw new Error('connection lost after request');
  }) as typeof fetch;
  const result=openEditorBridge(token,32123,busy,send);
  await expect(result.bridge.call('draw_pixels',{documentId:'sprite-1'},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  expect(edits).toBe(1);result.bridge.close();
});

test('occupied-port bridge refuses control, has no connected status, and owns nothing to close',async()=>{
  const result=openEditorBridge(token,32123,busy);
  expect(result.portInUse).toBe(true);
  expect(()=>result.bridge.status()).toThrow(OperationError);
  await expect(result.bridge.call('draw_pixels',{documentId:'existing'},true)).rejects.toMatchObject({code:'LIVE_PORT_IN_USE'});
  result.bridge.close();result.bridge.close();
});

test('other startup failures remain fatal instead of masquerading as an occupied port',()=>{
  for(const error of [
    Object.assign(new Error('permission denied'),{code:'EPERM'}),
    Object.assign(new Error('permission denied'),{code:'EACCES'}),
    new OperationError('INVALID_TOKEN','Bad token'),
    new Error('EADDRINUSE text without the actual code'),
    null,
  ]) {
    let captured:unknown;
    try{openEditorBridge(token,32123,()=>{throw error;});}catch(value){captured=value;}
    expect(captured).toBe(error);
  }
});

test('a live status probe recovers the same port after its owner exits, without claiming pairing',async()=>{
  let occupied=true,attempts=0,closed=0,calls=0;
  const actual={status:disconnected,call:async()=>{calls++;throw new OperationError('NOT_CONNECTED','Pair the editor first.');},close:()=>{closed++;}};
  const result=openEditorBridge(token,32123,(key,port)=>{
    attempts++;expect(key).toBe(token);expect(port).toBe(32123);
    if(occupied)return busy();return actual;
  });
  expect(()=>result.bridge.status()).toThrow(OperationError);
  expect(attempts).toBe(2);expect(result.portInUse).toBe(true);
  occupied=false;
  expect(result.bridge.status()).toEqual(disconnected());
  expect(attempts).toBe(3);expect(result.portInUse).toBe(false);
  await expect(result.bridge.call('draw_pixels',{},true)).rejects.toMatchObject({code:'NOT_CONNECTED'});
  expect(attempts).toBe(3);expect(calls).toBe(1);
  result.bridge.close();result.bridge.close();expect(closed).toBe(1);
});

test('failed edits are not retained or replayed when a later call acquires the port',async()=>{
  let occupied=true,attempts=0;
  const calls:Array<{method:string;params:Record<string,unknown>;mutating?:boolean}>=[];
  const actual={status:disconnected,call:async(method:string,params:Record<string,unknown>,mutating?:boolean)=>{calls.push({method,params,mutating});return {documents:[]};},close:()=>{}};
  const result=openEditorBridge(token,32123,()=>{attempts++;if(occupied)return busy();return actual;});
  await expect(result.bridge.call('draw_pixels',{documentId:'old-edit'},true)).rejects.toMatchObject({code:'LIVE_PORT_IN_USE'});
  expect(calls).toEqual([]);
  occupied=false;
  expect(await result.bridge.call('list_documents',{})).toEqual({documents:[]});
  expect(attempts).toBe(3);
  expect(calls).toEqual([{method:'list_documents',params:{},mutating:undefined}]);
  await result.bridge.call('draw_pixels',{documentId:'new-edit'},true);
  expect(calls).toHaveLength(2);expect(calls[1]).toEqual({method:'draw_pixels',params:{documentId:'new-edit'},mutating:true});
  result.bridge.close();
});

test('concurrent live requests acquire only one bridge and preserve its outcome-unknown gate',async()=>{
  let attempts=0,calls=0;
  const actual={status:disconnected,call:async()=>{calls++;throw new OperationError('OUTCOME_UNKNOWN','Inspect the affected document.');},close:()=>{}};
  const result=openEditorBridge(token,32123,()=>{attempts++;if(attempts===1)return busy();return actual;});
  const outcomes=await Promise.allSettled([result.bridge.call('draw_pixels',{documentId:'s'},true),result.bridge.call('draw_pixels',{documentId:'s'},true)]);
  expect(attempts).toBe(2);expect(calls).toBe(2);
  for(const outcome of outcomes){expect(outcome.status).toBe('rejected');if(outcome.status==='rejected')expect(outcome.reason).toMatchObject({code:'OUTCOME_UNKNOWN'});}
  result.bridge.status();expect(attempts).toBe(2);result.bridge.close();
});

test('closing a waiting bridge prevents any later port acquisition',async()=>{
  let attempts=0;
  const result=openEditorBridge(token,32123,()=>{attempts++;return busy();});
  result.bridge.close();result.bridge.close();
  expect(()=>result.bridge.status()).toThrow(OperationError);
  await expect(result.bridge.call('list_documents',{})).rejects.toMatchObject({code:'NOT_CONNECTED'});
  expect(attempts).toBe(1);expect(result.portInUse).toBe(false);
});

test('recovery failures other than exact EADDRINUSE are not mislabeled as busy',async()=>{
  for(const error of [Object.assign(new Error('permission denied'),{code:'EPERM'}),new OperationError('INVALID_TOKEN','Bad token'),new Error('EADDRINUSE text only')]){
    let attempts=0;
    const result=openEditorBridge(token,32123,()=>{attempts++;if(attempts===1)return busy();throw error;});
    let captured:unknown;try{result.bridge.status();}catch(value){captured=value;}
    expect(captured).toBe(error);
    await expect(result.bridge.call('list_documents',{})).rejects.toBe(error);
    result.bridge.close();
  }
});

test('SDK discovers all tools when the live port is occupied; live reads, edits and exports fail honestly',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-busy-inventory-'));
  const {bridge}=openEditorBridge(token,32123,busy);
  const server=createMcp(bridge,await ProjectFiles.create(root));
  const client=new Client({name:'busy-inventory-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(serverTransport);await client.connect(clientTransport);
    const tools=await client.listTools();expect(tools.tools).toHaveLength(35);
    for(const [name,args] of [
      ['get_editor_status',{}],['list_documents',{}],
      ['create_sprite',{width:2,height:2}],
      ['get_preview',{documentId:'existing'}],
      ['save_sprite',{documentId:'existing',filename:'never-created.aseprite'}],
      ['export_sprite',{documentId:'existing',filename:'never-created.png'}],
    ] as const){
      const result=await client.callTool({name,arguments:args});
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ok:false,error:{code:'LIVE_PORT_IN_USE'}});
      expect(JSON.stringify(result)).not.toContain('private bind diagnostic');
    }
    const fileStatus=await client.callTool({name:'batch_status',arguments:{}});
    expect(fileStatus.isError).not.toBe(true); // Separate, explicitly named tools; no fallback.
    expect((await readdir(root)).filter(name=>name.endsWith('.aseprite')||name.endsWith('.png'))).toEqual([]);
  }finally{await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});

test('SDK recovers without restarting MCP and the acquired bridge still authenticates the editor',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-recover-inventory-'));
  let occupied=true,attempts=0,stops=0,options:any;
  const requests:any[]=[];
  const serve=((value:any)=>{options=value;return {port:32123,stop:()=>{stops++;}};}) as typeof Bun.serve;
  const result=openEditorBridge(token,32123,(key,port)=>{attempts++;if(occupied)return busy();return new EditorBridge(key,port,100,serve);});
  const server=createMcp(result.bridge,await ProjectFiles.create(root));
  const client=new Client({name:'recover-inventory-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const pair=(provided:string)=>{
    const socket={data:{authenticated:false},close:()=>options.websocket.close(socket),send:(raw:string)=>{
      const message=JSON.parse(raw);
      if(message.type==='request'){
        requests.push(message);
        options.websocket.message(socket,JSON.stringify({type:'response',bridgeVersion:1,sessionId:message.sessionId,id:message.id,ok:true,result:{documents:[]}}));
      }
      return raw.length;
    }};
    options.websocket.open(socket);
    options.websocket.message(socket,JSON.stringify({type:'hello',bridgeVersion:1,token:provided,editorVersion:'mock-only',apiVersion:41,capabilities:['list_documents']}));
  };
  try{
    await server.connect(serverTransport);await client.connect(clientTransport);
    expect((await client.listTools()).tools).toHaveLength(35);expect(attempts).toBe(1);
    const busyStatus=await client.callTool({name:'get_editor_status',arguments:{}});
    expect(busyStatus.structuredContent).toMatchObject({ok:false,error:{code:'LIVE_PORT_IN_USE'}});
    occupied=false;
    const waiting=await client.callTool({name:'get_editor_status',arguments:{}});
    expect(waiting.structuredContent).toMatchObject({ok:true,result:{connected:false,sessionId:null,port:32123}});
    expect(attempts).toBe(3);expect(result.portInUse).toBe(false);
    const unpaired=await client.callTool({name:'list_documents',arguments:{}});
    expect(unpaired.structuredContent).toMatchObject({ok:false,error:{code:'NOT_CONNECTED'}});
    pair('x'.repeat(48));
    expect(result.bridge.status().connected).toBe(false);
    pair(token);
    expect(result.bridge.status().connected).toBe(true);
    const documents=await client.callTool({name:'list_documents',arguments:{}});
    expect(documents.structuredContent).toMatchObject({ok:true,result:{documents:[]}});
    expect(requests).toHaveLength(1);expect(requests[0].method).toBe('list_documents');
    expect((await client.listTools()).tools).toHaveLength(35);expect(attempts).toBe(3);
    expect((await readdir(root)).filter(name=>name.endsWith('.aseprite')||name.endsWith('.png'))).toEqual([]);
    result.bridge.close();result.bridge.close();expect(stops).toBe(1);
    const closedStatus=await client.callTool({name:'get_editor_status',arguments:{}});
    expect(closedStatus.structuredContent).toMatchObject({ok:false,error:{code:'NOT_CONNECTED'}});expect(attempts).toBe(3);
  }finally{result.bridge.close();await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});
