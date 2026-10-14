import { expect, test } from 'bun:test';
test('real Lua module validates patches before mutation and preserves off-canvas cel data', async () => {
  const child=Bun.spawn(['lua','tests/fixtures/operations.lua'],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
});
