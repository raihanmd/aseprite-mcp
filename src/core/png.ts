import { deflateSync } from 'node:zlib';
import { OperationError } from './errors.ts';
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type), size=Buffer.alloc(4), crc=Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,crc]);
}
export function encodePng(width: number, height: number, hex: string, scale=1): Buffer {
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256||!Number.isInteger(scale)||scale<1||scale>8||!/^[0-9a-f]*$/i.test(hex)||hex.length!==width*height*8) throw new OperationError('INVALID_PREVIEW','Editor returned invalid RGBA preview data.');
  const pixels=Buffer.from(hex,'hex'), w=width*scale, h=height*scale;
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) pixels.copy(raw,y*(w*4+1)+1+x*4,(Math.floor(y/scale)*width+Math.floor(x/scale))*4,(Math.floor(y/scale)*width+Math.floor(x/scale))*4+4);
  const header=Buffer.alloc(13); header.writeUInt32BE(w,0); header.writeUInt32BE(h,4); header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

/** Encode already composed RGBA pixels for bounded multi-frame contact sheets. */
export function encodePngRgba(width: number, height: number, pixels: Uint8Array): Buffer {
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>5_000_000||pixels.length!==width*height*4) {
    throw new OperationError('INVALID_PREVIEW','Animation contact sheet dimensions or RGBA data are invalid.');
  }
  const raw=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) raw.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  const header=Buffer.alloc(13); header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
