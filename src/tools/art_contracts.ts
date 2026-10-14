import { z } from 'zod';

const handle = z.string().min(1).max(80);
const byte = z.number().int().min(0).max(255);
const rgba = z.array(byte).length(4);
const rectangle = z.object({
  x: z.number().int().min(0).max(255),
  y: z.number().int().min(0).max(255),
  width: z.number().int().min(1).max(256),
  height: z.number().int().min(1).max(256),
}).strict();
const selectionKey = z.string().regex(/^[0-9a-f]{16}$/);
const paletteColor = z.object({
  index: z.number().int().min(0).max(255),
  rgba,
  expected: rgba.optional(),
}).strict();

export const artSchemas = {
  get_palette: z.object({documentId:handle}).strict(),
  set_palette_colors: z.object({
    documentId:handle,
    expectedSize:z.number().int().min(1).max(256),
    extendTo:z.number().int().min(1).max(256).optional(),
    colors:z.array(paletteColor).min(1).max(256),
  }).strict(),
  get_selection: z.object({
    documentId:handle,
    layerId:handle.optional(),
    frame:z.number().int().min(1).max(256).optional(),
  }).strict().refine(value=>value.frame===undefined||value.layerId!==undefined,'A frame requires a layer ID.'),
  set_selection: z.object({
    documentId:handle,
    expectedSelectionKey:selectionKey,
    mode:z.enum(['replace','clear']),
    rectangle:rectangle.optional(),
  }).strict().superRefine((value,ctx)=>{
    if ((value.mode==='replace') !== (value.rectangle!==undefined))
      ctx.addIssue({code:'custom',message:'Replace requires a rectangle; clear forbids one.'});
  }),
  transform_selection: z.object({
    documentId:handle,
    layerId:handle,
    frame:z.number().int().min(1).max(256).default(1),
    expectedSelectionKey:selectionKey,
    expectedPixelKey:selectionKey,
    operation:z.enum(['flip_h','flip_v','rotate_cw','rotate_ccw','translate']),
    dx:z.number().int().min(-255).max(255).optional(),
    dy:z.number().int().min(-255).max(255).optional(),
  }).strict().superRefine((value,ctx)=>{
    if (value.operation==='translate') {
      if (value.dx===undefined||value.dy===undefined||value.dx===0&&value.dy===0)
        ctx.addIssue({code:'custom',message:'Translation requires nonzero dx or dy, with both values supplied.'});
    } else if (value.dx!==undefined||value.dy!==undefined) {
      ctx.addIssue({code:'custom',message:'Only translation accepts dx and dy.'});
    }
  }),
} as const;

export type ArtMethod = keyof typeof artSchemas;
export const artMutating = new Set<ArtMethod>(['set_palette_colors','set_selection','transform_selection']);
