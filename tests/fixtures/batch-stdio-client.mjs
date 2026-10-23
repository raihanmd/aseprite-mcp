// Actual production server, explicit batch-only mode. No editor is simulated
// here and no Aseprite executable is configured: verify honest error paths.
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';

const directory=await mkdtemp(resolve(tmpdir(),'aseprite-production-stdio-'));
const transport=new StdioClientTransport({command:process.argv[2],args:[resolve('src/mcp/server.ts')],env:{ASEPRITE_MCP_MODE:'batch',ASEPRITE_MCP_ASSETS:directory,ASEPRITE_MCP_EXECUTABLE:''},stderr:'pipe'});
let diagnostics='';transport.stderr.on('data',chunk=>{diagnostics=(diagnostics+String(chunk)).slice(-8192);});
const client=new Client({name:'production-batch-startup-test',version:'1'});
try{
  await client.connect(transport);
  const {tools}=await client.listTools();assert.equal(tools.length,35);
  const status=await client.callTool({name:'batch_status',arguments:{}});
  assert.equal(status.structuredContent.result.configured,false);assert.equal(status.structuredContent.result.workflowVerified,false);
  const live=await client.callTool({name:'list_documents',arguments:{}});assert.equal(live.isError,true);assert.equal(live.structuredContent.error.code,'LIVE_DISABLED');
  const unavailable=await client.callTool({name:'batch_create_sprite',arguments:{width:2,height:1,filename:'not-created.aseprite'}});
  assert.equal(unavailable.isError,true);assert.equal(unavailable.structuredContent.error.code,'BATCH_UNAVAILABLE');
  console.log(JSON.stringify({ok:true,productionServer:true,mode:'batch',tools:tools.length,editorVerified:false,checks:['startup','discovery','live-disabled','missing-executable']}));
}catch(error){if(diagnostics)console.error(diagnostics);throw error;}
finally{await client.close();await rm(directory,{recursive:true,force:true});}
