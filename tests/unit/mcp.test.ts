import { expect,test } from 'bun:test';
import { resolve } from 'node:path';
test('official SDK client discovers registrations over real stdio using a disconnected test fixture',async()=>{
  // Inherit diagnostics: this sandbox also drops output on Bun-created socket pipes.
  // The Node fixture asserts the actual SDK results; its exit code reports failures.
  const process=Bun.spawn(['node',resolve('tests/fixtures/stdio-client.mjs'),globalThis.process.execPath],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await process.exited).toBe(0);
},15000);
test('official SDK connects to the production batch-only server without a listener or fabricated editor',async()=>{
  const child=Bun.spawn(['node',resolve('tests/fixtures/batch-stdio-client.mjs'),globalThis.process.execPath],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
},15000);
test('production startup remains discoverable over real stdio during an occupied-port error',async()=>{
  const child=Bun.spawn(['node',resolve('tests/fixtures/busy-stdio-client.mjs'),globalThis.process.execPath],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
},15000);
test('production MCP recovers from a synthetic port conflict on the same stdio connection',async()=>{
  const child=Bun.spawn(['node',resolve('tests/fixtures/recover-stdio-client.mjs'),globalThis.process.execPath],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
},15000);
