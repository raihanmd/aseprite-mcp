// Run explicitly on the desktop after installing/pairing the extension.
// Creates ONLY a new test sprite and new files. Leaves the test sprite open.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const requiredTools=['duplicate_frame','copy_cel','move_cel','export_sprite_sheet','get_palette','set_palette_colors','get_selection','set_selection','transform_selection'];
async function call(client,name,args={}) {
  const response=await client.callTool({name,arguments:args});
  assert(!response.isError && response.structuredContent?.ok===true,`${name} failed (${response.structuredContent?.error?.code??'invalid response'}).`);
  return response.structuredContent.result;
}
async function expectError(client,name,args,code) {
  const response=await client.callTool({name,arguments:args});
  assert(response.isError&&response.structuredContent?.error?.code===code,`${name} must reject with ${code}; got ${response.structuredContent?.error?.code??'success'}.`);
}
function pixelMap(pixels) {
  const map=new Map();
  for(const pixel of pixels) {
    assert(Number.isInteger(pixel.x)&&Number.isInteger(pixel.y)&&pixel.x>=0&&pixel.x<8&&pixel.y>=0&&pixel.y<8,'Invalid test pixel coordinate.');
    assert(Array.isArray(pixel.rgba)&&pixel.rgba.length===4&&pixel.rgba.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255),'Invalid RGBA.');
    const key=`${pixel.x},${pixel.y}`;assert(!map.has(key),'Duplicate test pixel.');map.set(key,pixel.rgba);
  }
  assert.equal(map.size,64,'The checker requires all 8 by 8 layer pixels.');
  return map;
}
export function assertRevision(before,after,changes) {
  const old=pixelMap(before),current=pixelMap(after);
  for(const [key,color] of old) assert.deepEqual(current.get(key),changes.get(key)??color,`Unexpected pixel change at ${key}.`);
}
export function decodeRgbaPng(bytes) {
  assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG signature.');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=5_000_000,'PNG dimensions exceed checker limits.');
  assert.equal(bytes[24],8);assert.equal(bytes[25],6,'The checker expects RGBA PNG.');
  const idats=[];
  for(let offset=8;offset+12<=bytes.length;) {
    const length=bytes.readUInt32BE(offset);assert(offset+12+length<=bytes.length,'Truncated PNG chunk.');
    if(bytes.subarray(offset+4,offset+8).toString()==='IDAT')idats.push(bytes.subarray(offset+8,offset+8+length));
    offset+=12+length;
  }
  const stride=width*4+1;
  const raw=inflateSync(Buffer.concat(idats),{maxOutputLength:stride*height});
  assert.equal(raw.length,stride*height);
  for(let y=0;y<height;y++)assert.equal(raw[y*stride],0,'The checker expects unfiltered MCP PNG rows.');
  return {width,height,pixel:(x,y)=>{
    assert(x>=0&&x<width&&y>=0&&y<height,'PNG pixel coordinate is outside the image.');
    return [...raw.subarray(y*stride+1+x*4,y*stride+5+x*4)];
  }};
}
export function inspectPreview(response,blue,green) {
  assert(!response.isError && response.structuredContent?.ok===true,'Preview failed.');
  const image=response.content.find(item=>item.type==='image');
  assert(image?.mimeType==='image/png','Actual PNG image content is required.');
  const bytes=Buffer.from(image.data,'base64');
  const decoded=decodeRgbaPng(bytes);
  assert.equal(decoded.width,8);assert.equal(decoded.height,8);
  const pixel=decoded.pixel;
  assert.deepEqual(pixel(1,1),blue);assert.deepEqual(pixel(6,6),green);
}
async function artifact(path) {
  const info=await stat(path);assert(info.isFile()&&info.size<=64*1024*1024,'Invalid output artifact.');
  return readFile(path);
}
export async function verifyEditor(client) {
  const status=await call(client,'get_editor_status');
  assert(status.connected,'Pair the editor extension first.');
  assert(status.compatibility?.ready===true,'Install an extension with successful compatibility reporting first.');
  if(typeof client.listTools==='function') {
    const listed=new Set((await client.listTools()).tools.map(tool=>tool.name));
    const missing=requiredTools.filter(name=>!listed.has(name));
    assert.deepEqual(missing,[],'The MCP server has not loaded the new tools. Restart the port-owning Codex/OpenCode session before this check.');
  }
  const created=await call(client,'create_sprite',{width:8,height:8,name:'MCP compatibility test'});
  const documentId=created.documentId;
  const layer=await call(client,'create_layer',{documentId,name:'Test pixels'});
  const target={documentId,layerId:layer.layerId,frame:1};
  const region={...target,x:0,y:0,width:8,height:8};
  const transparent=[0,0,0,0],red=[255,0,0,255],blue=[0,0,255,255],green=[0,255,0,255];
  await call(client,'draw_pixels',{...target,label:'Compatibility baseline',pixels:[{x:1,y:1,rgba:red,expected:transparent},{x:6,y:6,rgba:green,expected:transparent}]});
  const before=(await call(client,'read_pixels',region)).pixels;
  await call(client,'draw_pixels',{...target,label:'Compatibility revision',allowedMask:[{x:1,y:1}],allowedColors:[blue],pixels:[{x:1,y:1,rgba:blue,expected:red}]});
  const after=(await call(client,'read_pixels',region)).pixels;
  assertRevision(before,after,new Map([['1,1',blue]]));
  const stale=await client.callTool({name:'draw_pixels',arguments:{...target,label:'Rejected stale test',pixels:[{x:1,y:1,rgba:blue,expected:red}]}});
  assert(stale.isError&&stale.structuredContent?.error?.code==='STALE_STATE','Stale edits must be rejected.');
  inspectPreview(await client.callTool({name:'get_preview',arguments:{documentId,frame:1,scale:1}}),blue,green);
  await call(client,'undo',{documentId});assertRevision(before,(await call(client,'read_pixels',region)).pixels,new Map());
  await call(client,'redo',{documentId});assertRevision(after,(await call(client,'read_pixels',region)).pixels,new Map());
  const animation=await call(client,'add_frame',{documentId,durationMs:250});
  assert.equal(animation.frames.length,2);assert.equal(animation.frames[1].durationMs,250);
  await call(client,'draw_pixels',{documentId,layerId:layer.layerId,frame:2,label:'Compatibility animation pose',pixels:[{x:4,y:4,rgba:[255,255,0,255],expected:transparent}]});
  const timed=await call(client,'set_frame_duration',{documentId,frame:1,durationMs:125});
  assert.equal(timed.frames[0].durationMs,125);
  const tagged=await call(client,'create_animation_tag',{documentId,name:'compatibility-loop',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:0});
  assert.deepEqual(tagged.tags[0],{name:'compatibility-loop',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:0});
  const contact=await client.callTool({name:'get_animation_preview',arguments:{documentId,startFrame:1,frameCount:2,columns:2,scale:1}});
  assert(!contact.isError&&contact.structuredContent?.ok===true,'Animation contact sheet failed.');
  assert.deepEqual(contact.structuredContent.result.frames,[{frame:1,durationMs:125},{frame:2,durationMs:250}]);
  assert.deepEqual(contact.structuredContent.result.tags,[{name:'compatibility-loop',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:0}]);
  const sheet=contact.content.find(item=>item.type==='image');
  assert(sheet?.mimeType==='image/png','Animation preview must return PNG image content.');
  const sheetBytes=Buffer.from(sheet.data,'base64');
  assert(sheetBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid contact-sheet PNG signature.');
  assert.equal(sheetBytes.readUInt32BE(16),22);assert.equal(sheetBytes.readUInt32BE(20),12,'Unexpected two-frame contact-sheet dimensions.');
  const hidden=await call(client,'set_layer_properties',{documentId,layerId:layer.layerId,visible:false,opacity:128});
  const hiddenLayer=hidden.layers.find(item=>item.layerId===layer.layerId);
  assert(hiddenLayer,'The edited layer was not returned.');
  assert.equal(hiddenLayer.visible,false);assert.equal(hiddenLayer.opacity,128);
  await call(client,'set_layer_properties',{documentId,layerId:layer.layerId,visible:true,opacity:255});
  const duplicated=await call(client,'duplicate_frame',{documentId,sourceFrame:1});
  assert.equal(duplicated.frames.length,3);assert.equal(duplicated.frames[2].durationMs,125);
  const frame3={...region,frame:3};
  assertRevision(after,(await call(client,'read_pixels',frame3)).pixels,new Map());
  const cyan=[0,255,255,255];
  await call(client,'draw_pixels',{...target,frame:3,label:'Independent duplicate proof',pixels:[{x:1,y:1,rgba:cyan,expected:blue}]});
  assertRevision(after,(await call(client,'read_pixels',region)).pixels,new Map());
  const duplicatePixels=(await call(client,'read_pixels',frame3)).pixels;
  assertRevision(after,duplicatePixels,new Map([['1,1',cyan]]));
  const fourth=await call(client,'add_frame',{documentId,durationMs:180});
  assert.equal(fourth.frames.length,4);assert.equal(fourth.frames[3].durationMs,180);
  const copied=await call(client,'copy_cel',{documentId,layerId:layer.layerId,sourceFrame:1,targetFrame:4});
  assert.equal(copied.independent,true);
  const frame4={...region,frame:4};
  assertRevision(after,(await call(client,'read_pixels',frame4)).pixels,new Map());
  await expectError(client,'copy_cel',{documentId,layerId:layer.layerId,sourceFrame:1,targetFrame:4},'CEL_EXISTS');
  const moved=await call(client,'move_cel',{documentId,layerId:layer.layerId,frame:4,dx:1,dy:0,allowOffCanvas:false});
  assert.deepEqual([moved.x,moved.y,moved.width,moved.height],[2,1,6,6]);
  const movedPixels=(await call(client,'read_pixels',frame4)).pixels;
  assertRevision(after,movedPixels,new Map([['1,1',transparent],['2,1',blue],['6,6',transparent],['7,6',green]]));
  await expectError(client,'move_cel',{documentId,layerId:layer.layerId,frame:4,dx:1,dy:0,allowOffCanvas:false},'OUTSIDE_CANVAS');
  assertRevision(movedPixels,(await call(client,'read_pixels',frame4)).pixels,new Map());
  await call(client,'undo',{documentId});assertRevision(after,(await call(client,'read_pixels',frame4)).pixels,new Map());
  await call(client,'redo',{documentId});assertRevision(movedPixels,(await call(client,'read_pixels',frame4)).pixels,new Map());
  assertRevision(after,(await call(client,'read_pixels',region)).pixels,new Map());

  const palette=await call(client,'get_palette',{documentId});
  assert(Number.isInteger(palette.size)&&palette.size>=1&&palette.size<=256,'Invalid scratch-sprite palette size.');
  assert.equal(palette.colors.length,palette.size);
  const entry=palette.colors[0];
  assert.equal(entry.index,0);assert.equal(entry.rgba.length,4);
  const recolored=[(entry.rgba[0]+17)%256,...entry.rgba.slice(1)];
  const editedPalette=await call(client,'set_palette_colors',{documentId,expectedSize:palette.size,colors:[{index:0,rgba:recolored,expected:entry.rgba}]});
  assert.deepEqual(editedPalette.colors[0].rgba,recolored);
  await expectError(client,'set_palette_colors',{documentId,expectedSize:palette.size,colors:[{index:0,rgba:recolored,expected:entry.rgba}]},'STALE_STATE');
  await call(client,'undo',{documentId});
  assert.deepEqual((await call(client,'get_palette',{documentId})).colors[0].rgba,entry.rgba);
  await call(client,'redo',{documentId});
  assert.deepEqual((await call(client,'get_palette',{documentId})).colors[0].rgba,recolored);
  assertRevision(after,(await call(client,'read_pixels',region)).pixels,new Map());

  const emptySelection=await call(client,'get_selection',{documentId,layerId:layer.layerId,frame:3});
  assert.equal(emptySelection.isEmpty,true);
  const selected=await call(client,'set_selection',{documentId,expectedSelectionKey:emptySelection.selectionKey,mode:'replace',rectangle:{x:1,y:1,width:2,height:1}});
  assert.deepEqual(selected.bounds,{x:1,y:1,width:2,height:1});
  await expectError(client,'set_selection',{documentId,expectedSelectionKey:emptySelection.selectionKey,mode:'clear'},'STALE_STATE');
  const inspected=await call(client,'get_selection',{documentId,layerId:layer.layerId,frame:3});
  assert.equal(inspected.rectangular,true);assert.equal(inspected.selectedPixels,2);
  assert.match(inspected.pixelKey,/^[0-9a-f]{16}$/);
  const flipped=await call(client,'transform_selection',{documentId,layerId:layer.layerId,frame:3,expectedSelectionKey:inspected.selectionKey,expectedPixelKey:inspected.pixelKey,operation:'flip_h'});
  assert.equal(flipped.selectionPreserved,true);
  const flippedPixels=(await call(client,'read_pixels',frame3)).pixels;
  assertRevision(duplicatePixels,flippedPixels,new Map([['1,1',transparent],['2,1',cyan]]));
  await expectError(client,'transform_selection',{documentId,layerId:layer.layerId,frame:3,expectedSelectionKey:inspected.selectionKey,expectedPixelKey:inspected.pixelKey,operation:'flip_h'},'STALE_STATE');
  const afterFlip=await call(client,'get_selection',{documentId,layerId:layer.layerId,frame:3});
  const occupiedSelection=await call(client,'set_selection',{documentId,expectedSelectionKey:afterFlip.selectionKey,mode:'replace',rectangle:{x:2,y:1,width:1,height:1}});
  const occupiedState=await call(client,'get_selection',{documentId,layerId:layer.layerId,frame:3});
  assert.equal(occupiedState.selectionKey,occupiedSelection.selectionKey);
  await expectError(client,'transform_selection',{documentId,layerId:layer.layerId,frame:3,expectedSelectionKey:occupiedState.selectionKey,expectedPixelKey:occupiedState.pixelKey,operation:'translate',dx:4,dy:5},'DESTINATION_OCCUPIED');
  assertRevision(flippedPixels,(await call(client,'read_pixels',frame3)).pixels,new Map());
  const cleared=await call(client,'set_selection',{documentId,expectedSelectionKey:occupiedState.selectionKey,mode:'clear'});
  assert.equal(cleared.isEmpty,true);
  await expectError(client,'transform_selection',{documentId,layerId:layer.layerId,frame:3,expectedSelectionKey:cleared.selectionKey,expectedPixelKey:'0000000000000000',operation:'flip_h'},'EMPTY_SELECTION');

  const original=await call(client,'get_document_info',{documentId});
  const prefix=`compatibility-${randomUUID()}`;
  const source=await call(client,'save_sprite',{documentId,filename:`${prefix}.aseprite`});
  const sourceBytes=await artifact(source.path);
  assert(sourceBytes.length>=128&&sourceBytes.readUInt16LE(4)===0xa5e0,'Invalid Aseprite source.');
  const current=await call(client,'get_document_info',{documentId});
  assert.equal(current.filename,original.filename);assert.equal(current.isModified,original.isModified,'Saving a copy changed the live saved state.');
  const exported=await call(client,'export_sprite',{documentId,frame:1,filename:`${prefix}.png`});
  inspectPreview({structuredContent:{ok:true},content:[{type:'image',mimeType:'image/png',data:(await artifact(exported.path)).toString('base64')}]},blue,green);
  const sheetExport=await call(client,'export_sprite_sheet',{documentId,pngFilename:`${prefix}-sheet.png`,jsonFilename:`${prefix}-sheet.json`,columns:2});
  const sheetPng=decodeRgbaPng(await artifact(sheetExport.pngPath));
  assert.deepEqual([sheetPng.width,sheetPng.height],[16,16]);
  const manifest=JSON.parse((await artifact(sheetExport.jsonPath)).toString());
  assert.equal(manifest.format,'aseprite-mcp/sprite-sheet-v1');
  assert.equal(manifest.image,`${prefix}-sheet.png`);
  assert.deepEqual(manifest.size,{width:16,height:16});
  assert.deepEqual(manifest.frames.map(item=>[item.frame,item.x,item.y,item.durationMs]),[[1,0,0,125],[2,8,0,250],[3,0,8,125],[4,8,8,180]]);
  assert.deepEqual(manifest.tags,[{name:'compatibility-loop',fromFrame:1,toFrame:2,direction:'ping_pong',repeats:0}]);
  for(const item of manifest.frames) {
    const rendered=await client.callTool({name:'get_preview',arguments:{documentId,frame:item.frame,scale:1}});
    assert(!rendered.isError&&rendered.structuredContent?.ok===true,'Frame preview for atlas comparison failed.');
    const image=rendered.content.find(content=>content.type==='image'&&content.mimeType==='image/png');
    assert(image,'Frame preview must contain PNG pixels.');
    const standalone=decodeRgbaPng(Buffer.from(image.data,'base64'));
    assert.deepEqual([standalone.width,standalone.height],[8,8]);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)
      assert.deepEqual(sheetPng.pixel(item.x+x,item.y+y),standalone.pixel(x,y),`Atlas frame ${item.frame} differs at ${x},${y}.`);
  }
  await expectError(client,'export_sprite_sheet',{documentId,pngFilename:`${prefix}-sheet.png`,jsonFilename:`${prefix}-sheet.json`,columns:2},'FILE_EXISTS');
  const afterExport=await call(client,'get_document_info',{documentId});
  assert.equal(afterExport.filename,original.filename);assert.equal(afterExport.isModified,original.isModified,'Export changed the live saved state.');
  return {ok:true,editorVersion:status.editorVersion,apiVersion:status.apiVersion,extensionVersion:status.extensionVersion,documentId,
    checks:['create','draw','protected-pixels','stale-rejection','preview-pixels','undo','redo','frame-duration','animation-pose','animation-timing','animation-tag','animation-contact-sheet','layer-properties','duplicate-frame','independent-frame-pixels','copy-cel','occupied-cel-rejection','move-cel','off-canvas-rejection','move-undo-redo','palette-edit','palette-stale-rejection','palette-undo-redo','selection-set-clear','selection-stale-rejection','transform-selection','transform-stale-rejection','occupied-transform-rejection','source-copy','PNG-export','sprite-sheet-metadata','sprite-sheet-pixels','sprite-sheet-no-overwrite'],
    source:source.path,png:exported.path,sheetPng:sheetExport.pngPath,sheetJson:sheetExport.jsonPath,humanEditTested:false,productionClientsTested:false};
}
async function main() {
  console.error('This creates a separate 8 by 8 test sprite and new exports. Do not edit that test tab until it finishes.');
  console.error('Keep the paired editor connected; this checker can share the existing MCP bridge. Pair it if needed within 60 seconds.');
  const transport=new StdioClientTransport({command:process.env.ASEPRITE_MCP_BUN??'bun',args:[resolve(root,'scripts/launch.ts')],stderr:'pipe'});
  let diagnostics='';transport.stderr.on('data',chunk=>{diagnostics=(diagnostics+String(chunk)).slice(-8192);});
  const client=new Client({name:'aseprite-compatibility-check',version:'0.1.1'});
  try {
    await client.connect(transport);
    const deadline=Date.now()+60000;
    while(!(await call(client,'get_editor_status')).connected) {
      assert(Date.now()<deadline,'Editor pairing timed out.');await new Promise(resolve=>setTimeout(resolve,500));
    }
    console.log(JSON.stringify(await verifyEditor(client),null,2));
    console.error('Test sprite stays open for review. This does not test real human edits or Codex/OpenCode skill loading.');
  } catch(error) {
    console.error(`Editor check failed: ${error.message}`);
    if(diagnostics)console.error(diagnostics);
    process.exitCode=1;
  } finally {await client.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
