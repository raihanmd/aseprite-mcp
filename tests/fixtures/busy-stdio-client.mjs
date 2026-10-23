import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const directory=await mkdtemp(resolve(tmpdir(),'aseprite-busy-stdio-'));
const transport=new StdioClientTransport({command:process.argv[2],args:[resolve('tests/fixtures/busy-stdio.ts')],env:{ASEPRITE_MCP_ASSETS:directory,ASEPRITE_MCP_EXECUTABLE:''},stderr:'pipe'});
transport.stderr.on('data',()=>{});
const client=new Client({name:'busy-production-startup-test',version:'1'});
try{
  await client.connect(transport);
  const {tools}=await client.listTools();assert.equal(tools.length,35);
  for(const name of ['get_editor_status','list_documents']){
    const result=await client.callTool({name,arguments:{}});
    assert.equal(result.isError,true);assert.equal(result.structuredContent.error.code,'LIVE_PORT_IN_USE');
  }
  console.log(JSON.stringify({ok:true,productionStartup:true,syntheticPortConflict:true,tools:tools.length,editorVerified:false,checks:['discovery','honest-status-error','no-live-control']}));
}finally{await client.close();await rm(directory,{recursive:true,force:true});}
