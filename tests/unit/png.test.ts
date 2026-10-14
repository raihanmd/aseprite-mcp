import { expect,test } from 'bun:test';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../../src/core/png.ts';
test('PNG contains exact RGBA values and nearest-neighbor enlargement',()=>{
  const png=encodePng(2,1,'ff0000ff0000ff80',2);
  expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  expect(png.readUInt32BE(16)).toBe(4);expect(png.readUInt32BE(20)).toBe(2);
  const idatLength=png.readUInt32BE(33);const raw=inflateSync(png.subarray(41,41+idatLength));
  expect([...raw.subarray(1,17)]).toEqual([255,0,0,255,255,0,0,255,0,0,255,128,0,0,255,128]);expect(raw.subarray(0,17)).toEqual(raw.subarray(17,34));
});
test('preview bounds and byte lengths are validated before allocating',()=>{
  expect(()=>encodePng(257,1,'')).toThrow();expect(()=>encodePng(1,1,'nothex!!')).toThrow();expect(()=>encodePng(1,1,'ff0000',1)).toThrow();
});
