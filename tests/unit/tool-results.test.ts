import { expect,test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMcp } from '../../src/mcp/server.ts';
import { ProjectFiles } from '../../src/security/files.ts';
import { encodePng,encodePngRgba } from '../../src/core/png.ts';

test('SDK tool replies contain an actual PNG image, matching metadata, and exclusive exports',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-tool-result-'));
  const calls:{method:string;params:Record<string,unknown>;mutating:boolean|undefined}[]=[];
  const rgbaHex='ff0000ff0000ff80';
  const bridge={
    status:()=>({connected:true,sessionId:'mock-session',editorVersion:'mock',apiVersion:25,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:0}),
    call:async(method:string,params:Record<string,unknown>,mutating?:boolean)=>{
      calls.push({method,params,mutating});
      if(method==='get_preview')return {documentId:params.documentId,frame:params.frame,width:2,height:1,rgbaHex};
      if(method==='get_document_info')return {documentId:params.documentId,width:2,height:1,frames:[{frame:1,durationMs:100},{frame:2,durationMs:200}],tags:[{name:'run',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:0}]};
      if(method==='save_copy') {
        const bytes=Buffer.alloc(128);bytes.writeUInt32LE(128,0);bytes.writeUInt16LE(0xa5e0,4);
        await Bun.write(params.stagingPath as string,bytes);return {savedCopy:true};
      }
      throw new Error('internal private detail');
    },
  };
  const server=createMcp(bridge,await ProjectFiles.create(root));
  const client=new Client({name:'unit-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);await client.connect(clientTransport);
    const preview=await client.callTool({name:'get_preview',arguments:{documentId:'sprite-1',scale:2}});
    expect(preview.structuredContent).toMatchObject({ok:true,sessionId:'mock-session',result:{documentId:'sprite-1',frame:1,width:4,height:2,scale:2}});
    const content=preview.content as {type:string;mimeType?:string;data?:string}[];
    const image=content.find(item=>item.type==='image')!;
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.data!,'base64').equals(encodePng(2,1,rgbaHex,2))).toBe(true);
    const animation=await client.callTool({name:'get_animation_preview',arguments:{documentId:'sprite-1',frameCount:2,columns:2,scale:1}});
    expect(animation.isError).not.toBe(true);
    expect(animation.structuredContent).toMatchObject({ok:true,result:{startFrame:1,frameCount:2,totalFrames:2,totalDurationMs:300,truncated:false,tags:[{name:'run',fromFrame:1,toFrame:2}],frames:[{frame:1,durationMs:100},{frame:2,durationMs:200}],contactSheet:{width:10,height:5,columns:2,rows:1,scale:1}}});
    const sheet=(animation.content as {type:string;mimeType?:string;data?:string}[]).find(item=>item.type==='image')!;
    const sheetBytes=Buffer.from(sheet.data!,'base64');
    expect(sheet.mimeType).toBe('image/png');expect(sheetBytes.readUInt32BE(16)).toBe(10);expect(sheetBytes.readUInt32BE(20)).toBe(5);
    expect(calls.filter(item=>item.method==='get_preview').slice(1).map(item=>item.params.frame)).toEqual([1,2]);
    const exported=await client.callTool({name:'export_sprite',arguments:{documentId:'sprite-1',filename:'with space 雨.png'}});
    expect(exported.isError).not.toBe(true);
    expect(Buffer.from(await Bun.file(join(root,'with space 雨.png')).arrayBuffer()).equals(encodePng(2,1,rgbaHex))).toBe(true);
    const duplicate=await client.callTool({name:'export_sprite',arguments:{documentId:'sprite-1',filename:'with space 雨.png'}});
    expect(duplicate.isError).toBe(true);expect(duplicate.structuredContent).toMatchObject({ok:false,error:{code:'FILE_EXISTS'}});
    const saved=await client.callTool({name:'save_sprite',arguments:{documentId:'sprite-1',filename:'source.aseprite'}});
    expect(saved.structuredContent).toMatchObject({ok:true,result:{savedCopy:true,liveSavedStateUnchanged:true}});
    expect((await Bun.file(join(root,'source.aseprite')).arrayBuffer()).byteLength).toBe(128);
    expect(calls.find(item=>item.method==='save_copy')?.mutating).toBe(true);
    const failed=await client.callTool({name:'list_documents',arguments:{}});
    expect(failed.isError).toBe(true);expect(JSON.stringify(failed)).not.toContain('internal private detail');
  } finally {await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});

test('contact sheet PNG encoder requires exact bounded RGBA pixel data',()=>{
  const png=encodePngRgba(2,1,new Uint8Array([255,0,0,255,0,0,255,255]));
  expect(png.readUInt32BE(16)).toBe(2);expect(png.readUInt32BE(20)).toBe(1);
  expect(()=>encodePngRgba(2,1,new Uint8Array([255,0,0,255]))).toThrow('dimensions or RGBA data');
  expect(()=>encodePngRgba(4096,4096,new Uint8Array(0))).toThrow('dimensions or RGBA data');
});
