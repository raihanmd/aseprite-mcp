import { z } from 'zod';
import { OperationError } from '../core/errors.ts';
import { schemas } from './contracts.ts';

type Shape = z.infer<typeof schemas.draw_shapes>['shapes'][number];
type Pixel = {x:number;y:number;rgba:number[];expected:number[]};
const clear=[0,0,0,0];

export function rasterizeShapes(shapes:Shape[],width=256,height=256):Pixel[] {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256)throw new OperationError('INVALID_ARGUMENT','Invalid sprite dimensions for shape drawing.');
  const pixels=new Map<number,Pixel>();
  const put=(x:number,y:number,rgba:number[])=>{
    if(x<0||y<0||x>=width||y>=height)return;
    const key=y*256+x;
    pixels.set(key,{x,y,rgba,expected:clear});
    if(pixels.size>16384) throw new OperationError('LIMIT_EXCEEDED','Shape draft exceeds 16384 unique pixels. Split it across layers or smaller regions.');
  };
  const line=(x0:number,y0:number,x1:number,y1:number,rgba:number[],thickness=1)=>{
    let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    while(true){
      const left=Math.floor((thickness-1)/2),right=thickness-1-left;
      for(let y=y0-left;y<=y0+right;y++)for(let x=x0-left;x<=x0+right;x++)put(x,y,rgba);
      if(x0===x1&&y0===y1)break;
      const step=2*err;
      if(step>=dy){err+=dy;x0+=sx;}
      if(step<=dx){err+=dx;y0+=sy;}
    }
  };
  for(const shape of shapes){
    if(shape.rgba[3]===0) throw new OperationError('INVALID_ARGUMENT','draw_shapes paints new art only. Use draw_pixels for erasing or revising existing pixels.');
    if(shape.type==='rect'){
      for(let y=shape.y;y<shape.y+shape.height;y++)for(let x=shape.x;x<shape.x+shape.width;x++)put(x,y,shape.rgba);
    } else if(shape.type==='line'){
      line(shape.from.x,shape.from.y,shape.to.x,shape.to.y,shape.rgba,shape.thickness);
    } else if(shape.type==='ellipse'){
      const {x:cx,y:cy}=shape.center,{radiusX:rx,radiusY:ry}=shape;
      for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){
        const dx=(x-cx)/rx,dy=(y-cy)/ry;
        if(dx*dx+dy*dy<=1)put(x,y,shape.rgba);
      }
    } else {
      const points=shape.points;
      const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
      for(let y=Math.min(...ys);y<=Math.max(...ys);y++)for(let x=Math.min(...xs);x<=Math.max(...xs);x++){
        let inside=false;
        for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[i]!,b=points[j]!;
          if((a.y>y+0.5)!==(b.y>y+0.5) && x+0.5<(b.x-a.x)*(y+0.5-a.y)/(b.y-a.y)+a.x)inside=!inside;
        }
        if(inside)put(x,y,shape.rgba);
      }
      for(let i=0;i<points.length;i++){
        const a=points[i]!,b=points[(i+1)%points.length]!;
        line(a.x,a.y,b.x,b.y,shape.rgba);
      }
    }
  }
  if(pixels.size===0)throw new OperationError('INVALID_ARGUMENT','All shapes are outside the sprite canvas.');
  return [...pixels.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}
