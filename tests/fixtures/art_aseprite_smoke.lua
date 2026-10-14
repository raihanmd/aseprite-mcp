-- Run with: aseprite --batch --script tests/fixtures/art_aseprite_smoke.lua
-- Creates an unsaved sprite only in this batch process.
local sprite = Sprite(4, 4, ColorMode.RGB)
local layer = sprite:newLayer(); layer.name = 'Art smoke test'
local image = Image(2, 1, ColorMode.RGB)
local pc = app.pixelColor
image:drawPixel(0, 0, pc.rgba(255, 0, 0, 255))
image:drawPixel(1, 0, pc.rgba(0, 0, 255, 255))
local cel = sprite:newCel(layer, 1, image, Point(1, 1))
local art = dofile('extension/art_operations.lua'){
  get_sprite=function(id) assert(id == 'smoke'); return sprite end,
  get_layer=function(s, id) assert(s == sprite and id == 'art'); return layer end,
  check_canvas=function(s) assert(s.colorMode == ColorMode.RGB) end,
  editable=function(l) assert(l.isEditable) end,
  fail=function(code, message) error(code..': '..message, 0) end,
}
local palette = art.get_palette{documentId='smoke'}
assert(palette.size > 0)
local first = palette.colors[1]
art.set_palette_colors{documentId='smoke',expectedSize=palette.size,colors={{index=0,rgba={12,34,56,255},expected=first.rgba}}}
assert(art.get_palette{documentId='smoke'}.colors[1].rgba[2] == 34)
local initial = art.get_selection{documentId='smoke'}
art.set_selection{documentId='smoke',mode='replace',expectedSelectionKey=initial.selectionKey,rectangle={x=1,y=1,width=2,height=1}}
local selection = art.get_selection{documentId='smoke',layerId='art',frame=1}
assert(selection.rectangular and selection.selectedPixels == 2)
local result = art.transform_selection{documentId='smoke',layerId='art',frame=1,
  expectedSelectionKey=selection.selectionKey,expectedPixelKey=selection.pixelKey,operation='flip_h'}
assert(result.selectionPreserved)
assert(pc.rgbaR(cel.image:getPixel(0,0)) == 0)
assert(pc.rgbaB(cel.image:getPixel(0,0)) == 255)
assert(art.get_selection{documentId='smoke'}.selectionKey == selection.selectionKey)
app.undo()
assert(pc.rgbaR(cel.image:getPixel(0,0)) == 255, 'Undo did not restore the source pixel')
app.redo()
assert(pc.rgbaB(cel.image:getPixel(0,0)) == 255, 'Redo did not restore the transformed pixel')
print('Aseprite art operations smoke passed: '..tostring(app.version)..', API '..tostring(app.apiVersion))
