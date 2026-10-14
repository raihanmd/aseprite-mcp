local checks, transactions, images = 0, 0, 0
local function eq(actual, expected, label)
  checks = checks + 1
  assert(actual == expected, (label or 'mismatch')..': expected '..tostring(expected)..', got '..tostring(actual))
end
local function rejected(fn, code)
  local before = transactions
  local ok, err = pcall(fn)
  eq(ok, false, code)
  eq(err.code, code, 'error code')
  eq(transactions, before, 'rejected edit creates no transaction')
end
ColorMode = {RGB='RGB'}
Point = function(x, y) return {x=x, y=y} end
Rectangle = function(x, y, width, height) return {x=x, y=y, width=width, height=height} end
Color = function(value) return {red=value.r, green=value.g, blue=value.b, alpha=value.a} end
Selection = function(rectangle)
  local self = {rect=rectangle, isEmpty=rectangle == nil}
  function self:contains(x, y)
    local r = self.rect
    return r ~= nil and x >= r.x and y >= r.y and x < r.x+r.width and y < r.y+r.height
  end
  function self:add(other)
    assert(self.rect == nil and other.rect ~= nil)
    local r = other.rect
    self.rect = Rectangle(r.x, r.y, r.width, r.height)
    self.isEmpty = false
  end
  return setmetatable(self, {__index=function(t, key)
    if key == 'bounds' then return t.rect or Rectangle(0, 0, 0, 0) end
  end})
end
local pc = {}
function pc.rgba(r, g, b, a) return r | (g << 8) | (b << 16) | (a << 24) end
function pc.rgbaR(p) return p & 255 end
function pc.rgbaG(p) return (p >> 8) & 255 end
function pc.rgbaB(p) return (p >> 16) & 255 end
function pc.rgbaA(p) return (p >> 24) & 255 end
Image = function(width, height, mode)
  images = images + 1
  local self = {id=images, width=width, height=height, mode=mode, data={}}
  function self:getPixel(x, y)
    assert(x >= 0 and x < width and y >= 0 and y < height)
    return self.data[y*width+x] or 0
  end
  function self:drawPixel(x, y, pixel)
    assert(x >= 0 and x < width and y >= 0 and y < height)
    self.data[y*width+x] = pixel
  end
  return self
end
app = {pixelColor=pc, transaction=function(_, fn) transactions=transactions+1;fn() end, refresh=function() end}
local palette = {Color{r=0,g=0,b=0,a=255}, Color{r=255,g=0,b=0,a=255}}
function palette:getColor(index) return self[index+1] end
function palette:setColor(index, color) self[index+1] = color end
function palette:resize(size)
  for i = #self, size-1 do self[i+1] = Color{r=0,g=0,b=0,a=255} end
end
local sprite = {width=4,height=4,colorMode=ColorMode.RGB,palettes={palette},frames={{}},cels={},selection=Selection()}
local layer = {isGroup=false,isTilemap=false,isReference=false,isEditable=true,parent=sprite}
function layer:cel() return self.current end
local cel = {image=Image(3,2,ColorMode.RGB),position=Point(0,1)}
cel.image:drawPixel(0,0,pc.rgba(99,88,77,0)) -- Hidden RGB must survive edits.
cel.image:drawPixel(1,0,pc.rgba(255,0,0,255))
cel.image:drawPixel(2,0,pc.rgba(0,0,255,255))
layer.current=cel;sprite.cels={cel}
local art = dofile('extension/art_operations.lua'){
  get_sprite=function(id) eq(id,'doc');return sprite end,
  get_layer=function(_, id) eq(id,'layer');return layer end,
  check_canvas=function(s) eq(s.colorMode,ColorMode.RGB) end,
  editable=function(l) if not l.isEditable then error({code='LAYER_LOCKED'}) end end,
  fail=function(code, message) error({code=code,message=message},0) end,
}

eq(#art.capabilities(),5)
local read = art.get_palette{documentId='doc'}
eq(read.size,2);eq(read.colors[2].rgba[1],255)
rejected(function() art.set_palette_colors{documentId='doc',expectedSize=2,colors={{index=1,rgba={0,255,0,255},expected={0,0,0,255}}}} end,'STALE_STATE')
art.set_palette_colors{documentId='doc',expectedSize=2,extendTo=3,colors={{index=1,rgba={0,255,0,255},expected={255,0,0,255}},{index=2,rgba={0,0,255,255}}}}
eq(#palette,3);eq(palette:getColor(1).green,255)
rejected(function() art.set_palette_colors{documentId='doc',expectedSize=2,colors={{index=1,rgba={2,2,2,255},expected={0,255,0,255}}}} end,'STALE_STATE')

local empty = art.get_selection{documentId='doc'}
eq(empty.isEmpty,true)
rejected(function() art.set_selection{documentId='doc',expectedSelectionKey='bad',mode='replace',rectangle={x=1,y=1,width=2,height=1}} end,'STALE_STATE')
local selected = art.set_selection{documentId='doc',expectedSelectionKey=empty.selectionKey,mode='replace',rectangle={x=1,y=1,width=2,height=1}}
eq(selected.rectangular,true);eq(selected.selectedPixels,2)
local inspect = art.get_selection{documentId='doc',layerId='layer',frame=1}
local original = cel.image
local before = transactions
local result = art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=inspect.selectionKey,expectedPixelKey=inspect.pixelKey,operation='flip_h'}
eq(transactions,before+1,'transform is one transaction')
eq(result.selectionPreserved,true)
eq(cel.image:getPixel(1,0),pc.rgba(0,0,255,255),'flip moved blue to left')
eq(cel.image:getPixel(2,0),pc.rgba(255,0,0,255),'flip moved red to right')
eq(cel.image:getPixel(0,0),pc.rgba(99,88,77,0),'hidden RGB preserved')
eq(original:getPixel(1,0),pc.rgba(255,0,0,255),'source image not mutated')
eq(art.get_selection{documentId='doc'}.selectionKey,inspect.selectionKey,'selection remains intact')
rejected(function() art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=inspect.selectionKey,expectedPixelKey=inspect.pixelKey,operation='flip_h'} end,'STALE_STATE')

local fresh = art.get_selection{documentId='doc',layerId='layer'}
local turn = art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=fresh.selectionKey,expectedPixelKey=fresh.pixelKey,operation='rotate_cw'}
eq(turn.destination.width,1);eq(turn.destination.height,2)
eq(cel.image:getPixel(1,0),pc.rgba(0,0,255,255),'clockwise rotation first pixel')
eq(cel.image:getPixel(1,1),pc.rgba(255,0,0,255),'clockwise rotation second pixel')
eq(cel.image:getPixel(2,0),0,'old right pixel cleared')

local current = art.get_selection{documentId='doc'}
art.set_selection{documentId='doc',expectedSelectionKey=current.selectionKey,mode='replace',rectangle={x=1,y=1,width=1,height=1}}
current = art.get_selection{documentId='doc',layerId='layer'}
rejected(function() art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=current.selectionKey,expectedPixelKey=current.pixelKey,operation='translate',dx=0,dy=1} end,'DESTINATION_OCCUPIED')
layer.isEditable=false
rejected(function() art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=current.selectionKey,expectedPixelKey=current.pixelKey,operation='flip_v'} end,'LAYER_LOCKED')
layer.isEditable=true
sprite.cels[2]={image=cel.image}
rejected(function() art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=current.selectionKey,expectedPixelKey=current.pixelKey,operation='flip_v'} end,'LINKED_CEL')
sprite.cels[2]=nil
art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=current.selectionKey,expectedPixelKey=current.pixelKey,operation='translate',dx=2,dy=0}
eq(cel.image:getPixel(1,0),0,'translation clears source')
eq(cel.image:getPixel(3,0),pc.rgba(0,0,255,255),'translation preserves pixel')
current = art.get_selection{documentId='doc'}
art.set_selection{documentId='doc',expectedSelectionKey=current.selectionKey,mode='replace',rectangle={x=3,y=3,width=1,height=1}}
current = art.get_selection{documentId='doc',layerId='layer'}
rejected(function() art.transform_selection{documentId='doc',layerId='layer',frame=1,expectedSelectionKey=current.selectionKey,expectedPixelKey=current.pixelKey,operation='translate',dx=-1,dy=0} end,'EMPTY_REGION')
local clear = art.get_selection{documentId='doc'}
art.set_selection{documentId='doc',expectedSelectionKey=clear.selectionKey,mode='clear'}
eq(art.get_selection{documentId='doc'}.isEmpty,true)
print('Art operation checks passed: '..checks..' assertions (mock editor, not live verification)')
