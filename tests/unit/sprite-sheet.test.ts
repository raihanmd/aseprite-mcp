import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';
import { createMcp } from '../../src/mcp/server.ts';
import { ProjectFiles } from '../../src/security/files.ts';

const status=()=>({connected:true,sessionId:'sheet-session',editorVersion:'mock',apiVersion:39,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:32123});
const source={
  documentId:'sprite-1',width:2,height:1,
  frames:[{frame:1,durationMs:120},{frame:2,durationMs:240}],
  tags:[{name:'blink',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:3}],
};
const framePixels=['ff0000ff0000ff80','0000000000ff00ff'];

async function fixture(call:(method:string,params:Record<string,unknown>)=>Promise<unknown>) {
  const root=await mkdtemp(join(tmpdir(),'aseprite-sheet-test-'));
  const server=createMcp({status,call},await ProjectFiles.create(root));
  const client=new Client({name:'sheet-test',version:'1'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);await client.connect(clientTransport);
  return {root,client,close:async()=>{await client.close();await server.close();await rm(root,{recursive:true,force:true});}};
}

test('live sprite sheet preserves transparent RGBA, 1-based frames, durations, and tags',async()=>{
  const calls:string[]=[];
  const f=await fixture(async(method,params)=>{
    calls.push(method);
    if(method==='get_document_info')return source;
    if(method==='get_preview')return {documentId:'sprite-1',frame:params.frame,width:2,height:1,rgbaHex:framePixels[Number(params.frame)-1]};
    throw new Error('unexpected call');
  });
  try {
    const result=await f.client.callTool({name:'export_sprite_sheet',arguments:{documentId:'sprite-1',pngFilename:'walk.png',jsonFilename:'walk.json',columns:2}});
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ok:true,result:{frameCount:2,width:4,height:1,columns:2,rows:1,totalDurationMs:360,liveSavedStateUnchanged:true}});
    const metadata=await Bun.file(join(f.root,'walk.json')).json();
    expect(metadata).toMatchObject({
      format:'aseprite-mcp/sprite-sheet-v1',image:'walk.png',size:{width:4,height:1},frameSize:{width:2,height:1},frameIndexBase:1,totalDurationMs:360,
      frames:[{frame:1,x:0,y:0,width:2,height:1,durationMs:120},{frame:2,x:2,y:0,width:2,height:1,durationMs:240}],
      tags:[{name:'blink',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:3}],
    });
    const png=Buffer.from(await Bun.file(join(f.root,'walk.png')).arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(4);expect(png.readUInt32BE(20)).toBe(1);
    const compressedLength=png.readUInt32BE(33);
    const raw=inflateSync(png.subarray(41,41+compressedLength));
    expect([...raw]).toEqual([0,...Buffer.from(framePixels[0]!+framePixels[1]!,'hex')]);
    expect(calls).toEqual(['get_document_info','get_preview','get_preview','get_document_info']);
    const duplicate=await f.client.callTool({name:'export_sprite_sheet',arguments:{documentId:'sprite-1',pngFilename:'walk.png',jsonFilename:'second.json'}});
    expect(duplicate.structuredContent).toMatchObject({ok:false,error:{code:'FILE_EXISTS'}});
    expect(await Bun.file(join(f.root,'second.json')).exists()).toBe(false);
  } finally {await f.close();}
});

test('invalid frame result publishes no files',async()=>{
  const f=await fixture(async(method,params)=>{
    if(method==='get_document_info')return source;
    return {documentId:'sprite-1',frame:params.frame,width:2,height:1,rgbaHex:'abcd'};
  });
  try {
    const result=await f.client.callTool({name:'export_sprite_sheet',arguments:{documentId:'sprite-1',pngFilename:'bad.png',jsonFilename:'bad.json'}});
    expect(result.structuredContent).toMatchObject({ok:false,error:{code:'INVALID_PREVIEW'}});
    expect(await readdir(f.root)).toEqual([]);
  } finally {await f.close();}
});

test('oversized atlas is rejected before reading frames or writing files',async()=>{
  const calls:string[]=[];
  const f=await fixture(async(method)=>{
    calls.push(method);
    return {...source,width:256,height:256,frames:Array.from({length:80},(_,index)=>({frame:index+1,durationMs:100})),tags:[]};
  });
  try {
    const result=await f.client.callTool({name:'export_sprite_sheet',arguments:{documentId:'sprite-1',pngFilename:'huge.png',jsonFilename:'huge.json'}});
    expect(result.structuredContent).toMatchObject({ok:false,error:{code:'SHEET_TOO_LARGE'}});
    expect(calls).toEqual(['get_document_info']);
    expect(await readdir(f.root)).toEqual([]);
  } finally {await f.close();}
});

test('late JSON collision retains published PNG, reports partial export, and cleans staging',async()=>{
  let inspected=0;
  let root='';
  const f=await fixture(async(method,params)=>{
    if(method==='get_document_info') {
      inspected++;
      if(inspected===2)await writeFile(join(root,'occupied.json'),'user data',{flag:'wx'});
      return source;
    }
    return {documentId:'sprite-1',frame:params.frame,width:2,height:1,rgbaHex:framePixels[Number(params.frame)-1]};
  });
  root=f.root;
  try {
    const result=await f.client.callTool({name:'export_sprite_sheet',arguments:{documentId:'sprite-1',pngFilename:'partial.png',jsonFilename:'occupied.json'}});
    expect(result.structuredContent).toMatchObject({ok:false,error:{code:'PARTIAL_EXPORT'}});
    expect(JSON.stringify(result)).toContain(join(root,'partial.png'));
    expect(await Bun.file(join(root,'partial.png')).exists()).toBe(true);
    expect(await Bun.file(join(root,'occupied.json')).text()).toBe('user data');
    expect((await readdir(root)).sort()).toEqual(['occupied.json','partial.png']);
  } finally {await f.close();}
});
