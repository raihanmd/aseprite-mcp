// Explicit desktop verification: creates only uniquely named saved test copies.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {assertRevision,inspectPreview} from './check-editor.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function call(client,name,args={}){
  const response=await client.callTool({name,arguments:args});
  assert(!response.isError&&response.structuredContent?.ok===true,`${name} failed (${response.structuredContent?.error?.code??'invalid response'}).`);
  return response;
}
export async function verifyBatch(client){
  const status=(await call(client,'batch_status')).structuredContent.result;
  assert(status.configured,'Set ASEPRITE_MCP_EXECUTABLE to the absolute Aseprite executable path first.');
  const prefix=`batch-check-${randomUUID()}`,filename=`${prefix}-original.aseprite`,revisedFilename=`${prefix}-revision.aseprite`;
  const red=[255,0,0,255],blue=[0,0,255,255],green=[0,255,0,255];
  const made=await call(client,'batch_create_sprite',{width:8,height:8,name:'MCP file test',layerName:'Art',filename,pixels:[{x:1,y:1,rgba:red},{x:6,y:6,rgba:green}]});
  const initial=made.structuredContent.result;
  const layerIndex=initial.document.layers.find(item=>item.name==='Art').layerIndex;
  const region={layerIndex,frame:1,x:0,y:0,width:8,height:8};
  const before=(await call(client,'batch_inspect_sprite',{filename,region})).structuredContent.result;
  assert.equal(before.fileSha256,initial.fileSha256);
  const revised=await call(client,'batch_edit_sprite',{inputFilename:filename,expectedFileSha256:before.fileSha256,filename:revisedFilename,pngFilename:`${prefix}.png`,operations:[{method:'draw_pixels',layerIndex,frame:1,allowedMask:[{x:1,y:1}],allowedColors:[blue],pixels:[{x:1,y:1,rgba:blue,expected:red}]}]});
  inspectPreview(revised,blue,green);
  const after=(await call(client,'batch_inspect_sprite',{filename:revisedFilename,region})).structuredContent.result;
  assertRevision(before.pixels,after.pixels,new Map([['1,1',blue]]));
  assert.notEqual(before.fileSha256,after.fileSha256);
  const original=(await call(client,'batch_inspect_sprite',{filename,region})).structuredContent.result;
  assert.equal(original.fileSha256,before.fileSha256);assertRevision(before.pixels,original.pixels,new Map());
  const stale=await client.callTool({name:'batch_edit_sprite',arguments:{inputFilename:filename,expectedFileSha256:'0'.repeat(64),filename:`${prefix}-rejected.aseprite`,operations:[{method:'undo'}]}});
  assert(stale.isError&&stale.structuredContent?.error?.code==='STALE_FILE','Stale saved-file hashes must be rejected.');
  const duplicate=await client.callTool({name:'batch_create_sprite',arguments:{width:8,height:8,filename}});
  assert(duplicate.isError&&duplicate.structuredContent?.error?.code==='FILE_EXISTS','Existing source files must not be overwritten.');
  return {ok:true,workflow:'batch',editorVersion:after.editorVersion,apiVersion:after.apiVersion,original:initial.source,revision:after.source,png:revised.structuredContent.result.png,
    checks:['create','reopen-inspect','targeted-revision','protected-pixels','preview-pixels','original-unchanged','stale-file-rejection','exclusive-output'],productionClientsTested:false};
}
async function main(){
  console.error('This creates separate saved test files only. It does not control the open editor or read unsaved artwork.');
  const transport=new StdioClientTransport({command:process.env.ASEPRITE_MCP_BUN??'bun',args:[resolve(root,'scripts/launch.ts')],env:{ASEPRITE_MCP_MODE:'batch',...(process.env.ASEPRITE_MCP_EXECUTABLE===undefined?{}:{ASEPRITE_MCP_EXECUTABLE:process.env.ASEPRITE_MCP_EXECUTABLE})},stderr:'pipe'});
  let diagnostics='';transport.stderr.on('data',chunk=>{diagnostics=(diagnostics+String(chunk)).slice(-8192);});
  const client=new Client({name:'aseprite-file-workflow-check',version:'1'});
  try{await client.connect(transport);console.log(JSON.stringify(await verifyBatch(client),null,2));}
  catch(error){console.error(`File workflow check failed: ${error.message}`);if(diagnostics)console.error(diagnostics);process.exitCode=1;}
  finally{await client.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
