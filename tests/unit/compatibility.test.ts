import {expect,test} from 'bun:test';
test('Lua compatibility policy detects missing features without pinning one exact editor version',async()=>{
  const child=Bun.spawn(['lua','tests/fixtures/compatibility.lua'],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
});
