// Run the official SDK client in Node. Bun's child-process socket-backed pipes
// cannot send in this restricted workspace; Node uses normal OS pipes.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const directory = await mkdtemp(resolve(tmpdir(), 'aseprite-mcp-client-'));
const transport = new StdioClientTransport({
  command: process.argv[2], args: [resolve('tests/fixtures/stdio.ts')],
  env: { ASEPRITE_MCP_ASSETS: directory }, stderr: 'pipe',
});
const client = new Client({ name: 'test-client', version: '0.1.0' });
let diagnostics = '';
transport.stderr.on('data', chunk => { diagnostics += String(chunk); });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 35);
  assert(tools.some(tool => tool.name === 'draw_pixels'));
  assert(tools.some(tool => tool.name === 'get_animation_preview'));
  assert(tools.some(tool => tool.name === 'set_frame_duration'));
  assert(tools.some(tool => tool.name === 'create_animation_tag'));
  for(const name of ['duplicate_frame','copy_cel','move_cel','create_group','import_component','compare_frames','render_onion_skin','export_sprite_sheet','get_palette','set_palette_colors','get_selection','set_selection','transform_selection'])
    assert(tools.some(tool=>tool.name===name),`Missing ${name}`);
  assert(!tools.some(tool => tool.name === 'execute_lua'));
  assert(tools.some(tool=>tool.name==='batch_edit_sprite'));
  // Model-facing schemas need one homogeneous item schema per array. RGBA
  // remains four bytes, but positional tuple items can hide drawing tools in
  // clients that cannot translate that form into model function arguments.
  function inspectArrays(node,path) {
    if(!node||typeof node!=='object')return;
    if(node.type==='array') {
      assert(node.items&&typeof node.items==='object'&&!Array.isArray(node.items),`${path} has no homogeneous array item schema`);
      assert(!node.prefixItems,`${path} uses positional tuple items`);
    }
    for(const [key,value] of Object.entries(node)) {
      if(Array.isArray(value))value.forEach((entry,index)=>inspectArrays(entry,`${path}.${key}[${index}]`));
      else if(value&&typeof value==='object')inspectArrays(value,`${path}.${key}`);
    }
  }
  for(const tool of tools)inspectArrays(tool.inputSchema,tool.name);
  const batch=await client.callTool({name:'batch_status',arguments:{}});
  assert.equal(batch.structuredContent.result.workflow,'batch');
  assert.equal(batch.structuredContent.result.seesUnsavedChanges,false);
  const status = await client.callTool({ name: 'get_editor_status', arguments: {} });
  assert.equal(status.structuredContent.ok, true);
  assert.equal(status.structuredContent.result.connected, false);
  const error = await client.callTool({ name: 'list_documents', arguments: {} });
  assert.equal(error.isError, true);
  assert.equal(error.structuredContent.error.code, 'NOT_CONNECTED');
  const invalid = await client.callTool({ name: 'create_sprite', arguments: { width: -1, height: 32 } });
  assert.equal(invalid.isError, true);
  console.log(JSON.stringify({ ok: true, tools: tools.length, checks: ['discovery', 'animation-tools', 'status', 'disconnected-error', 'invalid-arguments'] }));
} catch (error) {
  if (diagnostics) console.error(diagnostics);
  throw error;
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
