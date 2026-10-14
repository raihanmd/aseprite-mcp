import {z} from 'zod';
import {schemas} from '../tools/contracts.ts';

const filename=z.string().min(1).max(240);
const frame=z.number().int().min(1).max(256).default(1);
const layerIndex=z.number().int().min(1).max(256);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const draw=schemas.draw_pixels.omit({documentId:true,layerId:true,frame:true});
const operation=z.discriminatedUnion('method',[
  draw.extend({method:z.literal('draw_pixels'),layerIndex,frame}),
  z.object({method:z.literal('set_layer_properties'),layerIndex,visible:schemas.set_layer_properties.shape.visible,opacity:schemas.set_layer_properties.shape.opacity}).strict().refine(value=>value.visible!==undefined||value.opacity!==undefined,'Specify visibility or opacity.'),
  schemas.add_frame.omit({documentId:true}).extend({method:z.literal('add_frame')}),
  z.object({method:z.literal('undo')}).strict(),
  z.object({method:z.literal('redo')}).strict(),
]);
const view={frame,scale:z.number().int().min(1).max(8).default(1),pngFilename:filename.optional()};
export const batchSchemas={
  batch_status:z.object({}).strict(),
  batch_create_sprite:schemas.create_sprite.extend({filename,layerName:z.string().min(1).max(100).default('Art'),pixels:z.array(draw.shape.pixels.element).max(16384).default([]),...view}),
  batch_inspect_sprite:z.object({filename,...view,region:schemas.read_pixels.omit({documentId:true,layerId:true}).extend({layerIndex}).optional()}).strict(),
  batch_edit_sprite:z.object({inputFilename:filename,expectedFileSha256:hash,filename,operations:z.array(operation).min(1).max(32),...view}).strict(),
};
export type BatchMethod=Exclude<keyof typeof batchSchemas,'batch_status'>;
