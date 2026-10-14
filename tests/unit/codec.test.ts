import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('Lua message codec normalizes native-like userdata and preserves JSON array/string semantics',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-codec-'));
  try {
    const file=join(root,'result.json');
    const child=Bun.spawn(['lua','tests/fixtures/codec.lua',file],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
    expect(await child.exited).toBe(0);
    expect(await Bun.file(file).json()).toEqual({pixels:[{x:1,y:2,rgba:[255,0,0,255]}],empty:[],flag:false,name:'quote"\\\n雨'});
  } finally {await rm(root,{recursive:true,force:true});}
});
