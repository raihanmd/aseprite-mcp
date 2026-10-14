import {expect,test} from 'bun:test';
import {mkdtemp,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {ProjectFiles} from '../../src/security/files.ts';
import {BatchRunner} from '../../src/batch/runner.ts';
import {batchSchemas} from '../../src/batch/contracts.ts';
import {runProcess,childEnvironment} from '../../src/batch/process.ts';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createMcp} from '../../src/mcp/server.ts';
import {OperationError} from '../../src/core/errors.ts';

const sourceBytes=()=>{const bytes=Buffer.alloc(128);bytes.writeUInt32LE(128,0);bytes.writeUInt16LE(0xa5e0,4);return bytes;};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function setup(){const root=await mkdtemp(join(tmpdir(),'aseprite-batch-test-'));return {root,files:await ProjectFiles.create(root),cleanup:()=>rm(root,{recursive:true,force:true})};}
const metadata=(frame=1)=>({ok:true,workflow:'batch',editorVersion:'mock',apiVersion:39,document:{width:2,height:1,colorMode:'RGB',isModified:true,layers:[{layerIndex:1,name:'Art',group:false,visible:true,editable:true,opacity:255}],frames:[{frame:1,durationMs:100}]},preview:{documentId:'ephemeral',frame,width:2,height:1,rgbaHex:'ff0000ff0000ff80'}});
async function fakeJob(command:string[]){
  const requestPath=command.find(value=>value.startsWith('request='))!.slice(8);
  const request=JSON.parse(await readFile(requestPath,'utf8'));
  await writeFile(request.outputPath,sourceBytes());await writeFile(request.resultPath,JSON.stringify(metadata(request.args.frame)));
  return request;
}
test('batch creates, inspects, and revises new copies with bounded argv, actual preview bytes and untouched source',async()=>{
  const env=await setup();const commands:string[][]=[];
  const runner=new BatchRunner(env.files,process.execPath,async(command,options)=>{commands.push(command);expect(options.timeoutMs).toBe(30000);expect(options.maxOutputBytes).toBe(65536);await fakeJob(command);});
  try{
    const created=await runner.execute('batch_create_sprite',{width:2,height:1,filename:'with space 雨.aseprite',pngFilename:'with space 雨.png'});
    expect(created.image.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(created.fileSha256).toBe(sha(sourceBytes()));
    expect(commands[0]![1]).toBe('--batch');expect(commands[0]!.at(-2)).toBe('--script');
    expect(commands[0]).toContain('--noinapp');
    const inspected=await runner.execute('batch_inspect_sprite',{filename:'with space 雨.aseprite'});
    expect(inspected.inputFileSha256).toBe(created.fileSha256);
    await runner.execute('batch_edit_sprite',{inputFilename:'with space 雨.aseprite',expectedFileSha256:created.fileSha256,filename:'revision.aseprite',operations:[{method:'draw_pixels',layerIndex:1,pixels:[{x:0,y:0,rgba:[0,0,255,255],expected:[255,0,0,255]}]}]});
    expect(Buffer.from(await readFile(join(env.root,'with space 雨.aseprite'))).equals(sourceBytes())).toBe(true);
    expect((await readdir(env.root)).some(name=>name.startsWith('.aseprite-stage-'))).toBe(false);
  }finally{await env.cleanup();}
});
test('batch rejects stale source hashes and collisions before spawning; it has no live fallback',async()=>{
  const env=await setup();let jobs=0;const runner=new BatchRunner(env.files,process.execPath,async command=>{jobs++;await fakeJob(command);});
  try{
    await writeFile(join(env.root,'original.aseprite'),sourceBytes());
    await expect(runner.execute('batch_edit_sprite',{inputFilename:'original.aseprite',expectedFileSha256:'0'.repeat(64),filename:'new.aseprite',operations:[{method:'undo'}]})).rejects.toMatchObject({code:'STALE_FILE'});
    await expect(runner.execute('batch_create_sprite',{width:2,height:1,filename:'original.aseprite'})).rejects.toMatchObject({code:'FILE_EXISTS'});
    await expect(new BatchRunner(env.files,null).execute('batch_inspect_sprite',{filename:'original.aseprite'})).rejects.toMatchObject({code:'BATCH_UNAVAILABLE'});
    expect(jobs).toBe(0);expect(await readdir(env.root)).toEqual(['original.aseprite']);
  }finally{await env.cleanup();}
});
test('batch rejects sources changed mid-job and invalid artifacts without publication',async()=>{
  const env=await setup();await writeFile(join(env.root,'original.aseprite'),sourceBytes());
  try{
    const changed=new BatchRunner(env.files,process.execPath,async command=>{await fakeJob(command);const bytes=sourceBytes();bytes[12]=1;await writeFile(join(env.root,'original.aseprite'),bytes);});
    await expect(changed.execute('batch_inspect_sprite',{filename:'original.aseprite',pngFilename:'unpublished.png'})).rejects.toMatchObject({code:'STALE_FILE'});
    const invalid=new BatchRunner(env.files,process.execPath,async command=>{const request=await fakeJob(command);await writeFile(request.outputPath,Buffer.alloc(128));});
    await expect(invalid.execute('batch_create_sprite',{width:2,height:1,filename:'invalid.aseprite'})).rejects.toMatchObject({code:'INVALID_ARTIFACT'});
    const wrongFrame=new BatchRunner(env.files,process.execPath,async command=>{const request=await fakeJob(command);await writeFile(request.resultPath,JSON.stringify(metadata(2)));});
    await expect(wrongFrame.execute('batch_inspect_sprite',{filename:'original.aseprite'})).rejects.toMatchObject({code:'INVALID_ARTIFACT'});
    expect(await readdir(env.root)).toEqual(['original.aseprite']);
  }finally{await env.cleanup();}
});
test('batch schema allows only named operations and rejects empty property changes',()=>{
  const base={inputFilename:'a.aseprite',filename:'b.aseprite',expectedFileSha256:'0'.repeat(64)};
  expect(batchSchemas.batch_edit_sprite.safeParse({...base,operations:[{method:'execute_lua',script:'delete'}]}).success).toBe(false);
  expect(batchSchemas.batch_edit_sprite.safeParse({...base,operations:[{method:'set_layer_properties',layerIndex:1}]}).success).toBe(false);
});
test('batch serializes jobs and cleans staging after a failed subprocess',async()=>{
  const env=await setup();let entered!:(value:void)=>void,release!:(value:void)=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;}),waiting=new Promise<void>(resolve=>{release=resolve;});
  const runner=new BatchRunner(env.files,process.execPath,async command=>{entered();await waiting;await fakeJob(command);});
  try{
    const first=runner.execute('batch_create_sprite',{width:2,height:1,filename:'first.aseprite'});
    await started;
    await expect(runner.execute('batch_create_sprite',{width:2,height:1,filename:'second.aseprite'})).rejects.toMatchObject({code:'BATCH_BUSY'});
    release();await first;
    const failed=new BatchRunner(env.files,process.execPath,async()=>{throw new OperationError('BATCH_TIMEOUT','Mock timeout');});
    await expect(failed.execute('batch_create_sprite',{width:2,height:1,filename:'failed.aseprite'})).rejects.toMatchObject({code:'BATCH_TIMEOUT'});
    expect(await readdir(env.root)).toEqual(['first.aseprite']);
  }finally{release();await env.cleanup();}
});
test('batch reports the retained source if PNG publication fails instead of claiming atomic export',async()=>{
  const env=await setup();const runner=new BatchRunner(env.files,process.execPath,async command=>{await fakeJob(command);});
  env.files.write=async()=>{throw new Error('Private filesystem diagnostic');};
  try{
    await expect(runner.execute('batch_create_sprite',{width:2,height:1,filename:'retained.aseprite',pngFilename:'failed.png'})).rejects.toMatchObject({code:'PARTIAL_EXPORT',message:expect.stringContaining(join(env.root,'retained.aseprite'))});
    expect(await readdir(env.root)).toEqual(['retained.aseprite']);
  }finally{await env.cleanup();}
});
test('batch bounds result files and validates layer indices and returned pixel regions',async()=>{
  const env=await setup();await writeFile(join(env.root,'input.aseprite'),sourceBytes());
  try{
    for(const kind of ['oversized','layer','region']){
      const runner=new BatchRunner(env.files,process.execPath,async command=>{
        const request=await fakeJob(command);
        if(kind==='oversized')await writeFile(request.resultPath,Buffer.alloc(1024*1024+1));
        else{const value=metadata();if(kind==='layer')value.document.layers[0]!.layerIndex=2;await writeFile(request.resultPath,JSON.stringify(value));}
      });
      await expect(runner.execute('batch_inspect_sprite',{filename:'input.aseprite',...(kind==='region'?{region:{layerIndex:1,frame:1,x:0,y:0,width:2,height:1}}:{})})).rejects.toMatchObject({code:'INVALID_ARTIFACT'});
    }
    expect(await readdir(env.root)).toEqual(['input.aseprite']);
  }finally{await env.cleanup();}
});
function processFixture(chunks:number[],exit:number|null=0){
  let finish!:(value:number)=>void,options:any,killed=false;
  const stream=()=>new ReadableStream<Uint8Array>({start(controller){for(const size of chunks)controller.enqueue(new Uint8Array(size));if(exit!==null)controller.close();}});
  const pending=new Promise<number>(resolve=>{finish=resolve;if(exit!==null)resolve(exit);});
  const spawn=((_:string[],value:any)=>{options=value;return {stdout:stream(),stderr:stream(),exited:pending,kill:()=>{killed=true;finish(137);}};}) as typeof Bun.spawn;
  return {spawn,options:()=>options,killed:()=>killed};
}
test('subprocess output is bounded across both streams and subprocess receives no pairing/provider environment',async()=>{
  const f=processFixture([40]);
  await expect(runProcess(['/absolute/editor'],{cwd:'/tmp',timeoutMs:1000,maxOutputBytes:60},f.spawn)).rejects.toMatchObject({code:'BATCH_OUTPUT_LIMIT'});
  expect(f.killed()).toBe(true);expect(f.options().stdout).toBe('pipe');expect(f.options().stderr).toBe('pipe');
  expect(f.options().env.ASEPRITE_MCP_TOKEN).toBeUndefined();expect(f.options().env.OPENAI_API_KEY).toBeUndefined();
  expect(f.options().env.ASEPRITE_USER_FOLDER).toBe('/tmp/editor-config');
  expect(Object.keys(childEnvironment()).every(name=>!name.startsWith('ASEPRITE_'))).toBe(true);
});
test('subprocess timeout and failed exit never pass and do not expose child text',async()=>{
  const hung=processFixture([],null);
  await expect(runProcess(['/absolute/editor'],{cwd:'/tmp',timeoutMs:10,maxOutputBytes:1024},hung.spawn)).rejects.toMatchObject({code:'BATCH_TIMEOUT'});expect(hung.killed()).toBe(true);
  const failed=processFixture([],1);
  await expect(runProcess(['/absolute/editor'],{cwd:'/tmp',timeoutMs:1000,maxOutputBytes:1024},failed.spawn)).rejects.toMatchObject({code:'BATCH_PROCESS_FAILED'});
});
test('official SDK gets actual batch preview content and live calls never use file backend',async()=>{
  const env=await setup();let jobs=0;
  const runner=new BatchRunner(env.files,process.execPath,async command=>{jobs++;await fakeJob(command);});
  const bridge={status:()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:0}),call:async()=>{throw new OperationError('NOT_CONNECTED','No live editor');}};
  const server=createMcp(bridge,env.files,runner),client=new Client({name:'batch-test',version:'1'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(b);await client.connect(a);
    const live=await client.callTool({name:'list_documents',arguments:{}});expect(live.isError).toBe(true);expect(jobs).toBe(0);
    const created=await client.callTool({name:'batch_create_sprite',arguments:{width:2,height:1,filename:'SDK.aseprite',scale:2}});
    expect(created.isError).not.toBe(true);expect(created.structuredContent).toMatchObject({ok:true,result:{workflow:'batch',preview:{width:4,height:2,scale:2}}});
    expect((created.content as any[]).some(item=>item.type==='image'&&item.mimeType==='image/png')).toBe(true);expect(jobs).toBe(1);
  }finally{await client.close();await server.close();await env.cleanup();}
});
