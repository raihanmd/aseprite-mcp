-- Execute our real operation module against a deliberately small editor model.
-- This proves our validation/copy logic, NOT Aseprite's API or undo implementation.
local checks, image_count, transactions, labels = 0, 0, 0, {}
local function eq(actual, expected, label)
  checks=checks+1
  assert(actual==expected,(label or 'mismatch')..': expected '..tostring(expected)..', got '..tostring(actual))
end
ColorMode={RGB='RGB',INDEXED='INDEXED'}
AniDir={FORWARD='forward',REVERSE='reverse',PING_PONG='ping_pong',PING_PONG_REVERSE='ping_pong_reverse'}
json={decode=function(value) assert(value=='[]');return {} end}
Point=function(x,y) return {x=x,y=y} end
local pc={}
function pc.rgba(r,g,b,a) return r | (g<<8) | (b<<16) | (a<<24) end
function pc.rgbaR(p) return p&255 end
function pc.rgbaG(p) return (p>>8)&255 end
function pc.rgbaB(p) return (p>>16)&255 end
function pc.rgbaA(p) return (p>>24)&255 end
Image=function(w,h,mode)
  image_count=image_count+1
  local image={width=w,height=h,id=image_count,data={},colorMode=mode}
  function image:getPixel(x,y) assert(x>=0 and x<self.width and y>=0 and y<self.height);return self.data[y*self.width+x] or 0 end
  function image:drawPixel(x,y,p) assert(x>=0 and x<self.width and y>=0 and y<self.height);self.data[y*self.width+x]=p end
  function image:clone()
    local copy=Image(self.width,self.height,self.colorMode)
    for key,value in pairs(self.data) do copy.data[key]=value end
    return copy
  end
  return image
end
app={sprites={},pixelColor=pc,refresh=function() end,transaction=function(label,callback) transactions=transactions+1;labels[#labels+1]=label;callback() end}
local operations=dofile('extension/operations.lua')
local red,blue={255,0,0,255},{0,0,255,255}
local transparent={0,0,0,0}
local function fixture(x,y,w,h)
  local sprite={id=#app.sprites+1,width=4,height=4,colorMode=ColorMode.RGB,frames={{frameNumber=1,duration=.1}},cels={},layers={},tags={},filename='test',isModified=true}
  local layer={sprite=sprite,parent=sprite,name='art',isGroup=false,isReference=false,isTilemap=false,isEditable=true,isVisible=true,opacity=255}
  sprite.layers={layer}
  local image=Image(w or 2,h or 2,ColorMode.RGB)
  image:drawPixel(0,0,pc.rgba(table.unpack(red)))
  local cel={image=image,position=Point(x or 1,y or 1),layer=layer,frameNumber=1};layer.current=cel;layer.byFrame={};sprite.cels={cel}
  function layer:cel(frame) return frame==1 and self.current or self.byFrame[frame] end
  function sprite:newCel(l,frame,new_image,position)
    local c={image=new_image,position=position,layer=l,frameNumber=frame}
    if frame==1 then l.current=c else l.byFrame[frame]=c end
    self.cels[#self.cels+1]=c;return c
  end
  function sprite:newEmptyFrame(index) eq(index,#self.frames+1,'append index');local frame={frameNumber=index};self.frames[index]=frame;return frame end
  function sprite:newTag(first,last) local tag={fromFrame=self.frames[first],toFrame=self.frames[last]};self.tags[#self.tags+1]=tag;return tag end
  app.sprites[#app.sprites+1]=sprite
  local id=operations.list_documents().documents[#app.sprites].documentId
  local layer_id=operations.get_document_info({documentId=id}).layers[1].layerId
  return sprite,layer,cel,{documentId=id,layerId=layer_id,frame=1,label='Recolor liquid'}
end
local function expect_error(code,params)
  local before_images,before_transactions=image_count,transactions
  local ok,error=pcall(operations.draw_pixels,params)
  eq(ok,false,code);eq(error.code,code,'error code')
  eq(image_count,before_images,'validation allocated no image');eq(transactions,before_transactions,'validation created no undo entry')
end
local sprite,layer,cel,params=fixture()
local original=cel.image
params.pixels={{x=1,y=1,rgba=blue}}
expect_error('EXPECTED_PIXELS_REQUIRED',params)
params.pixels={{x=1,y=1,rgba=blue,expected=transparent}}
expect_error('STALE_STATE',params)
params.pixels={{x=1,y=1,rgba=blue,expected=red},{x=1,y=1,rgba=blue,expected=red}}
expect_error('INVALID_ARGUMENT',params)
params.pixels={{x=1,y=1,rgba=blue,expected=red},{x=4,y=1,rgba=blue,expected=transparent}}
expect_error('INVALID_ARGUMENT',params)
params.pixels={{x=1,y=1,rgba=blue,expected=red}}
params.allowedMask={{x=2,y=2}};expect_error('OUTSIDE_MASK',params);params.allowedMask=nil
params.allowedColors={red};expect_error('COLOR_CONSTRAINT',params);params.allowedColors=nil
layer.isEditable=false;expect_error('LAYER_LOCKED',params);layer.isEditable=true
local parent={isEditable=false,parent=sprite};layer.parent=parent;expect_error('LAYER_LOCKED',params);layer.parent=sprite
sprite.cels[2]={image=cel.image};expect_error('LINKED_CEL',params);sprite.cels[2]=nil
sprite.colorMode=ColorMode.INDEXED;expect_error('UNSUPPORTED_COLOR_MODE',params);sprite.colorMode=ColorMode.RGB
layer.isTilemap=true;expect_error('UNSUPPORTED_LAYER',params);layer.isTilemap=false
params.allowedMask={{x=1,y=1}};params.allowedColors={blue}
local before=transactions
local result=operations.draw_pixels(params)
eq(result.changedPixels,1);eq(transactions,before+1,'one logical transaction');eq(labels[#labels],'Recolor liquid')
eq(original:getPixel(0,0),pc.rgba(table.unpack(red)),'original image not mutated')
eq(cel.image:getPixel(0,0),pc.rgba(table.unpack(blue)));eq(cel.position.x,1);eq(cel.position.y,1)
eq(cel.image:getPixel(1,1),0,'untouched transparent pixel')
local read=operations.read_pixels({documentId=params.documentId,layerId=params.layerId,frame=1,x=0,y=0,width=2,height=2})
eq(#read.pixels,4);eq(read.pixels[1].rgba[4],0);eq(read.pixels[4].rgba[3],255,'canvas coordinate translation')

-- Expansion preserves pixels outside the visible canvas and hidden RGB values.
sprite,layer,cel,params=fixture(-1,-1,2,2)
cel.image:drawPixel(1,1,pc.rgba(7,8,9,0))
params.pixels={{x=3,y=3,rgba=blue,expected=transparent}}
operations.draw_pixels(params)
eq(cel.position.x,-1);eq(cel.position.y,-1);eq(cel.image.width,5);eq(cel.image.height,5)
eq(cel.image:getPixel(0,0),pc.rgba(table.unpack(red)),'off-canvas original retained')
eq(cel.image:getPixel(1,1),pc.rgba(7,8,9,0),'transparent RGB retained')
eq(cel.image:getPixel(4,4),pc.rgba(table.unpack(blue)))
operations.add_frame({documentId=params.documentId,durationMs=250})
eq(#sprite.frames,2);eq(sprite.frames[2].duration,.25,'ms conversion')
local duration_transactions=transactions
operations.set_frame_duration({documentId=params.documentId,frame=1,durationMs=375})
eq(sprite.frames[1].duration,.375,'frame duration conversion');eq(transactions,duration_transactions+1,'duration is undoable')
local tag_transactions=transactions
local tag_info=operations.create_animation_tag({documentId=params.documentId,name='gallop',fromFrame=1,toFrame=2,direction='ping_pong',repeats=0})
eq(transactions,tag_transactions+1,'tag is undoable');eq(sprite.tags[1].name,'gallop');eq(sprite.tags[1].aniDir,AniDir.PING_PONG);eq(tag_info.tags[1].fromFrame,1);eq(tag_info.tags[1].toFrame,2)
local duplicate_ok,duplicate_error=pcall(operations.create_animation_tag,{documentId=params.documentId,name='gallop',fromFrame=1,toFrame=2,direction='forward',repeats=0})
eq(duplicate_ok,false);eq(duplicate_error.code,'TAG_EXISTS')
local reverse_ok,reverse_error=pcall(operations.create_animation_tag,{documentId=params.documentId,name='bad-range',fromFrame=2,toFrame=1,direction='forward',repeats=0})
eq(reverse_ok,false);eq(reverse_error.code,'INVALID_ARGUMENT')

sprite,layer,cel,params=fixture(1,1,2,2)
cel.opacity=137;cel.zIndex=2
local info=operations.duplicate_frame({documentId=params.documentId,sourceFrame=1})
eq(#sprite.frames,2,'duplicate appends one frame')
eq(info.frames[2].durationMs,100,'duplicate preserves timing')
local copied=layer:cel(2)
eq(copied.image.id~=cel.image.id,true,'duplicate is independent')
eq(copied.image:getPixel(0,0),cel.image:getPixel(0,0),'duplicated pixel')
eq(copied.opacity,137,'duplicate preserves cel opacity')
eq(copied.zIndex,2,'duplicate preserves cel z-index')
eq(info.cels[2].linked,false,'duplicated cel is not linked')
local moved=operations.move_cel({documentId=params.documentId,layerId=params.layerId,frame=2,dx=1,dy=0,allowOffCanvas=false})
eq(moved.x,2,'moved cel x');eq(cel.position.x,1,'source frame did not move')
local no_room,room_error=pcall(operations.move_cel,{documentId=params.documentId,layerId=params.layerId,frame=2,dx=1,dy=0,allowOffCanvas=false})
eq(no_room,false);eq(room_error.code,'OUTSIDE_CANVAS')
local conflict,conflict_error=pcall(operations.copy_cel,{documentId=params.documentId,layerId=params.layerId,sourceFrame=1,targetFrame=2})
eq(conflict,false);eq(conflict_error.code,'CEL_EXISTS','existing target is not overwritten')
operations.add_frame({documentId=params.documentId,durationMs=120})
local copied_cel=operations.copy_cel({documentId=params.documentId,layerId=params.layerId,sourceFrame=1,targetFrame=3})
eq(copied_cel.independent,true);eq(layer:cel(3).image.id~=cel.image.id,true,'single-cel copy is independent')
eq(layer:cel(3).image:getPixel(0,0),cel.image:getPixel(0,0),'single-cel copy retains pixels')
eq(layer:cel(3).opacity,137,'single-cel copy preserves opacity')

sprite,layer,cel,params=fixture(-600,0,2,2)
params.pixels={{x=1,y=1,rgba=blue,expected=transparent}}
expect_error('LIMIT_EXCEEDED',params)

sprite,layer,cel,params=fixture();layer.current=nil;sprite.cels={}
params.pixels={{x=2,y=2,rgba=blue,expected=transparent}}
operations.draw_pixels(params)
eq(layer.current.position.x,2);eq(layer.current.image.width,1);eq(#sprite.cels,1,'new cel')
app.sprites={}
local ok,error=pcall(operations.get_document_info,{documentId=params.documentId})
eq(ok,false);eq(error.code,'DOCUMENT_CLOSED','closed handle not reused')
print('Lua operation checks passed: '..checks..' assertions (mock editor, not live verification)')
