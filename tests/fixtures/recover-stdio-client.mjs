import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const directory=await mkdtemp(resolve(tmpdir(),'aseprite-recover-stdio-'));
const transport=new StdioClientTransport({command:process.argv[2],args:[resolve('tests/fixtures/recover-stdio.ts')],env:{ASEPRITE_MCP_ASSETS:directory,ASEPRITE_MCP_EXECUTABLE:''},stderr:'pipe'});
transport.stderr.on('data',()=>{});
const client=new Client({name:'recover-production-startup-test',version:'1'});
try{
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length,35);
  const busy=await client.callTool({name:'get_editor_status',arguments:{}});
  assert.equal(busy.isError,true);assert.equal(busy.structuredContent.error.code,'LIVE_PORT_IN_USE');
  assert.ok(!JSON.stringify(busy).includes('private synthetic bind diagnostic'));
  const recovered=await client.callTool({name:'get_editor_status',arguments:{}});
  assert.notEqual(recovered.isError,true);
  assert.equal(recovered.structuredContent.result.connected,false);
  assert.equal(recovered.structuredContent.result.port,32123);
  assert.equal(recovered.structuredContent.result.bindAttempts,3);
  const unpaired=await client.callTool({name:'list_documents',arguments:{}});
  assert.equal(unpaired.isError,true);assert.equal(unpaired.structuredContent.error.code,'NOT_CONNECTED');
  assert.equal((await client.listTools()).tools.length,35);
  const stable=await client.callTool({name:'get_editor_status',arguments:{}});
  assert.equal(stable.structuredContent.result.bindAttempts,3);
  assert.deepEqual((await readdir(directory)).filter(name=>name.endsWith('.aseprite')||name.endsWith('.png')),[]);
  console.log(JSON.stringify({ok:true,productionStartup:true,syntheticPortRecovery:true,tools:35,editorVerified:false,checks:['busy-status','same-stdio-recovery','pairing-still-required','no-rebind-after-acquisition','no-art-output']}));
}finally{await client.close();await rm(directory,{recursive:true,force:true});}
