import {expect,test} from 'bun:test';
import {assertRevision,verifyEditor} from '../../scripts/check-editor.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {encodePng,encodePngRgba} from '../../src/core/png.ts';
const pixels=()=>Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),rgba:[0,0,0,0]}));
test('editor checker compares every protected pixel, not only the requested change',()=>{
  const before=pixels(),after=pixels();after[9].rgba=[0,0,255,255];
  const changes=new Map([['1,1',[0,0,255,255]]]);
  expect(()=>assertRevision(before,after,changes)).not.toThrow();
  after[54].rgba=[255,0,0,255];expect(()=>assertRevision(before,after,changes)).toThrow();
});
test('editor checker rejects incomplete, duplicate, and malformed pixel inspections',()=>{
  const before=pixels();expect(()=>assertRevision(before,pixels().slice(1),new Map())).toThrow();
  const duplicate=pixels();duplicate[1]={...duplicate[0]};expect(()=>assertRevision(before,duplicate,new Map())).toThrow();
  const malformed=pixels();malformed[0].rgba=[256,0,0,0];expect(()=>assertRevision(before,malformed,new Map())).toThrow();
});
test('editor checker rejects an old MCP tool registry before creating a sprite',async()=>{
  const calls=[];
  const client={
    async callTool({name}){
      calls.push(name);
      if(name!=='get_editor_status')throw new Error(`Unexpected operation: ${name}`);
      return {structuredContent:{ok:true,result:{connected:true,compatibility:{ready:true}}}};
    },
    async listTools(){return {tools:[{name:'get_editor_status'}]};},
  };
  await expect(verifyEditor(client)).rejects.toThrow('Restart the port-owning Codex/OpenCode session');
  expect(calls).toEqual(['get_editor_status']);
});
test('complete editor checker drives its mock workflow but does not claim human or client verification',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aseprite-checker-test-'));
  const clone=value=>JSON.parse(JSON.stringify(value));
  let framePixels=[pixels()],celBounds=[null],layers=[{layerId:'test-layer',visible:true,opacity:255}];
  let frames=[{frame:1,durationMs:100}],tags=[],palette=[[0,0,0,0],[255,255,255,255]];
  let selection=null,selectionVersion=1;
  const history=[],redo=[];
  const snapshot=()=>clone({framePixels,celBounds,layers,frames,tags,palette,selection,selectionVersion});
  const restore=value=>({framePixels,celBounds,layers,frames,tags,palette,selection,selectionVersion}=clone(value));
  const mutate=fn=>{history.push(snapshot());redo.length=0;fn();};
  const error=code=>({isError:true,structuredContent:{ok:false,error:{code}}});
  const info=()=>({documentId:'new-test-document',width:8,height:8,filename:'',isModified:true,layers:clone(layers),frames:clone(frames),tags:clone(tags)});
  const current=frame=>framePixels[frame-1];
  const pixel=(frame,x,y)=>current(frame)[y*8+x].rgba;
  const png=frame=>encodePng(8,8,current(frame).map(item=>Buffer.from(item.rgba).toString('hex')).join(''));
  const selectionKey=()=>selectionVersion.toString(16).padStart(16,'0');
  const pixelKey=frame=>{
    const colors=[];
    for(let y=selection.y;y<selection.y+selection.height;y++)for(let x=selection.x;x<selection.x+selection.width;x++)colors.push(pixel(frame,x,y));
    return createHash('sha256').update(JSON.stringify(colors)).digest('hex').slice(0,16);
  };
  const selectionInfo=args=>({
    documentId:'new-test-document',isEmpty:selection===null,bounds:clone(selection),rectangular:selection!==null,
    selectedPixels:selection?selection.width*selection.height:0,selectionKey:selectionKey(),
    ...(args.layerId&&selection?{layerId:args.layerId,frame:args.frame??1,pixelKey:pixelKey(args.frame??1)}:{}),
  });
  const calls=[];
  const client={async callTool({name,arguments:args}){
    calls.push(name);let result;
    switch(name){
      case 'get_editor_status':result={connected:true,compatibility:{ready:true},editorVersion:'mock',apiVersion:100,extensionVersion:'mock'};break;
      case 'create_sprite':result={documentId:'new-test-document'};break;
      case 'create_layer':result={layerId:'test-layer'};break;
      case 'draw_pixels':{
        const frame=args.frame??1;
        const mismatch=args.pixels.some(item=>JSON.stringify(pixel(frame,item.x,item.y))!==JSON.stringify(item.expected));
        if(mismatch)return error('STALE_STATE');
        mutate(()=>{
          for(const item of args.pixels)current(frame)[item.y*8+item.x].rgba=clone(item.rgba);
          const xs=args.pixels.map(item=>item.x),ys=args.pixels.map(item=>item.y),b=celBounds[frame-1];
          const left=Math.min(...xs,b?.x??8),top=Math.min(...ys,b?.y??8);
          const right=Math.max(...xs,b?b.x+b.width-1:-1),bottom=Math.max(...ys,b?b.y+b.height-1:-1);
          celBounds[frame-1]={x:left,y:top,width:right-left+1,height:bottom-top+1};
        });
        result={};break;
      }
      case 'read_pixels':result={pixels:clone(current(args.frame??1))};break;
      case 'get_preview':return {structuredContent:{ok:true,result:{}},content:[{type:'image',mimeType:'image/png',data:png(args.frame??1).toString('base64')}]};
      case 'undo':redo.push(snapshot());restore(history.pop());result=info();break;
      case 'redo':history.push(snapshot());restore(redo.pop());result=info();break;
      case 'add_frame':mutate(()=>{frames.push({frame:frames.length+1,durationMs:args.durationMs});framePixels.push(pixels());celBounds.push(null);});result=info();break;
      case 'duplicate_frame':mutate(()=>{frames.push({frame:frames.length+1,durationMs:frames[args.sourceFrame-1].durationMs});framePixels.push(clone(current(args.sourceFrame)));celBounds.push(clone(celBounds[args.sourceFrame-1]));});result=info();break;
      case 'copy_cel':
        if(celBounds[args.targetFrame-1])return error('CEL_EXISTS');
        mutate(()=>{framePixels[args.targetFrame-1]=clone(current(args.sourceFrame));celBounds[args.targetFrame-1]=clone(celBounds[args.sourceFrame-1]);});
        result={independent:true};break;
      case 'move_cel':{
        const b=celBounds[args.frame-1],x=b.x+args.dx,y=b.y+args.dy;
        if(!args.allowOffCanvas&&(x<0||y<0||x+b.width>8||y+b.height>8))return error('OUTSIDE_CANVAS');
        mutate(()=>{
          const shifted=pixels();
          for(const item of current(args.frame))if(item.rgba[3])shifted[(item.y+args.dy)*8+item.x+args.dx].rgba=clone(item.rgba);
          framePixels[args.frame-1]=shifted;celBounds[args.frame-1]={...b,x,y};
        });
        result={x,y,width:b.width,height:b.height};break;
      }
      case 'set_frame_duration':mutate(()=>{frames[args.frame-1].durationMs=args.durationMs;});result=info();break;
      case 'create_animation_tag':mutate(()=>{tags.push({name:args.name,fromFrame:args.fromFrame,toFrame:args.toFrame,direction:args.direction,repeats:args.repeats});});result=info();break;
      case 'get_animation_preview':return {structuredContent:{ok:true,result:{frames:clone(frames),tags:clone(tags)}},content:[{type:'image',mimeType:'image/png',data:encodePngRgba(22,12,new Uint8Array(22*12*4)).toString('base64')}]};
      case 'set_layer_properties':mutate(()=>{Object.assign(layers[0],{visible:args.visible,opacity:args.opacity});});result=info();break;
      case 'get_palette':result={size:palette.length,colors:palette.map((rgba,index)=>({index,rgba:clone(rgba)}))};break;
      case 'set_palette_colors':
        if(args.expectedSize!==palette.length||args.colors.some(item=>JSON.stringify(item.expected)!==JSON.stringify(palette[item.index])))return error('STALE_STATE');
        mutate(()=>{for(const item of args.colors)palette[item.index]=clone(item.rgba);});
        result={size:palette.length,colors:palette.map((rgba,index)=>({index,rgba:clone(rgba)}))};break;
      case 'get_selection':result=selectionInfo(args);break;
      case 'set_selection':
        if(args.expectedSelectionKey!==selectionKey())return error('STALE_STATE');
        mutate(()=>{selection=args.mode==='replace'?clone(args.rectangle):null;selectionVersion++;});
        result=selectionInfo(args);break;
      case 'transform_selection':{
        if(args.expectedSelectionKey!==selectionKey())return error('STALE_STATE');
        if(selection===null)return error('EMPTY_SELECTION');
        if(args.expectedPixelKey!==pixelKey(args.frame))return error('STALE_STATE');
        const b=selection;
        if(args.operation==='translate') {
          const tx=b.x+args.dx,ty=b.y+args.dy;
          for(let y=ty;y<ty+b.height;y++)for(let x=tx;x<tx+b.width;x++)
            if(pixel(args.frame,x,y)[3]&&!(x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height))return error('DESTINATION_OCCUPIED');
        }
        mutate(()=>{
          if(args.operation==='flip_h') {
            for(let y=b.y;y<b.y+b.height;y++)for(let x=0;x<Math.floor(b.width/2);x++){
              const left=current(args.frame)[y*8+b.x+x],right=current(args.frame)[y*8+b.x+b.width-1-x];
              const old=clone(left.rgba);left.rgba=clone(right.rgba);right.rgba=old;
            }
          }
        });
        result={selectionPreserved:true};break;
      }
      case 'get_document_info':result=info();break;
      case 'save_sprite':{
        const bytes=Buffer.alloc(128);bytes.writeUInt16LE(0xa5e0,4);
        result={path:join(directory,args.filename)};await writeFile(result.path,bytes);break;
      }
      case 'export_sprite':result={path:join(directory,args.filename)};await writeFile(result.path,png(args.frame??1));break;
      case 'export_sprite_sheet':{
        const pngPath=join(directory,args.pngFilename),jsonPath=join(directory,args.jsonFilename);
        if(await Bun.file(pngPath).exists()||await Bun.file(jsonPath).exists())return error('FILE_EXISTS');
        const atlas=new Uint8Array(16*16*4);
        const entries=frames.map((frame,index)=>{
          const x=index%2*8,y=Math.floor(index/2)*8;
          for(const item of current(frame.frame))atlas.set(item.rgba,((y+item.y)*16+x+item.x)*4);
          return {frame:frame.frame,x,y,width:8,height:8,durationMs:frame.durationMs};
        });
        await writeFile(pngPath,encodePngRgba(16,16,atlas));
        await writeFile(jsonPath,JSON.stringify({format:'aseprite-mcp/sprite-sheet-v1',image:args.pngFilename,size:{width:16,height:16},frames:entries,tags}));
        result={pngPath,jsonPath};break;
      }
      default:throw new Error(`Unexpected operation: ${name}`);
    }
    return {structuredContent:{ok:true,result},content:[]};
  }};
  try{
    const report=await verifyEditor(client);
    expect(report.ok).toBe(true);expect(report.checks.length).toBeGreaterThan(30);
    for(const name of ['duplicate-frame','copy-cel','move-cel','palette-edit','selection-set-clear','transform-selection','sprite-sheet-pixels'])
      expect(report.checks).toContain(name);
    expect(report.humanEditTested).toBe(false);expect(report.productionClientsTested).toBe(false);
    expect(calls.filter(name=>name==='create_sprite')).toHaveLength(1);
    expect(calls.filter(name=>name==='undo')).toHaveLength(3);
    expect(calls.filter(name=>name==='redo')).toHaveLength(3);
  }finally{await rm(directory,{recursive:true,force:true});}
});
