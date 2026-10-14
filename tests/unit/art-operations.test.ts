import { expect, test } from 'bun:test';
import { artSchemas } from '../../src/tools/art_contracts.ts';

test('art tool schemas require explicit expectations and constrain transforms', () => {
  const target={documentId:'doc',layerId:'layer',frame:1};
  const key='0123456789abcdef';
  expect(artSchemas.set_palette_colors.safeParse({documentId:'doc',expectedSize:2,colors:[{index:1,rgba:[0,0,255,255],expected:[255,0,0,255]}]}).success).toBe(true);
  expect(artSchemas.set_palette_colors.safeParse({documentId:'doc',expectedSize:2,colors:[{index:1,rgba:[0,0,256,255]}]}).success).toBe(false);
  expect(artSchemas.set_selection.safeParse({documentId:'doc',expectedSelectionKey:key,mode:'replace',rectangle:{x:1,y:1,width:2,height:1}}).success).toBe(true);
  expect(artSchemas.set_selection.safeParse({documentId:'doc',expectedSelectionKey:key,mode:'clear',rectangle:{x:1,y:1,width:2,height:1}}).success).toBe(false);
  expect(artSchemas.transform_selection.safeParse({...target,expectedSelectionKey:key,expectedPixelKey:key,operation:'flip_h'}).success).toBe(true);
  expect(artSchemas.transform_selection.safeParse({...target,expectedSelectionKey:key,expectedPixelKey:key,operation:'translate',dx:1,dy:0}).success).toBe(true);
  expect(artSchemas.transform_selection.safeParse({...target,expectedSelectionKey:key,expectedPixelKey:key,operation:'translate',dx:1}).success).toBe(false);
  expect(artSchemas.transform_selection.safeParse({...target,expectedSelectionKey:key,expectedPixelKey:key,operation:'flip_h',dx:1}).success).toBe(false);
});

test('real art Lua module rejects stale edits and preserves unaffected pixels', async () => {
  const child=Bun.spawn(['lua','tests/fixtures/art_operations.lua'],{stdin:'ignore',stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
});
