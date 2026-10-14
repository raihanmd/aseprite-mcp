import { expect,test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rasterizeShapes } from '../../src/tools/shapes.ts';
import { createMcp } from '../../src/mcp/server.ts';
import { ProjectFiles } from '../../src/security/files.ts';
import { OperationError } from '../../src/core/errors.ts';
import { openEditorBridge } from '../../src/bridge/availability.ts';

test('compact primitives rasterize in order with unique pixels and clear expectations',()=>{
  const red=[255,0,0,255],blue=[0,0,255,255];
  const pixels=rasterizeShapes([
    {type:'rect',x:1,y:1,width:3,height:2,rgba:red},
    {type:'line',from:{x:0,y:0},to:{x:2,y:2},thickness:1,rgba:blue},
    {type:'ellipse',center:{x:5,y:5},radiusX:1,radiusY:1,rgba:red},
    {type:'polygon',points:[{x:8,y:1},{x:10,y:1},{x:9,y:3}],rgba:blue},
  ]);
  expect(pixels.every(pixel=>pixel.expected.join(',')==='0,0,0,0')).toBe(true);
  expect(pixels.filter(pixel=>pixel.x===1&&pixel.y===1)).toEqual([{x:1,y:1,rgba:blue,expected:[0,0,0,0]}]);
  expect(pixels.some(pixel=>pixel.x===5&&pixel.y===5)).toBe(true);
  expect(pixels.some(pixel=>pixel.x===9&&pixel.y===2)).toBe(true);
  expect(pixels.length).toBe(new Set(pixels.map(pixel=>`${pixel.x},${pixel.y}`)).size);
  expect(rasterizeShapes([{type:'rect',x:1,y:1,width:3,height:2,rgba:red}],2,2)).toHaveLength(1);
  expect(()=>rasterizeShapes([{type:'rect',x:3,y:3,width:1,height:1,rgba:red}],2,2)).toThrow(OperationError);
  expect(()=>rasterizeShapes([{type:'rect',x:0,y:0,width:1,height:1,rgba:[0,0,0,0]}])).toThrow(OperationError);
  expect(()=>rasterizeShapes([{type:'rect',x:0,y:0,width:256,height:256,rgba:red}])).toThrow(OperationError);
});

test('draw_shapes MCP tool sends one checked draw_pixels edit and surfaces stale-state failure',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-shapes-'));
  const calls:Array<{method:string;params:Record<string,unknown>;mutating?:boolean}>=[];
  let stale=false;
  const bridge={
    status:()=>({connected:true,sessionId:'owner',editorVersion:'mock',apiVersion:39,extensionVersion:null,compatibility:null,capabilities:['draw_pixels'],outcomeUnknown:false,recoveryDocumentId:null,port:0}),
    call:async(method:string,params:Record<string,unknown>,mutating?:boolean)=>{
      calls.push({method,params,mutating});
      if(method==='get_document_info')return {width:16,height:16};
      if(stale)throw new OperationError('STALE_STATE','Target pixels are no longer clear.');
      return {changedPixels:(params.pixels as unknown[]).length};
    },
  };
  const server=createMcp(bridge,await ProjectFiles.create(root));
  const client=new Client({name:'shape-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(serverTransport);await client.connect(clientTransport);
    expect((await client.listTools()).tools.some(tool=>tool.name==='draw_shapes')).toBe(true);
    const args={documentId:'sprite-1',layerId:'layer-1',frame:2,label:'Rough character',shapes:[{type:'rect',x:1,y:1,width:2,height:2,rgba:[10,20,30,255]}]};
    const first=await client.callTool({name:'draw_shapes',arguments:args});
    expect(first.structuredContent).toMatchObject({ok:true,result:{changedPixels:4,shapeCount:1}});
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({method:'get_document_info',mutating:false,params:{documentId:'sprite-1'}});
    expect(calls[1]).toMatchObject({method:'draw_pixels',mutating:true,params:{documentId:'sprite-1',layerId:'layer-1',frame:2,label:'Rough character'}});
    expect((calls[1]!.params.pixels as Array<{expected:number[]}>).every(pixel=>pixel.expected.join(',')==='0,0,0,0')).toBe(true);
    stale=true;
    const second=await client.callTool({name:'draw_shapes',arguments:args});
    expect(second.isError).toBe(true);
    expect(second.structuredContent).toMatchObject({ok:false,error:{code:'STALE_STATE'}});
  }finally{await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});

test('a second MCP client draws directly through the shared owner without request files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-shared-shapes-'));
  const forwarded:string[]=[];
  const token='s'.repeat(48);
  const send=(async (_url:string|URL|Request,init?:RequestInit)=>{
    expect(init?.headers).toMatchObject({authorization:`Bearer ${token}`});
    const body=JSON.parse(String(init?.body));
    if(body.type==='status')return Response.json({ok:true,result:{connected:true,sessionId:'owner-session',editorVersion:'mock',apiVersion:39,extensionVersion:null,compatibility:null,capabilities:['get_document_info','draw_pixels'],outcomeUnknown:false,recoveryDocumentId:null,port:32123}});
    forwarded.push(body.method);
    if(body.method==='get_document_info')return Response.json({ok:true,result:{width:8,height:8}});
    expect(body.method).toBe('draw_pixels');
    expect(body.params.pixels).toHaveLength(4);
    return Response.json({ok:true,result:{changedPixels:4}});
  }) as typeof fetch;
  const busy=()=>{throw Object.assign(new Error('port busy'),{code:'EADDRINUSE'});};
  const {bridge}=openEditorBridge(token,32123,busy,send);
  const server=createMcp(bridge,await ProjectFiles.create(root));
  const client=new Client({name:'shared-shape-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(serverTransport);await client.connect(clientTransport);
    const result=await client.callTool({name:'draw_shapes',arguments:{documentId:'sprite-1',layerId:'layer-1',shapes:[{type:'rect',x:1,y:1,width:2,height:2,rgba:[20,40,60,255]}]}});
    expect(result.structuredContent).toMatchObject({ok:true,sessionId:'owner-session',result:{changedPixels:4,shapeCount:1}});
    expect(forwarded).toEqual(['get_document_info','draw_pixels']);
  }finally{bridge.close();await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});
