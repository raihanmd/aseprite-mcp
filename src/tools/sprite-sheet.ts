import { z } from 'zod';
import { OperationError } from '../core/errors.ts';
import { encodePngRgba } from '../core/png.ts';

const tag = z.object({
  name:z.string().min(1).max(100),
  fromFrame:z.number().int().min(1).max(256),
  toFrame:z.number().int().min(1).max(256),
  direction:z.enum(['forward','reverse','ping_pong','ping_pong_reverse']),
  repeats:z.number().int().min(0).max(1000),
}).passthrough();
export const sheetDocument = z.object({
  documentId:z.string().min(1).max(80),
  width:z.number().int().min(1).max(256),
  height:z.number().int().min(1).max(256),
  frames:z.array(z.object({frame:z.number().int().min(1).max(256),durationMs:z.number().int().min(1).max(60000)})).min(1).max(256),
  tags:z.array(tag).max(256),
}).passthrough();
export type SheetDocument = z.infer<typeof sheetDocument>;
export const sheetPreview = z.object({
  documentId:z.string().min(1).max(80),
  frame:z.number().int().min(1).max(256),
  width:z.number().int().min(1).max(256),
  height:z.number().int().min(1).max(256),
  rgbaHex:z.string(),
}).passthrough();

export function sheetGeometry(width:number,height:number,frameCount:number,requestedColumns:number) {
  const columns=Math.min(requestedColumns,frameCount),rows=Math.ceil(frameCount/columns);
  const atlasWidth=columns*width,atlasHeight=rows*height;
  if(atlasWidth>4096||atlasHeight>4096||atlasWidth*atlasHeight>5_000_000)
    throw new OperationError('SHEET_TOO_LARGE','Sprite sheet exceeds 4096 pixels per side or 5 million atlas pixels. Use a smaller sprite or fewer frames.');
  return {columns,rows,width:atlasWidth,height:atlasHeight};
}

export function assembleSpriteSheet(document:SheetDocument,rgbaFrames:readonly string[],requestedColumns:number,imageFilename:string) {
  const {width,height,frames,tags}=document;
  if(rgbaFrames.length!==frames.length) throw new OperationError('INVALID_EDITOR_RESULT','Editor returned an incomplete animation.');
  for(let i=0;i<frames.length;i++) {
    if(frames[i]?.frame!==i+1) throw new OperationError('INVALID_EDITOR_RESULT','Editor frame numbers are not consecutive and 1-based.');
  }
  for(const entry of tags) {
    if(entry.fromFrame>entry.toFrame||entry.toFrame>frames.length)
      throw new OperationError('INVALID_EDITOR_RESULT','Editor returned a tag outside the animation frame range.');
  }
  const geometry=sheetGeometry(width,height,frames.length,requestedColumns);
  const pixels=Buffer.alloc(geometry.width*geometry.height*4);
  const entries=frames.map(({frame,durationMs},index)=>{
    const rgbaHex=rgbaFrames[index]!;
    if(rgbaHex.length!==width*height*8||!/^[0-9a-f]+$/i.test(rgbaHex))
      throw new OperationError('INVALID_PREVIEW','Editor returned invalid sprite sheet frame pixels.');
    const source=Buffer.from(rgbaHex,'hex');
    const x=(index%geometry.columns)*width,y=Math.floor(index/geometry.columns)*height;
    for(let row=0;row<height;row++) {
      source.copy(pixels,((y+row)*geometry.width+x)*4,row*width*4,(row+1)*width*4);
    }
    return {frame,x,y,width,height,durationMs};
  });
  const metadata={
    format:'aseprite-mcp/sprite-sheet-v1',
    image:imageFilename,
    size:{width:geometry.width,height:geometry.height},
    frameSize:{width,height},
    frameIndexBase:1,
    totalDurationMs:frames.reduce((sum,frame)=>sum+frame.durationMs,0),
    frames:entries,
    tags:tags.map(({name,fromFrame,toFrame,direction,repeats})=>({name,fromFrame,toFrame,direction,repeats})),
  };
  return {png:encodePngRgba(geometry.width,geometry.height,pixels),json:Buffer.from(JSON.stringify(metadata,null,2)+'\n'),metadata,geometry};
}
