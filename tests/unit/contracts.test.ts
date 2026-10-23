import {expect,test} from 'bun:test';
import {color,schemas} from '../../src/tools/contracts.ts';
import {batchSchemas} from '../../src/batch/contracts.ts';

const patch=(rgba:unknown,expected:unknown=rgba)=>({
  documentId:'test-document',layerId:'test-layer',frame:1,
  pixels:[{x:0,y:0,rgba,expected}],allowedColors:[rgba],
});

test('RGBA accepts exactly four integer bytes without changing their order',()=>{
  expect(color.parse([0,127,255,64])).toEqual([0,127,255,64]);
  for(const invalid of [[0,0,0],[0,0,0,0,0],[-1,0,0,0],[0,256,0,0],[0,0,0.5,0],[0,0,'0',0],[0,0,null,0],[0,0,NaN,0],{r:0,g:0,b:0,a:255}]) {
    expect(color.safeParse(invalid).success).toBe(false);
  }
});

test('live patches validate colors, expected bytes and palette colors independently',()=>{
  expect(schemas.draw_pixels.safeParse(patch([0,127,255,64])).success).toBe(true);
  expect(schemas.draw_pixels.safeParse(patch([0,0,0])).success).toBe(false);
  expect(schemas.draw_pixels.safeParse(patch([0,0,0,255],[0,0,0])).success).toBe(false);
  expect(schemas.draw_pixels.safeParse({...patch([0,0,0,255]),allowedColors:[[0,0,0,256]]}).success).toBe(false);
});

test('animation controls validate frame timing, bounded preview ranges and clip directions',()=>{
  expect(schemas.duplicate_frame.safeParse({documentId:'sprite',sourceFrame:1}).success).toBe(true);
  expect(schemas.duplicate_frame.safeParse({documentId:'sprite',sourceFrame:0}).success).toBe(false);
  expect(schemas.copy_cel.safeParse({documentId:'sprite',layerId:'layer',sourceFrame:1,targetFrame:2}).success).toBe(true);
  expect(schemas.copy_cel.safeParse({documentId:'sprite',layerId:'layer',sourceFrame:1,targetFrame:257}).success).toBe(false);
  expect(schemas.move_cel.safeParse({documentId:'sprite',layerId:'layer',frame:2,dx:-2,dy:1}).success).toBe(true);
  expect(schemas.move_cel.safeParse({documentId:'sprite',layerId:'layer',frame:2,dx:257,dy:1}).success).toBe(false);
  expect(schemas.set_frame_duration.safeParse({documentId:'sprite',frame:2,durationMs:125}).success).toBe(true);
  expect(schemas.set_frame_duration.safeParse({documentId:'sprite',frame:0,durationMs:125}).success).toBe(false);
  expect(schemas.set_frame_duration.safeParse({documentId:'sprite',frame:2,durationMs:0}).success).toBe(false);
  expect(schemas.create_animation_tag.safeParse({documentId:'sprite',name:'run',fromFrame:1,toFrame:8}).success).toBe(true);
  expect(schemas.create_animation_tag.safeParse({documentId:'sprite',name:'run',fromFrame:1,toFrame:8,direction:'sideways'}).success).toBe(false);
  expect(schemas.get_animation_preview.safeParse({documentId:'sprite',frameCount:16,columns:4,scale:2}).success).toBe(true);
  expect(schemas.get_animation_preview.safeParse({documentId:'sprite',frameCount:17}).success).toBe(false);
});

test('editable assembly and frame diagnostics require bounded explicit targets',()=>{
  expect(schemas.create_group.parse({documentId:'master',name:'Actor',parentGroupId:'actors'})).toMatchObject({documentId:'master',name:'Actor',parentGroupId:'actors'});
  const component=schemas.import_component.parse({documentId:'master',sourceDocumentId:'source',groupName:'Actor',frameMap:[{sourceFrame:1,targetFrame:2}]});
  expect(component).toMatchObject({x:0,y:0,allowOffCanvas:false,timingPolicy:'require_match'});
  expect(schemas.import_component.safeParse({...component,frameMap:[{sourceFrame:0,targetFrame:2}]}).success).toBe(false);
  expect(schemas.import_component.safeParse({...component,timingPolicy:'overwrite_target'}).success).toBe(false);
  expect(schemas.compare_frames.safeParse({documentId:'master',previousFrame:1,currentFrame:2,scale:8}).success).toBe(true);
  expect(schemas.render_onion_skin.safeParse({documentId:'master',previousFrame:1,currentFrame:257}).success).toBe(false);
});

test('file creation and nested file revisions retain byte and length validation',()=>{
  const create=(rgba:unknown)=>({filename:'new.aseprite',width:8,height:8,pixels:[{x:0,y:0,rgba}]});
  const edit=(rgba:unknown)=>({inputFilename:'original.aseprite',expectedFileSha256:'a'.repeat(64),filename:'revision.aseprite',operations:[{method:'draw_pixels',layerIndex:1,pixels:[{x:0,y:0,rgba}]}]});
  expect(batchSchemas.batch_create_sprite.safeParse(create([0,127,255,64])).success).toBe(true);
  expect(batchSchemas.batch_edit_sprite.safeParse(edit([0,127,255,64])).success).toBe(true);
  for(const rgba of [[0,0,0],[0,0,0,0,0],[0,0,0,256],[0,0,0,0.5]]) {
    expect(batchSchemas.batch_create_sprite.safeParse(create(rgba)).success).toBe(false);
    expect(batchSchemas.batch_edit_sprite.safeParse(edit(rgba)).success).toBe(false);
  }
});
