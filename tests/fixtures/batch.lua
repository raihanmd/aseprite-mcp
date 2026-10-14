-- Executes the real batch.lua and operations.lua against an editor model.
-- JSON input decoding is a stub; output uses the real codec encoder.
local directory=assert(arg[1])
local scenario=assert(arg[2])
local saved={}
local corrupt=scenario=='roundtrip'
ColorMode={RGB='RGB'}
AniDir={FORWARD=0,REVERSE=1,PING_PONG=2,PING_PONG_REVERSE=3}
Point=function(x,y)return {x=x,y=y}end
local pc={}
function pc.rgba(r,g,b,a)return r|(g<<8)|(b<<16)|(a<<24)end
function pc.rgbaR(p)return p&255 end
function pc.rgbaG(p)return (p>>8)&255 end
function pc.rgbaB(p)return (p>>16)&255 end
function pc.rgbaA(p)return (p>>24)&255 end
Image=function(w,h,mode)
  local image={width=w,height=h,data={},id=tostring({}),colorMode=mode}
  function image:getPixel(x,y)return self.data[y*self.width+x] or 0 end
  function image:drawPixel(x,y,color)self.data[y*self.width+x]=color end
  function image:drawSprite(sprite,frame)
    for _,layer in ipairs(sprite.layers) do if layer.isVisible then
      local cel=layer:cel(frame)
      if cel then for y=0,cel.image.height-1 do for x=0,cel.image.width-1 do
        local px,py=x+cel.position.x,y+cel.position.y;local color=cel.image:getPixel(x,y)
        if px>=0 and px<self.width and py>=0 and py<self.height and pc.rgbaA(color)>0 then self:drawPixel(px,py,color)end
      end end end
    end end
  end
  return image
end
app={version='mock batch',apiVersion=39,isUIAvailable=scenario=='ui',sprites={},pixelColor=pc,params={request=directory..'/request.json',moduleRoot='extension'},fs={joinPath=function(a,b)return a..'/'..b end},refresh=function()end}
local clone_sprite
Sprite=function(w,h,mode)
  local sprite={id=#app.sprites+1,width=w,height=h,colorMode=mode,filename='mock',isModified=true,layers={},frames={{frameNumber=1,duration=.1}},cels={},tags={}}
  function sprite:newLayer()
    local layer={sprite=self,parent=self,name='Layer',isGroup=false,isReference=false,isTilemap=false,isEditable=true,isVisible=true,opacity=255,byframe={}}
    function layer:cel(frame)return self.byframe[frame]end
    self.layers[#self.layers+1]=layer;return layer
  end
  function sprite:newCel(layer,frame,image,position)
    local cel={image=image,position=position};layer.byframe[frame]=cel;self.cels[#self.cels+1]=cel;return cel
  end
  function sprite:saveCopyAs(path)
    saved[path]=clone_sprite(self)
    if corrupt then saved[path].layers[2]:cel(1).image:drawPixel(0,0,0)end
    local file=assert(io.open(path,'wb'));file:write(string.rep('\0',4)..string.char(0xe0,0xa5)..string.rep('\0',122));file:close()
  end
  sprite:newLayer();app.sprites[#app.sprites+1]=sprite;app.sprite=sprite;return sprite
end
clone_sprite=function(original)
  local copy=Sprite(original.width,original.height,original.colorMode);copy.layers={};copy.cels={}
  for _,old in ipairs(original.layers) do
    local layer=copy:newLayer();layer.name=old.name;layer.isVisible=old.isVisible;layer.opacity=old.opacity
    for frame,cel in pairs(old.byframe) do
      local image=Image(cel.image.width,cel.image.height,ColorMode.RGB)
      for index,color in pairs(cel.image.data) do image.data[index]=color end
      copy:newCel(layer,frame,image,Point(cel.position.x,cel.position.y))
    end
  end
  return copy
end
app.transaction=function(_,operation)operation()end
app.open=function(path)if saved[path] then return clone_sprite(saved[path])end end
local source=Sprite(2,1,ColorMode.RGB);local layer=source:newLayer();layer.name='Art'
local red=Image(1,1,ColorMode.RGB);red:drawPixel(0,0,pc.rgba(255,0,0,255));source:newCel(layer,1,red,Point(0,0))
saved[directory..'/input.aseprite']=clone_sprite(source);app.sprites={};app.sprite=nil
local create=scenario=='create' or scenario=='roundtrip' or scenario=='ui'
local request={version=1,method=create and 'batch_create_sprite' or 'batch_edit_sprite',inputPath=directory..'/input.aseprite',outputPath=directory..'/output.aseprite',resultPath=directory..'/result.json',args={width=2,height=1,name='Asset',layerName='Art',frame=1,scale=1,pixels={{x=0,y=0,rgba={255,0,0,255}}},operations={{method='draw_pixels',layerIndex=2,frame=1,label='File revision',pixels={{x=0,y=0,rgba={0,0,255,255},expected=scenario=='stale' and {0,0,0,0} or {255,0,0,255}}}}}}}
json={decode=function()return request end}
local file=assert(io.open(app.params.request,'wb'));file:write('{}');file:close()
dofile('scripts/batch.lua')
assert(saved[directory..'/input.aseprite'].layers[2]:cel(1).image:getPixel(0,0)==pc.rgba(255,0,0,255),'Original input mutated')
print('Batch Lua scenario '..scenario..' finished (mock editor, not CLI verification)')
