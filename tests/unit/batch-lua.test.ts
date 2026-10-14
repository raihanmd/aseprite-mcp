import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('real batch Lua reuses bounded operations, checks reopened copies and rejects UI/stale data',async()=>{
  for(const scenario of ['create','edit','stale','roundtrip','ui']){
    const root=await mkdtemp(join(tmpdir(),'aseprite-batch-lua-'));
    try{
      const child=Bun.spawn(['lua','tests/fixtures/batch.lua',root,scenario],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
      expect(await child.exited).toBe(0);
      const result=await Bun.file(join(root,'result.json')).json();
      if(scenario==='create'||scenario==='edit'){
        expect(result.ok).toBe(true);expect(result.workflow).toBe('batch');expect(result.preview.rgbaHex).toBe(scenario==='create'?'ff0000ff00000000':'0000ffff00000000');
        expect(result.document.layers[1]).toMatchObject({layerIndex:2,name:'Art'});expect(result.document.layers[1].layerId).toBeUndefined();
      }else{expect(result.ok).toBe(false);expect(result.error.code).toBe(scenario==='stale'?'STALE_STATE':scenario==='ui'?'UNSUPPORTED_API':'ROUNDTRIP_FAILED');}
    }finally{await rm(root,{recursive:true,force:true});}
  }
});
