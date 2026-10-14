import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { resolve, join, dirname, basename } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { EditorBridge } from '../bridge/server.ts';
import type { ShareableEditorBridge } from '../bridge/availability.ts';
import { openEditorBridge } from '../bridge/availability.ts';
import { failure, OperationError } from '../core/errors.ts';
import { encodePng, encodePngRgba } from '../core/png.ts';
import { ProjectFiles } from '../security/files.ts';
import { schemas, mutating } from '../tools/contracts.ts';
import { rasterizeShapes } from '../tools/shapes.ts';
import { assembleSpriteSheet, sheetDocument, sheetGeometry, sheetPreview } from '../tools/sprite-sheet.ts';
import {batchSchemas,type BatchMethod} from '../batch/contracts.ts';
import {BatchRunner,type BatchClient} from '../batch/runner.ts';

const preview=z.object({documentId:z.string(),frame:z.number().int(),width:z.number().int(),height:z.number().int(),rgbaHex:z.string()});
const output=z.object({ok:z.boolean(),sessionId:z.string().nullable().optional(),result:z.unknown().optional(),error:z.object({code:z.string(),message:z.string()}).optional()});
const descriptions:Record<string,string>={
  get_editor_status:'Inspect the local editor connection; does not edit anything.',
  list_documents:'List currently open sprites. Use returned handles for subsequent calls.',
  get_document_info:'Inspect current layers, cels (positions and linked status), frame durations, dimensions and modified state. Re-read after user edits.',
  create_sprite:'Create and display an RGB sprite, 1–256 pixels per dimension, for editable pixel art.',
  create_layer:'Create an ordinary editable image layer in a specific document.',
  read_pixels:'Read exact layer RGBA pixels in canvas coordinates (0-based); frames start at 1. At most 16384 pixels.',
  draw_pixels:'Apply one undoable bounded pixel patch. Existing cels require expected RGBA for every edited pixel. Reject stale pixels, locks, linked cels, duplicate coordinates, mask escapes and disallowed colors. Other pixels are preserved.',
  draw_shapes:'Draw filled rectangles, pixel lines, filled ellipses, and filled polygons as one undoable edit on transparent target pixels. Shapes are rasterized by this MCP; the editor still verifies every pixel is clear. For revision over painted pixels, inspect and use draw_pixels.',
  get_preview:'Render the current unsaved frame as a PNG. Scale 1 is native size; scale 2–8 enlarges without smoothing.',
  get_animation_preview:'Render up to 16 consecutive, fully composited animation frames as a nearest-neighbor contact sheet, with frame timing and tags. Read-only; inspect this before accepting or revising a cycle.',
  undo:'Undo the latest change on the specified document, including manual changes. Inspect first; never use as an automatic rollback after later user edits.',
  redo:'Redo the latest undone change on the specified document.',
  add_frame:'Append an empty frame with the requested duration in milliseconds; maximum 256 frames.',
  duplicate_frame:'Append an independent copy of every cel in an existing frame, preserving its duration. This does not create linked cels or change existing frames.',
  copy_cel:'Copy one layer cel to an empty target frame as an independent image. Reject a target that already contains a cel.',
  move_cel:'Translate one cel by integer pixels in its frame as one undoable edit. By default reject any position outside the canvas; allowOffCanvas must be explicit.',
  set_frame_duration:'Set one existing frame duration in milliseconds as one undoable change.',
  create_animation_tag:'Name an existing frame range as an animation clip and set its playback direction/repeat count. Rejects duplicate tag names.',
  set_layer_properties:'Change image-layer visibility or opacity in one undoable operation.',
  get_palette:'Read the sprite palette and its indexed RGBA colors before a constrained palette edit.',
  set_palette_colors:'Edit specified palette entries in one undoable operation; require the inspected palette size and old colors for existing entries.',
  get_selection:'Inspect the editor selection, rectangular bounds and freshness keys; with layerId and frame also inspect selected cel pixels.',
  set_selection:'Replace or clear the editor selection only if it matches the inspected selection key. Selection is shared by the open sprite.',
  transform_selection:'Flip, quarter-rotate, or translate selected pixels on one layer and frame; reject stale source, linked cels, occupied destination and canvas overflow.',
};

type ContactFrame = { frame:number; durationMs:number; rgbaHex:string };
function encodeContactSheet(width:number,height:number,frames:ContactFrame[],columns:number,scale:number) {
  const cols=Math.min(columns,frames.length),rows=Math.ceil(frames.length/cols),gutter=2*scale;
  const tileWidth=width*scale,tileHeight=height*scale;
  const sheetWidth=cols*tileWidth+(cols+1)*gutter,sheetHeight=rows*tileHeight+(rows+1)*gutter;
  if(sheetWidth>4096||sheetHeight>4096||sheetWidth*sheetHeight>5_000_000) throw new OperationError('INVALID_PREVIEW','Animation contact sheet exceeds the safe preview size. Reduce scale or frame count.');
  const canvas=Buffer.alloc(sheetWidth*sheetHeight*4);
  for(let i=0;i<canvas.length;i+=4){canvas[i]=28;canvas[i+1]=32;canvas[i+2]=40;canvas[i+3]=255;}
  for(let index=0;index<frames.length;index++) {
    const frame=frames[index];
    if(!frame||!/^[0-9a-f]+$/i.test(frame.rgbaHex)||frame.rgbaHex.length!==width*height*8) throw new OperationError('INVALID_PREVIEW','Editor returned invalid animation frame pixels.');
    const source=Buffer.from(frame.rgbaHex,'hex');
    const left=gutter+(index%cols)*(tileWidth+gutter),top=gutter+Math.floor(index/cols)*(tileHeight+gutter);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const sourceOffset=(y*width+x)*4,alpha=source[sourceOffset+3]!/255;
      if(alpha===0) continue;
      const destR=Math.round(source[sourceOffset]!*alpha+28*(1-alpha));
      const destG=Math.round(source[sourceOffset+1]!*alpha+32*(1-alpha));
      const destB=Math.round(source[sourceOffset+2]!*alpha+40*(1-alpha));
      for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) {
        const offset=((top+y*scale+dy)*sheetWidth+left+x*scale+dx)*4;
        canvas[offset]=destR;canvas[offset+1]=destG;canvas[offset+2]=destB;canvas[offset+3]=255;
      }
    }
  }
  return {png:encodePngRgba(sheetWidth,sheetHeight,canvas),width:sheetWidth,height:sheetHeight,columns:cols,rows,scale};
}

export type EditorClient = Pick<EditorBridge,'status'|'call'> & Pick<ShareableEditorBridge,'statusAsync'>;
export function createMcp(bridge:EditorClient,files:ProjectFiles,batch:BatchClient=new BatchRunner(files)) {
  const server=new McpServer({name:'aseprite-mcp',version:'0.2.0'});
  const reply=(result:unknown):CallToolResult=>({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result as Record<string,unknown>});
  async function guard(operation:()=>Promise<CallToolResult>):Promise<CallToolResult> {
    try{return await operation();}catch(error){const result=failure(error);return {...reply(result),isError:true};}
  }
  const currentStatus=()=>bridge.statusAsync?bridge.statusAsync():Promise.resolve(bridge.status());
  for (const [name,schema] of Object.entries(schemas)) {
    server.registerTool(name,{description:descriptions[name]!,inputSchema:schema,outputSchema:output,annotations:{readOnlyHint:!mutating.has(name),destructiveHint:mutating.has(name),openWorldHint:false}},async (raw:unknown)=>guard(async()=>{
      const params=schema.parse(raw) as Record<string,unknown>;
      if(name==='get_editor_status') return reply({ok:true,result:await currentStatus()});
      if(name==='draw_shapes') {
        const draft=schemas.draw_shapes.parse(raw);
        const sessionId=(await currentStatus()).sessionId;
        const document=z.object({width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256)}).passthrough().parse(await bridge.call('get_document_info',{documentId:draft.documentId},false));
        const pixels=rasterizeShapes(draft.shapes,document.width,document.height);
        const value=await bridge.call('draw_pixels',{documentId:draft.documentId,layerId:draft.layerId,frame:draft.frame,pixels,allowedMask:draft.allowedMask,allowedColors:draft.allowedColors,label:draft.label},true);
        return reply({ok:true,sessionId,result:{...value as Record<string,unknown>,shapeCount:draft.shapes.length}});
      }
      const sessionId=(await currentStatus()).sessionId;
      if(name==='get_animation_preview') {
        const document=z.object({documentId:z.string(),width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256),frames:z.array(z.object({frame:z.number().int().min(1).max(256),durationMs:z.number().int().min(1).max(60000)})).max(256),tags:z.array(z.unknown()).optional()}).passthrough().parse(await bridge.call('get_document_info',{documentId:params.documentId},false));
        if(document.frames.length===0) throw new OperationError('INVALID_EDITOR_RESULT','The editor returned no animation frames.');
        const startFrame=Number(params.startFrame),requestedCount=Number(params.frameCount);
        if(startFrame>document.frames.length) throw new OperationError('INVALID_ARGUMENT','startFrame is after the last frame in this sprite.');
        const count=Math.min(requestedCount,document.frames.length-startFrame+1);
        const frames:ContactFrame[]=[];
        for(let index=0;index<count;index++) {
          const frameNumber=startFrame+index;
          const image=preview.parse(await bridge.call('get_preview',{documentId:params.documentId,frame:frameNumber},false));
          if(image.width!==document.width||image.height!==document.height) throw new OperationError('INVALID_PREVIEW','Animation frame dimensions do not match the sprite canvas.');
          const timing=document.frames[frameNumber-1];
          if(!timing) throw new OperationError('INVALID_EDITOR_RESULT','The editor omitted timing for an animation frame.');
          frames.push({frame:frameNumber,durationMs:timing.durationMs,rgbaHex:image.rgbaHex});
        }
        const sheet=encodeContactSheet(document.width,document.height,frames,Number(params.columns),Number(params.scale));
        const result={
          ok:true,sessionId,
          result:{documentId:document.documentId,startFrame,frameCount:frames.length,totalFrames:document.frames.length,totalDurationMs:document.frames.reduce((sum,frame)=>sum+frame.durationMs,0),truncated:frames.length<requestedCount,tags:document.tags??[],frames:frames.map(({frame,durationMs})=>({frame,durationMs})),contactSheet:{width:sheet.width,height:sheet.height,columns:sheet.columns,rows:sheet.rows,scale:sheet.scale}},
        };
        return {...reply(result),content:[{type:'image',mimeType:'image/png',data:sheet.png.toString('base64')},{type:'text',text:JSON.stringify(result)}]};
      }
      const value=await bridge.call(name,params,mutating.has(name));
      if(name==='get_preview') {
        const image=preview.parse(value), scale=Number(params.scale);
        const bytes=encodePng(image.width,image.height,image.rgbaHex,scale);
        const result={ok:true,sessionId,result:{documentId:image.documentId,frame:image.frame,width:image.width*scale,height:image.height*scale,scale}};
        return {...reply(result),content:[{type:'image',mimeType:'image/png',data:bytes.toString('base64')},{type:'text',text:JSON.stringify(result)}]};
      }
      return reply({ok:true,sessionId,result:value});
    }));
  }
  const fileArgs=z.object({documentId:z.string().min(1).max(80),filename:z.string().min(1).max(240)}).strict();
  server.registerTool('save_sprite',{description:'Save an editable .aseprite COPY in the asset directory. Does not change the live document filename or saved state. Never overwrites existing files.',inputSchema:fileArgs,outputSchema:output,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},async params=>guard(async()=>{
    await files.target(params.filename,['.aseprite']);
    const path=await files.stage(async directory=>{
      const stagingPath=join(directory,'source.aseprite');
      await bridge.call('save_copy',{documentId:params.documentId,stagingPath},true);
      return files.publish(stagingPath,params.filename);
    });
    return reply({ok:true,result:{path,savedCopy:true,liveSavedStateUnchanged:true}});
  }));
  server.registerTool('export_sprite',{description:'Export a rendered live frame to a new PNG inside the asset directory; does not flatten the source or overwrite files.',inputSchema:fileArgs.extend({frame:z.number().int().min(1).max(256).default(1)}),outputSchema:output,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},async params=>guard(async()=>{
    await files.target(params.filename,['.png']);
    const image=preview.parse(await bridge.call('get_preview',{documentId:params.documentId,frame:params.frame}));
    const path=await files.write(params.filename,encodePng(image.width,image.height,image.rgbaHex));
    return reply({ok:true,result:{path,width:image.width,height:image.height,frame:image.frame}});
  }));
  const sheetArgs=z.object({
    documentId:z.string().min(1).max(80),
    pngFilename:z.string().min(1).max(240),
    jsonFilename:z.string().min(1).max(240),
    columns:z.number().int().min(1).max(16).default(8),
  }).strict();
  server.registerTool('export_sprite_sheet',{description:'Export every frame of the current unsaved live sprite to a transparent PNG atlas and 1-based JSON timing/tag manifest. Both new filenames must share a directory inside the asset root; never overwrites. If only the PNG is published, the error identifies the retained partial export.',inputSchema:sheetArgs,outputSchema:output,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},async params=>guard(async()=>{
    const pngTarget=await files.target(params.pngFilename,['.png']);
    const jsonTarget=await files.target(params.jsonFilename,['.json']);
    if(dirname(pngTarget)!==dirname(jsonTarget)) throw new OperationError('INVALID_PATH','PNG and JSON must be in the same asset directory.');
    const parseDocument=(value:unknown)=>{
      const parsed=sheetDocument.safeParse(value);
      if(!parsed.success) throw new OperationError('INVALID_EDITOR_RESULT','Editor returned invalid sprite sheet dimensions, timing, or tags.');
      if(parsed.data.documentId!==params.documentId) throw new OperationError('INVALID_EDITOR_RESULT','Editor returned a different document.');
      return parsed.data;
    };
    const document=parseDocument(await bridge.call('get_document_info',{documentId:params.documentId},false));
    sheetGeometry(document.width,document.height,document.frames.length,params.columns);
    const frames:string[]=[];
    for(let frame=1;frame<=document.frames.length;frame++) {
      const parsed=sheetPreview.safeParse(await bridge.call('get_preview',{documentId:params.documentId,frame},false));
      if(!parsed.success) throw new OperationError('INVALID_PREVIEW','Editor returned invalid sprite sheet frame data.');
      const image=parsed.data;
      if(image.documentId!==params.documentId||image.frame!==frame||image.width!==document.width||image.height!==document.height)
        throw new OperationError('INVALID_PREVIEW','Editor returned a frame from a different document or canvas.');
      frames.push(image.rgbaHex);
    }
    const after=parseDocument(await bridge.call('get_document_info',{documentId:params.documentId},false));
    const signature=(value:typeof document)=>JSON.stringify({width:value.width,height:value.height,frames:value.frames,tags:value.tags});
    if(signature(after)!==signature(document)) throw new OperationError('STALE_DOCUMENT','Sprite dimensions, timing, or tags changed during export. No files were written; retry after edits stop.');
    const artifact=assembleSpriteSheet(document,frames,params.columns,basename(pngTarget));
    const paths=await files.stage(async directory=>{
      const stagedPng=join(directory,'atlas.png'),stagedJson=join(directory,'atlas.json');
      await writeFile(stagedPng,artifact.png,{flag:'wx',mode:0o600});
      await writeFile(stagedJson,artifact.json,{flag:'wx',mode:0o600});
      const checkedPng=await readFile(stagedPng),checkedJson=await readFile(stagedJson);
      if(!checkedPng.equals(artifact.png)||!checkedJson.equals(artifact.json)||
        checkedPng.readUInt32BE(16)!==artifact.geometry.width||
        checkedPng.readUInt32BE(20)!==artifact.geometry.height||
        JSON.parse(checkedJson.toString()).frames.length!==document.frames.length)
        throw new OperationError('INVALID_ARTIFACT','Staged sprite sheet failed verification; no output was published.');
      const pngPath=await files.publishReadyFile(stagedPng,params.pngFilename,['.png']);
      try {
        const jsonPath=await files.publishReadyFile(stagedJson,params.jsonFilename,['.json']);
        return {pngPath,jsonPath};
      } catch {
        throw new OperationError('PARTIAL_EXPORT',`PNG was published at ${pngPath}, but JSON publication failed. The PNG was retained. Inspect ${jsonTarget} before retrying with new filenames.`);
      }
    });
    return reply({ok:true,result:{...paths,width:artifact.geometry.width,height:artifact.geometry.height,frameCount:document.frames.length,columns:artifact.geometry.columns,rows:artifact.geometry.rows,totalDurationMs:artifact.metadata.totalDurationMs,tags:artifact.metadata.tags,liveSavedStateUnchanged:true}});
  }));
  const batchDescriptions:Record<keyof typeof batchSchemas,string>={
    batch_status:'Inspect file-job configuration. Does not start Aseprite and does not verify its behavior. Batch cannot see unsaved editor changes.',
    batch_create_sprite:'FILE ONLY: create an RGB source copy using a separate Aseprite --batch process, with an Art layer and optional pixels. Explicit new filename required. Returns a PNG preview; pngFilename optionally saves it. Never changes open artwork or overwrites files.',
    batch_inspect_sprite:'FILE ONLY: inspect a saved source, obtain its SHA256 and 1-based flattened layer indices, optionally read exact layer pixels, and return a rendered PNG preview. No live handles or unsaved changes are accessible.',
    batch_edit_sprite:'FILE ONLY: revise a saved source into a NEW filename. Requires its inspected SHA256 and named bounded operations; layerIndex comes from batch_inspect_sprite. Reuses live patch safeguards. Undo/redo apply only within this job, not to older saved versions. Never edits the original or falls back from live tools.',
  };
  for(const [name,schema] of Object.entries(batchSchemas)){
    server.registerTool(name,{description:batchDescriptions[name as keyof typeof batchSchemas],inputSchema:schema,outputSchema:output,annotations:{readOnlyHint:name==='batch_status',destructiveHint:false,openWorldHint:false}},async (raw:unknown)=>guard(async()=>{
      if(name==='batch_status')return reply({ok:true,result:batch.status()});
      const {image,preview:rendered,...value}=await batch.execute(name as BatchMethod,raw);
      const result={ok:true,result:{...value,preview:{frame:rendered.frame,width:rendered.width*value.scale,height:rendered.height*value.scale,scale:value.scale}}};
      return {...reply(result),content:[{type:'image',mimeType:'image/png',data:image.toString('base64')},{type:'text',text:JSON.stringify(result)}]};
    }));
  }
  return server;
}
export async function startServer(createBridge = openEditorBridge) {
  const mode=process.env.ASEPRITE_MCP_MODE??'live';
  if(mode!=='live'&&mode!=='batch')throw new OperationError('INVALID_MODE','Choose ASEPRITE_MCP_MODE=live or batch explicitly.');
  const token=process.env.ASEPRITE_MCP_TOKEN;
  if(mode==='live'&&!token) throw new OperationError('SETUP_REQUIRED','Run bun scripts/setup.ts to create local pairing configuration.');
  const port=Number(process.env.ASEPRITE_MCP_PORT??32123);
  if(!Number.isInteger(port)||port<0||port>65535) throw new OperationError('INVALID_PORT','Invalid local bridge port.');
  const files=await ProjectFiles.create(resolve(process.env.ASEPRITE_MCP_ASSETS??'assets'));
  // Batch-only startup is an explicit configuration, never a response to a
  // connection error. Live tools remain visible but reject calls in this mode.
  const live=mode==='live'?createBridge(token!,port):null;
  const bridge=live?.bridge??{
    status:()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:0}),
    call:async()=>{throw new OperationError('LIVE_DISABLED','This server was explicitly started in batch-only mode. Use file tools or restart in live mode.');},
    close:()=>{},
  };
  const server=createMcp(bridge,files);
  const transport=new StdioServerTransport();
  let closing=false;
  const close=async()=>{if(closing)return;closing=true;bridge.close();await server.close();};
  transport.onclose=()=>{void close();};
  process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
  await server.connect(transport);
  // The SDK attaches its own close handler; observe end independently to release the port.
  process.stdin.once('end',()=>{void close();});
  console.error(live?.portInUse?`Aseprite MCP tools ready; local port ${port} is in use. Live status checks and calls will retry binding after its owner releases it.`:mode==='live'?'Aseprite MCP ready; connect the editor extension.':'Aseprite MCP ready in explicit file-only mode; open editor changes are not accessible.');
  return {server,bridge,close};
}
if(import.meta.main) startServer().catch(error=>{console.error(failure(error).error.message);process.exitCode=1;});
