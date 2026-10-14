import {constants} from 'node:fs';
import {access,open,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,join,resolve} from 'node:path';
import {z} from 'zod';
import {ProjectFiles} from '../security/files.ts';
import {OperationError} from '../core/errors.ts';
import {encodePng} from '../core/png.ts';
import {batchSchemas,type BatchMethod} from './contracts.ts';
import {runProcess,type ProcessRunner} from './process.ts';

const root=resolve(import.meta.dir,'../..');
const preview=z.object({documentId:z.string(),frame:z.number().int().min(1).max(256),width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256),rgbaHex:z.string().max(256*256*8)}).strict();
const layer=z.object({layerIndex:z.number().int().min(1).max(256),name:z.string().max(1024),group:z.boolean(),visible:z.boolean(),editable:z.boolean(),opacity:z.number().int().min(0).max(255)}).strict();
const frame=z.object({frame:z.number().int().min(1).max(256),durationMs:z.number().int().min(1).max(60000)}).strict();
const pixel=z.object({x:z.number().int().min(0).max(255),y:z.number().int().min(0).max(255),rgba:z.tuple([z.number().int().min(0).max(255),z.number().int().min(0).max(255),z.number().int().min(0).max(255),z.number().int().min(0).max(255)])}).strict();
const result=z.object({ok:z.literal(true),workflow:z.literal('batch'),editorVersion:z.string().max(64),apiVersion:z.number().int().min(25),document:z.object({width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256),colorMode:z.string().max(64),isModified:z.boolean(),layers:z.array(layer).min(1).max(256),frames:z.array(frame).min(1).max(256)}).strict(),preview,pixels:z.array(pixel).max(16384).optional()}).strict();
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function boundedFile(path:string,maximum:number,minimum=1) {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const info=await file.stat();if(!info.isFile()||info.size<minimum||info.size>maximum)throw new OperationError('INVALID_ARTIFACT','The job file is not a bounded regular file.');
    const bytes=Buffer.alloc(info.size);let offset=0;
    while(offset<bytes.length){const read=await file.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)throw new OperationError('INVALID_ARTIFACT','Job file changed while reading.');offset+=read.bytesRead;}
    const after=await file.stat();if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw new OperationError('STALE_FILE','A file changed during the job. Inspect it again.');
    return bytes;
  }finally{await file.close();}
}
export type BatchClient=Pick<BatchRunner,'status'|'execute'>;
export class BatchRunner {
  private running=false;
  constructor(private files:ProjectFiles,private executable:string|null=process.env.ASEPRITE_MCP_EXECUTABLE??Bun.which('aseprite'),private processRunner:ProcessRunner=runProcess){}
  status(){return {workflow:'batch',configured:!!this.executable,executable:this.executable,seesUnsavedChanges:false,workflowVerified:false};}
  async execute(method:BatchMethod,raw:unknown) {
    const args=batchSchemas[method].parse(raw) as Record<string,any>;
    if(!this.executable)throw new OperationError('BATCH_UNAVAILABLE','Set ASEPRITE_MCP_EXECUTABLE to the absolute Aseprite executable path. File tools never use an unsaved live document.');
    if(!isAbsolute(this.executable))throw new OperationError('INVALID_EXECUTABLE','Configure an absolute Aseprite executable path, not a shell command.');
    await access(this.executable,process.platform==='win32'?constants.F_OK:constants.X_OK);
    if(this.running)throw new OperationError('BATCH_BUSY','A file job is already running. Wait for its result before starting another.');
    this.running=true;
    try{return await this.files.stage(async directory=>{
      if(method!=='batch_inspect_sprite')await this.files.target(args.filename,['.aseprite']);
      if(args.pngFilename)await this.files.target(args.pngFilename,['.png']);
      let inputPath:string|undefined,inputBytes:Buffer|undefined,inputSha256:string|undefined;
      if(method!=='batch_create_sprite'){
        inputPath=await this.files.input(method==='batch_edit_sprite'?args.inputFilename:args.filename);
        inputBytes=await boundedFile(inputPath,64*1024*1024,128);
        if(inputBytes.readUInt16LE(4)!==0xa5e0)throw new OperationError('INVALID_ARTIFACT','Input is not an Aseprite source document.');
        inputSha256=sha256(inputBytes);
        if(method==='batch_edit_sprite'&&inputSha256!==args.expectedFileSha256)throw new OperationError('STALE_FILE','Saved source changed. Inspect it again before revising.');
        await writeFile(join(directory,'input.aseprite'),inputBytes,{flag:'wx',mode:0o600});
      }
      const request={version:1,method,args,inputPath:inputPath?join(directory,'input.aseprite'):null,outputPath:join(directory,'output.aseprite'),resultPath:join(directory,'result.json')};
      const encoded=JSON.stringify(request);if(Buffer.byteLength(encoded)>1024*1024)throw new OperationError('INVALID_ARGUMENT','File job request exceeds one MiB.');
      const requestPath=join(directory,'request.json');await writeFile(requestPath,encoded,{flag:'wx',mode:0o600});
      await mkdir(join(directory,'editor-config'),{mode:0o700});
      await this.processRunner([this.executable!,'--batch','--noinapp','--script-param',`request=${requestPath}`,'--script-param',`moduleRoot=${join(root,'extension')}`,'--script',join(root,'scripts/batch.lua')],{cwd:directory,timeoutMs:30000,maxOutputBytes:65536});
      let decoded:unknown;
      try{decoded=JSON.parse((await boundedFile(request.resultPath,1024*1024)).toString('utf8'));}
      catch(error){if(error instanceof OperationError)throw error;throw new OperationError('INVALID_ARTIFACT','No valid file-job result was produced.');}
      const failed=z.object({ok:z.literal(false),error:z.object({code:z.enum(['STALE_STATE','EXPECTED_PIXELS_REQUIRED','OUTSIDE_MASK','COLOR_CONSTRAINT','LAYER_LOCKED','LINKED_CEL','UNSUPPORTED_COLOR_MODE','UNSUPPORTED_LAYER','LIMIT_EXCEEDED','INVALID_ARGUMENT','OPEN_FAILED','UNSUPPORTED_API','ROUNDTRIP_FAILED','COMMAND_FAILED','DOCUMENT_CLOSED','LAYER_MISSING']),message:z.string().max(512)})}).strict().safeParse(decoded);
      if(failed.success)throw new OperationError(failed.data.error.code,failed.data.error.message);
      const checked=result.safeParse(decoded);if(!checked.success)throw new OperationError('INVALID_ARTIFACT','The editor returned invalid file-job metadata.');
      const value=checked.data;
      if(value.document.layers.some((item,index)=>item.layerIndex!==index+1)||value.document.frames.some((item,index)=>item.frame!==index+1)||args.frame>value.document.frames.length)throw new OperationError('INVALID_ARTIFACT','File layer/frame indices do not match the reported structure.');
      if(args.region){
        const region=args.region;
        if(!value.pixels||value.pixels.length!==region.width*region.height||region.layerIndex>value.document.layers.length||region.frame>value.document.frames.length||value.pixels.some((item,index)=>item.x!==region.x+index%region.width||item.y!==region.y+Math.floor(index/region.width)))throw new OperationError('INVALID_ARTIFACT','Pixel inspection does not match the requested region.');
      }
      if(method==='batch_create_sprite'&&(value.document.width!==args.width||value.document.height!==args.height))throw new OperationError('INVALID_ARTIFACT','Created file dimensions do not match the request.');
      if(value.preview.frame!==args.frame||value.preview.width!==value.document.width||value.preview.height!==value.document.height)throw new OperationError('INVALID_ARTIFACT','File preview does not match the requested document and frame.');
      const png=encodePng(value.preview.width,value.preview.height,value.preview.rgbaHex,args.scale);
      if(inputPath&&sha256(await boundedFile(inputPath,64*1024*1024,128))!==inputSha256)throw new OperationError('STALE_FILE','Original saved source changed while the job ran. No result was published.');
      let source:string|undefined,sourceSha256=inputSha256;
      if(method!=='batch_inspect_sprite'){
        // Recheck all destinations before publishing. Exclusive creation remains
        // authoritative if another writer wins a race after this check.
        await this.files.target(args.filename,['.aseprite']);if(args.pngFilename)await this.files.target(args.pngFilename,['.png']);
        sourceSha256=sha256(await boundedFile(request.outputPath,64*1024*1024,128));
        source=await this.files.publish(request.outputPath,args.filename);
      }
      let exported:string|undefined;
      try{if(args.pngFilename)exported=await this.files.write(args.pngFilename,png);}
      catch{throw new OperationError('PARTIAL_EXPORT',source?`Source copy was saved to ${source}, but PNG publication failed. Inspect that source before retrying.`:'PNG publication failed. Original input was not changed.');}
      return {...value,inputFileSha256:inputSha256??null,fileSha256:sourceSha256??null,source:source??inputPath,png:exported??null,image:png,scale:args.scale};
    });}finally{this.running=false;}
  }
}
