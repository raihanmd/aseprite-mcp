import { afterEach, expect, test } from 'bun:test';
import { EditorBridge } from '../../src/bridge/server.ts';
import { openEditorBridge } from '../../src/bridge/availability.ts';
const token='t'.repeat(48);
const bridges:EditorBridge[]=[];
const sockets:WebSocket[]=[];
afterEach(()=>{for(const ws of sockets.splice(0))ws.close();for(const b of bridges.splice(0))b.close();});
async function connect(bridge:EditorBridge,provided=token,handler?:(message:any,ws:WebSocket)=>void,nativeOrigin=false) {
  const ws=new WebSocket(`ws://127.0.0.1:${bridge.server.port}/aseprite`,nativeOrigin?{headers:{Origin:`ws://127.0.0.1:${bridge.server.port}`}}:{});sockets.push(ws);
  await new Promise<void>((resolve,reject)=>{ws.onopen=()=>resolve();ws.onerror=()=>reject(new Error('WebSocket failed'));});
  const authenticated=new Promise<void>(resolve=>{ws.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.type==='hello_ack')resolve();else handler?.(message,ws);};});
  ws.send(JSON.stringify({type:'hello',bridgeVersion:1,token:provided,editorVersion:'test-only',apiVersion:39,capabilities:['list_documents','get_document_info','draw_pixels']}));
  if(provided===token) await authenticated;
  return ws;
}
function bridge(timeout=1000){const b=new EditorBridge(token,0,timeout);bridges.push(b);return b;}
function closed(ws:WebSocket) {
  if(ws.readyState===WebSocket.CLOSED)return Promise.resolve();
  return new Promise<void>(resolve=>ws.addEventListener('close',()=>resolve(),{once:true}));
}
test('disconnected tools do not mutate or silently fall back',async()=>{
  const b=bridge();expect(b.status().connected).toBe(false);
  await expect(b.call('draw_pixels',{},true)).rejects.toMatchObject({code:'NOT_CONNECTED'});
});
test('authenticated request carries stable session and explicit parameters',async()=>{
  const b=bridge();let request:any;
  await connect(b,token,(m,ws)=>{request=m;ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{documents:[]}}));});
  expect(await b.call('list_documents',{})).toEqual({documents:[]});expect(request.sessionId).toBe(b.status().sessionId);
  await expect(b.call('execute_lua',{},true)).rejects.toMatchObject({code:'UNSUPPORTED_API'});
});
test('wrong token and browser origins are rejected',async()=>{
  const b=bridge();const ws=await connect(b,'x'.repeat(48));
  await closed(ws);expect(b.status().connected).toBe(false);
  const response=await fetch(`http://127.0.0.1:${b.server.port}/aseprite`,{headers:{Origin:'https://example.com'}});expect(response.status).toBe(403);
});
test('Aseprite-style native origin pairs only with the correct token on an allocated port',async()=>{
  const b=bridge();
  const rejected=await connect(b,'x'.repeat(48),undefined,true);
  await closed(rejected);
  expect(b.status().connected).toBe(false);
  await connect(b,token,undefined,true);
  expect(b.status().connected).toBe(true);expect(b.status().sessionId).not.toBeNull();
});
test('loopback browser and mismatched native origins remain forbidden',async()=>{
  const b=bridge();const port=b.server.port;
  if(port===undefined)throw new Error('TCP test server has no listening port.');
  for(const origin of [`http://127.0.0.1:${port}`,`https://127.0.0.1:${port}`,`ws://127.0.0.1:${port+1}`]) {
    const response=await fetch(`http://127.0.0.1:${b.server.port}/aseprite`,{headers:{Origin:origin}});
    expect(response.status).toBe(403);
  }
});
test('a second MCP process shares the paired editor without taking ownership',async()=>{
  const owner=bridge();
  await connect(owner,token,(m,ws)=>ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{documents:[]}})),true);
  const port=owner.server.port;
  if(port===undefined)throw new Error('TCP test server has no listening port.');
  const contender=openEditorBridge(token,port);
  expect(contender.portInUse).toBe(true);
  expect(await contender.bridge.statusAsync?.()).toMatchObject({connected:true,sessionId:owner.status().sessionId,port});
  expect(await contender.bridge.call('list_documents',{})).toEqual({documents:[]});
  contender.bridge.close();
  expect(owner.status().connected).toBe(true);
  expect(await owner.call('list_documents',{})).toEqual({documents:[]});
});
test('shared bridge rejects browser origins and wrong tokens',async()=>{
  const owner=bridge();const port=owner.server.port;
  if(port===undefined)throw new Error('TCP test server has no listening port.');
  const url=`http://127.0.0.1:${port}/aseprite/client`;
  const body=JSON.stringify({type:'status'});
  for(const headers of [
    {'content-type':'application/json'},
    {'content-type':'application/json',authorization:'Bearer '+'x'.repeat(48)},
    {'content-type':'application/json',authorization:'Bearer '+token,origin:'http://127.0.0.1:3000'},
  ] as Record<string,string>[]) {
    const response=await fetch(url,{method:'POST',headers,body});
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(token);
  }
  const permitted=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body});
  expect(permitted.status).toBe(200);
  expect(await permitted.json()).toMatchObject({ok:true,result:{connected:false,port}});
});
test('shared edits use the owner queue and reject unadvertised operations',async()=>{
  const owner=bridge();let outstanding=0,max=0,seen=0;
  await connect(owner,token,(m,ws)=>{
    outstanding++;max=Math.max(max,outstanding);seen++;
    setTimeout(()=>{outstanding--;ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{documents:[]}}));},10);
  });
  const port=owner.server.port;
  if(port===undefined)throw new Error('TCP test server has no listening port.');
  const second=openEditorBridge(token,port),third=openEditorBridge(token,port);
  try {
    await Promise.all([second.bridge.call('list_documents',{}),third.bridge.call('list_documents',{})]);
    expect(seen).toBe(2);expect(max).toBe(1);
    await expect(second.bridge.call('execute_lua',{},true)).rejects.toMatchObject({code:'UNKNOWN_OPERATION'});
    expect(seen).toBe(2);
  } finally {second.bridge.close();third.bridge.close();}
});
test('a live probe acquires the released real port and requires a new authenticated connection',async()=>{
  const owner=bridge();const port=owner.server.port;
  if(port===undefined)throw new Error('TCP test server has no listening port.');
  let acquired:EditorBridge|undefined;
  const contender=openEditorBridge(token,port,(key,localPort)=>{
    const candidate=new EditorBridge(key,localPort);
    acquired=candidate;bridges.push(candidate);return candidate;
  });
  try{
    expect(contender.portInUse).toBe(true);
    expect(await contender.bridge.call('list_documents',{})).toEqual({documents:[]});
    owner.close();await owner.server.stop(true);
    expect(contender.bridge.status()).toMatchObject({connected:false,sessionId:null,port});
    expect(contender.portInUse).toBe(false);
    await expect(contender.bridge.call('list_documents',{})).rejects.toMatchObject({code:'NOT_CONNECTED'});
    if(!acquired)throw new Error('Released port was not acquired.');
    await connect(acquired,token,(m,ws)=>ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{documents:[]}})),true);
    expect(await contender.bridge.call('list_documents',{})).toEqual({documents:[]});
  }finally{contender.bridge.close();}
});
test('timeout never retries an edit and requires fresh inspection',async()=>{
  const b=bridge(40);let count=0;
  await connect(b,token,(m,ws)=>{if(m.method==='get_document_info')ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{documentId:'s'}}));else count++;});
  await expect(b.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  await expect(b.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});expect(count).toBe(1);
  await b.call('get_document_info',{documentId:'s'});expect(b.status().outcomeUnknown).toBe(false);
});
test('queue sends only one request at a time',async()=>{
  const b=bridge();let outstanding=0,max=0;
  await connect(b,token,(m,ws)=>{outstanding++;max=Math.max(max,outstanding);setTimeout(()=>{outstanding--;ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result:{}}));},10);});
  await Promise.all([b.call('list_documents',{}),b.call('list_documents',{})]);expect(max).toBe(1);
});
test('malformed or wrong-session replies never report success',async()=>{
  const b=bridge();await connect(b,token,(m,ws)=>ws.send(JSON.stringify({type:'response',bridgeVersion:1,sessionId:'wrong',id:m.id,ok:true,result:{}})));
  await expect(b.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
});
