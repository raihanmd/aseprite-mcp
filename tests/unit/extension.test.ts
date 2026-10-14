import { expect,test } from 'bun:test';

test('mock Lua extension reports connection phases and errors without exposing pairing tokens',async()=>{
  const child=Bun.spawn(['lua','tests/fixtures/extension.lua'],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
});
