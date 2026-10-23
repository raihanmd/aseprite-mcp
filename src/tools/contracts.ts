import { z } from 'zod';
import { artSchemas } from './art_contracts.ts';
const handle = z.string().min(1).max(80);
const byte = z.number().int().min(0).max(255);
// Homogeneous fixed-length arrays export an item object rather than positional
// tuple items, so model clients can expose all tools that accept RGBA values.
export const color = z.array(byte).length(4);
export const point = z.object({x:z.number().int().min(0).max(255),y:z.number().int().min(0).max(255)}).strict();
const pixel = point.extend({rgba:color, expected:color.optional()});
const target = {documentId:handle};
const cell = {...target,layerId:handle,frame:z.number().int().min(1).max(256).default(1)};
const rectangle = {x:z.number().int().min(0).max(255),y:z.number().int().min(0).max(255),width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256)};
const shape = z.discriminatedUnion('type',[
  z.object({type:z.literal('rect'),...rectangle,rgba:color}).strict(),
  z.object({type:z.literal('line'),from:point,to:point,thickness:z.number().int().min(1).max(8).default(1),rgba:color}).strict(),
  z.object({type:z.literal('ellipse'),center:point,radiusX:z.number().int().min(1).max(128),radiusY:z.number().int().min(1).max(128),rgba:color}).strict(),
  z.object({type:z.literal('polygon'),points:z.array(point).min(3).max(32),rgba:color}).strict(),
]);
export const schemas = {
  get_editor_status:z.object({}).strict(),
  list_documents:z.object({}).strict(),
  get_document_info:z.object(target).strict(),
  create_sprite:z.object({width:z.number().int().min(1).max(256),height:z.number().int().min(1).max(256),name:z.string().min(1).max(100).default('AI Asset')}).strict(),
  create_layer:z.object({...target,name:z.string().min(1).max(100)}).strict(),
  create_group:z.object({...target,name:z.string().min(1).max(100),parentGroupId:handle.optional()}).strict(),
  import_component:z.object({...target,sourceDocumentId:handle,groupName:z.string().min(1).max(100),parentGroupId:handle.optional(),x:z.number().int().min(-256).max(256).default(0),y:z.number().int().min(-256).max(256).default(0),allowOffCanvas:z.boolean().default(false),timingPolicy:z.enum(['require_match','keep_target']).default('require_match'),frameMap:z.array(z.object({sourceFrame:z.number().int().min(1).max(256),targetFrame:z.number().int().min(1).max(256)}).strict()).min(1).max(256).optional()}).strict(),
  read_pixels:z.object({...cell,...rectangle}).strict(),
  draw_pixels:z.object({...cell,pixels:z.array(pixel).min(1).max(16384),allowedMask:z.array(point).min(1).max(16384).optional(),allowedColors:z.array(color).min(1).max(256).optional(),label:z.string().min(1).max(100).default('AI pixel edit')}).strict(),
  draw_shapes:z.object({...cell,shapes:z.array(shape).min(1).max(128),allowedMask:z.array(point).min(1).max(16384).optional(),allowedColors:z.array(color).min(1).max(256).optional(),label:z.string().min(1).max(100).default('AI shape draft')}).strict(),
  get_preview:z.object({...target,frame:z.number().int().min(1).max(256).default(1),scale:z.number().int().min(1).max(8).default(1)}).strict(),
  compare_frames:z.object({...target,previousFrame:z.number().int().min(1).max(256),currentFrame:z.number().int().min(1).max(256),scale:z.number().int().min(1).max(8).default(1)}).strict(),
  render_onion_skin:z.object({...target,previousFrame:z.number().int().min(1).max(256),currentFrame:z.number().int().min(1).max(256),scale:z.number().int().min(1).max(8).default(1)}).strict(),
  undo:z.object(target).strict(), redo:z.object(target).strict(),
  add_frame:z.object({...target,durationMs:z.number().int().min(1).max(60000).default(100)}).strict(),
  duplicate_frame:z.object({...target,sourceFrame:z.number().int().min(1).max(256)}).strict(),
  copy_cel:z.object({...target,layerId:handle,sourceFrame:z.number().int().min(1).max(256),targetFrame:z.number().int().min(1).max(256)}).strict(),
  move_cel:z.object({...cell,dx:z.number().int().min(-256).max(256),dy:z.number().int().min(-256).max(256),allowOffCanvas:z.boolean().default(false)}).strict(),
  set_frame_duration:z.object({...target,frame:z.number().int().min(1).max(256),durationMs:z.number().int().min(1).max(60000)}).strict(),
  create_animation_tag:z.object({...target,name:z.string().min(1).max(100),fromFrame:z.number().int().min(1).max(256),toFrame:z.number().int().min(1).max(256),direction:z.enum(['forward','reverse','ping_pong','ping_pong_reverse']).default('forward'),repeats:z.number().int().min(0).max(1000).default(0)}).strict(),
  get_animation_preview:z.object({...target,startFrame:z.number().int().min(1).max(256).default(1),frameCount:z.number().int().min(1).max(16).default(16),columns:z.number().int().min(1).max(4).default(4),scale:z.number().int().min(1).max(2).default(1)}).strict(),
  set_layer_properties:z.object({...target,layerId:handle,visible:z.boolean().optional(),opacity:byte.optional()}).strict().refine(v=>v.visible!==undefined||v.opacity!==undefined,'Specify visibility or opacity.'),
  ...artSchemas,
};
export type EditorMethod = keyof typeof schemas;
export const mutating = new Set<string>(['create_sprite','create_layer','create_group','import_component','draw_pixels','draw_shapes','undo','redo','add_frame','duplicate_frame','copy_cel','move_cel','set_frame_duration','create_animation_tag','set_layer_properties','set_palette_colors','set_selection','transform_selection','save_copy']);
