-- Named operations shared by the live extension and the explicit batch runner.
local M = {}
-- A plain Lua array marker shared by convention with codec.lua; no native JSON
-- objects are inserted into operation results.
local function array() return setmetatable({},{__aseprite_mcp_array=true}) end
local documents, layer_handles = {}, {}
local function fail(code, message) error({code=code,message=message}, 0) end
local function integer(value, minimum, maximum, name)
  if type(value) ~= 'number' or value % 1 ~= 0 or value < minimum or value > maximum then fail('INVALID_ARGUMENT', 'Invalid '..name) end
  return value
end
local function short_string(value, name)
  if type(value) ~= 'string' or #value == 0 or #value > 100 then fail('INVALID_ARGUMENT', 'Invalid '..name) end
  return value
end
local function sprite_handle(sprite)
  local id = 'sprite-'..tostring(sprite.id)
  documents[id] = sprite
  return id
end
local function get_sprite(id)
  local target = documents[id]
  for _, sprite in ipairs(app.sprites) do if sprite == target then return target end end
  fail('DOCUMENT_CLOSED', 'List documents again; this document is no longer open.')
end
local function walk(sprite, layers, result)
  for _, layer in ipairs(layers) do
    local id
    for handle, known in pairs(layer_handles) do if known == layer then id=handle;break end end
    if not id then id=sprite_handle(sprite)..'-layer-'..tostring(M.next_layer);M.next_layer=M.next_layer+1;layer_handles[id]=layer end
    result[#result+1]={layerId=id,name=layer.name,group=layer.isGroup,visible=layer.isVisible,editable=layer.isEditable,opacity=layer.opacity}
    if layer.isGroup then walk(sprite,layer.layers,result) end
  end
end
M.next_layer = 1
local function get_layer(sprite, id)
  local list = {}; walk(sprite,sprite.layers,list)
  for _, item in ipairs(list) do if item.layerId == id then return layer_handles[id] end end
  fail('LAYER_MISSING','Layer is no longer in the requested document.')
end
local function editable(layer)
  if layer.isGroup or layer.isReference or layer.isTilemap then fail('UNSUPPORTED_LAYER','Only ordinary image layers are supported.') end
  local current=layer
  while current and current~=layer.sprite do
    if not current.isEditable then fail('LAYER_LOCKED','Layer or parent group is locked.') end
    current=current.parent
  end
end
local function check_canvas(sprite)
  if sprite.colorMode ~= ColorMode.RGB then fail('UNSUPPORTED_COLOR_MODE','This release edits RGB sprites only.') end
  if sprite.width > 256 or sprite.height > 256 then fail('LIMIT_EXCEEDED','This release supports canvases up to 256 by 256 pixels.') end
end
local function target(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  local frame=integer(params.frame or 1,1,#sprite.frames,'frame')
  local layer=get_layer(sprite,params.layerId)
  if layer.isGroup or layer.isTilemap or layer.isReference then fail('UNSUPPORTED_LAYER','An image layer is required.') end
  return sprite,layer,frame
end
local function packed(rgba)
  if type(rgba)~='table' or #rgba~=4 then fail('INVALID_ARGUMENT','RGBA must contain four bytes.') end
  for i=1,4 do integer(rgba[i],0,255,'RGBA byte') end
  return app.pixelColor.rgba(rgba[1],rgba[2],rgba[3],rgba[4])
end
local function unpacked(pixel)
  local pc=app.pixelColor
  return {pc.rgbaR(pixel),pc.rgbaG(pixel),pc.rgbaB(pixel),pc.rgbaA(pixel)}
end
local function cel_pixel(cel,x,y)
  if not cel then return 0 end
  local lx,ly=x-cel.position.x,y-cel.position.y
  if lx<0 or ly<0 or lx>=cel.image.width or ly>=cel.image.height then return 0 end
  return cel.image:getPixel(lx,ly)
end
local function with_active(sprite, operation)
  local previous=app.sprite
  app.sprite=sprite
  local ok,result=pcall(operation)
  if previous then pcall(function() app.sprite=previous end) end
  if not ok then error(result,0) end
  return result
end
function M.list_documents()
  local list=array()
  for _,sprite in ipairs(app.sprites) do list[#list+1]={documentId=sprite_handle(sprite),width=sprite.width,height=sprite.height,filename=sprite.filename,isModified=sprite.isModified} end
  return {documents=list}
end
function M.get_document_info(params)
  local sprite=get_sprite(params.documentId)
  local layers=array();walk(sprite,sprite.layers,layers)
  local frames={};for _,frame in ipairs(sprite.frames) do frames[#frames+1]={frame=frame.frameNumber,durationMs=math.floor(frame.duration*1000+0.5)} end
  local direction_names={{value=AniDir.FORWARD,name='forward'},{value=AniDir.REVERSE,name='reverse'},{value=AniDir.PING_PONG,name='ping_pong'},{value=AniDir.PING_PONG_REVERSE,name='ping_pong_reverse'}}
  local tags=array()
  for _,tag in ipairs(sprite.tags) do
    local direction='forward'
    for _,item in ipairs(direction_names) do if tag.aniDir==item.value then direction=item.name;break end end
    tags[#tags+1]={name=tag.name,fromFrame=tag.fromFrame.frameNumber,toFrame=tag.toFrame.frameNumber,direction=direction,repeats=tag.repeats}
  end
  local image_counts={}
  for _,cel in ipairs(sprite.cels) do image_counts[cel.image.id]=(image_counts[cel.image.id] or 0)+1 end
  local cels=array()
  for _,cel in ipairs(sprite.cels) do
    local layerId
    for handle,known in pairs(layer_handles) do if known==cel.layer then layerId=handle;break end end
    cels[#cels+1]={layerId=layerId,frame=cel.frameNumber,x=cel.position.x,y=cel.position.y,width=cel.image.width,height=cel.image.height,linked=image_counts[cel.image.id]>1}
  end
  return {documentId=sprite_handle(sprite),width=sprite.width,height=sprite.height,colorMode=tostring(sprite.colorMode),layers=layers,frames=frames,tags=tags,cels=cels,isModified=sprite.isModified,filename=sprite.filename}
end
function M.create_sprite(params)
  integer(params.width,1,256,'width');integer(params.height,1,256,'height');short_string(params.name,'name')
  local sprite=Sprite(params.width,params.height,ColorMode.RGB)
  app.sprite=sprite
  app.transaction('Create AI asset',function() sprite.layers[1].name=params.name end)
  return M.get_document_info({documentId=sprite_handle(sprite)})
end
function M.create_layer(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite);short_string(params.name,'name')
  local layer
  app.transaction('Create AI layer',function() layer=sprite:newLayer();layer.name=params.name end)
  local result=M.get_document_info(params)
  for _,item in ipairs(result.layers) do if layer_handles[item.layerId]==layer then return {documentId=params.documentId,layerId=item.layerId,name=layer.name} end end
  fail('COMMAND_FAILED','Created layer could not be inspected.')
end
function M.read_pixels(params)
  local sprite,layer,frame=target(params)
  integer(params.x,0,sprite.width-1,'x');integer(params.y,0,sprite.height-1,'y')
  integer(params.width,1,sprite.width-params.x,'width');integer(params.height,1,sprite.height-params.y,'height')
  if params.width*params.height>16384 then fail('LIMIT_EXCEEDED','Read at most 16384 pixels per call.') end
  local pixels={};local cel=layer:cel(frame)
  for y=params.y,params.y+params.height-1 do for x=params.x,params.x+params.width-1 do pixels[#pixels+1]={x=x,y=y,rgba=unpacked(cel_pixel(cel,x,y))} end end
  return {documentId=params.documentId,layerId=params.layerId,frame=frame,pixels=pixels}
end
function M.draw_pixels(params)
  local sprite,layer,frame=target(params);editable(layer)
  if type(params.pixels)~='table' or #params.pixels<1 or #params.pixels>16384 then fail('INVALID_ARGUMENT','Supply between 1 and 16384 pixels.') end
  short_string(params.label,'label')
  local cel=layer:cel(frame)
  if cel then
    for _,other in ipairs(sprite.cels) do if other~=cel and other.image.id==cel.image.id then fail('LINKED_CEL','Unlink the target cel before making a frame-only edit.') end end
  end
  local mask,colors,seen={},{},{}
  if params.allowedMask then
    if #params.allowedMask<1 or #params.allowedMask>16384 then fail('INVALID_ARGUMENT','Invalid edit mask.') end
    for _,p in ipairs(params.allowedMask) do integer(p.x,0,sprite.width-1,'mask x');integer(p.y,0,sprite.height-1,'mask y');mask[p.y*sprite.width+p.x]=true end
  end
  if params.allowedColors then
    if #params.allowedColors<1 or #params.allowedColors>256 then fail('INVALID_ARGUMENT','Invalid color constraint.') end
    for _,rgba in ipairs(params.allowedColors) do colors[packed(rgba)]=true end
  end
  -- Validate the entire patch against current pixels before creating any image or undo entry.
  for _,p in ipairs(params.pixels) do
    integer(p.x,0,sprite.width-1,'x');integer(p.y,0,sprite.height-1,'y')
    local key=p.y*sprite.width+p.x;local pixel=packed(p.rgba)
    if seen[key] then fail('INVALID_ARGUMENT','Duplicate pixel coordinate.') end;seen[key]=true
    if params.allowedMask and not mask[key] then fail('OUTSIDE_MASK','Pixel is outside the agreed edit mask.') end
    if params.allowedColors and not colors[pixel] then fail('COLOR_CONSTRAINT','Pixel is not an allowed RGBA color.') end
    if cel and not p.expected then fail('EXPECTED_PIXELS_REQUIRED','Read current pixels and supply expected RGBA values for existing cels.') end
    if p.expected and packed(p.expected)~=cel_pixel(cel,p.x,p.y) then fail('STALE_STATE','Pixels changed after inspection. Read them again before editing.') end
  end
  -- Preserve the entire original cel, including pixels outside the canvas.
  -- Expand its bounds only as far as the patch requires, rather than cropping it.
  local left,top,right,bottom
  if cel then
    left,top=cel.position.x,cel.position.y
    right,bottom=left+cel.image.width-1,top+cel.image.height-1
  else
    left,top=params.pixels[1].x,params.pixels[1].y;right,bottom=left,top
  end
  for _,p in ipairs(params.pixels) do left=math.min(left,p.x);top=math.min(top,p.y);right=math.max(right,p.x);bottom=math.max(bottom,p.y) end
  local width,height=right-left+1,bottom-top+1
  if width>512 or height>512 then fail('LIMIT_EXCEEDED','Preserving this cel would exceed the 512 by 512 image limit. No pixels were changed.') end
  local copy=Image(width,height,ColorMode.RGB)
  if cel then
    -- Exact copy; no blending or opacity changes to existing pixels.
    for y=0,cel.image.height-1 do for x=0,cel.image.width-1 do copy:drawPixel(x+cel.position.x-left,y+cel.position.y-top,cel.image:getPixel(x,y)) end end
  end
  for _,p in ipairs(params.pixels) do copy:drawPixel(p.x-left,p.y-top,packed(p.rgba)) end
  app.transaction(params.label,function()
    if cel then cel.image=copy;cel.position=Point(left,top) else sprite:newCel(layer,frame,copy,Point(left,top)) end
  end)
  app.refresh()
  return {documentId=params.documentId,layerId=params.layerId,frame=frame,changedPixels=#params.pixels}
end
function M.get_preview(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  local frame=integer(params.frame or 1,1,#sprite.frames,'frame')
  local image=Image(sprite.width,sprite.height,ColorMode.RGB);image:drawSprite(sprite,frame)
  local hex={}
  for y=0,image.height-1 do for x=0,image.width-1 do local c=unpacked(image:getPixel(x,y));hex[#hex+1]=string.format('%02x%02x%02x%02x',c[1],c[2],c[3],c[4]) end end
  return {documentId=params.documentId,frame=frame,width=image.width,height=image.height,rgbaHex=table.concat(hex)}
end
function M.undo(params)
  local sprite=get_sprite(params.documentId)
  with_active(sprite,function() app.undo() end);app.refresh();return M.get_document_info(params)
end
function M.redo(params)
  local sprite=get_sprite(params.documentId)
  with_active(sprite,function() app.redo() end);app.refresh();return M.get_document_info(params)
end
function M.add_frame(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  if #sprite.frames>=256 then fail('LIMIT_EXCEEDED','At most 256 frames are supported.') end
  integer(params.durationMs,1,60000,'duration')
  app.transaction('Add AI frame',function() local frame=sprite:newEmptyFrame(#sprite.frames+1);frame.duration=params.durationMs/1000 end)
  return M.get_document_info(params)
end
function M.duplicate_frame(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  if #sprite.frames>=256 then fail('LIMIT_EXCEEDED','At most 256 frames are supported.') end
  local source=integer(params.sourceFrame,1,#sprite.frames,'source frame')
  local copies={}
  for _,cel in ipairs(sprite.cels) do
    if cel.frameNumber==source then
      editable(cel.layer)
      copies[#copies+1]={layer=cel.layer,image=cel.image:clone(),position=Point(cel.position.x,cel.position.y),opacity=cel.opacity,zIndex=cel.zIndex}
    end
  end
  local duration=sprite.frames[source].duration
  app.transaction('Duplicate AI frame',function()
    local frame=sprite:newEmptyFrame(#sprite.frames+1)
    frame.duration=duration
    for _,copy in ipairs(copies) do
      local cel=sprite:newCel(copy.layer,frame.frameNumber,copy.image,copy.position)
      if copy.opacity~=nil then cel.opacity=copy.opacity end
      if copy.zIndex~=nil then cel.zIndex=copy.zIndex end
    end
  end)
  app.refresh()
  return M.get_document_info(params)
end
function M.copy_cel(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  local layer=get_layer(sprite,params.layerId);editable(layer)
  local source=integer(params.sourceFrame,1,#sprite.frames,'source frame')
  local destination=integer(params.targetFrame,1,#sprite.frames,'target frame')
  if source==destination then fail('INVALID_ARGUMENT','Source and target frames must differ.') end
  local cel=layer:cel(source)
  if not cel then fail('CEL_MISSING','The source layer has no cel in that frame.') end
  if layer:cel(destination) then fail('CEL_EXISTS','Target frame already has a cel on this layer; no artwork was overwritten.') end
  local copy=cel.image:clone()
  local position=Point(cel.position.x,cel.position.y)
  local opacity,zIndex=cel.opacity,cel.zIndex
  app.transaction('Copy AI cel',function()
    local created=sprite:newCel(layer,destination,copy,position)
    if opacity~=nil then created.opacity=opacity end
    if zIndex~=nil then created.zIndex=zIndex end
  end)
  app.refresh()
  return {documentId=params.documentId,layerId=params.layerId,sourceFrame=source,targetFrame=destination,independent=true}
end
function M.move_cel(params)
  local sprite,layer,frame=target(params);editable(layer)
  local cel=layer:cel(frame)
  if not cel then fail('CEL_MISSING','The target layer has no cel in that frame.') end
  local dx=integer(params.dx,-256,256,'dx')
  local dy=integer(params.dy,-256,256,'dy')
  if dx==0 and dy==0 then fail('INVALID_ARGUMENT','Specify a non-zero movement.') end
  if type(params.allowOffCanvas)~='boolean' then fail('INVALID_ARGUMENT','allowOffCanvas must be boolean.') end
  local x,y=cel.position.x+dx,cel.position.y+dy
  if x < -512 or y < -512 or x+cel.image.width > sprite.width+512 or y+cel.image.height > sprite.height+512 then fail('LIMIT_EXCEEDED','The moved cel exceeds safe position limits.') end
  if not params.allowOffCanvas and (x<0 or y<0 or x+cel.image.width>sprite.width or y+cel.image.height>sprite.height) then
    fail('OUTSIDE_CANVAS','Moving this cel would put part of it outside the canvas. Set allowOffCanvas=true explicitly if intended.')
  end
  app.transaction('Move AI cel',function() cel.position=Point(x,y) end)
  app.refresh()
  return {documentId=params.documentId,layerId=params.layerId,frame=frame,x=x,y=y,width=cel.image.width,height=cel.image.height}
end
function M.set_frame_duration(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  local frame=integer(params.frame,1,#sprite.frames,'frame')
  integer(params.durationMs,1,60000,'duration')
  app.transaction('Set AI frame duration',function() sprite.frames[frame].duration=params.durationMs/1000 end)
  return M.get_document_info(params)
end
function M.create_animation_tag(params)
  local sprite=get_sprite(params.documentId);check_canvas(sprite)
  short_string(params.name,'tag name')
  local first=integer(params.fromFrame,1,#sprite.frames,'tag start frame')
  local last=integer(params.toFrame,1,#sprite.frames,'tag end frame')
  if first>last then fail('INVALID_ARGUMENT','Tag start frame must not be after its end frame.') end
  integer(params.repeats,0,1000,'tag repeats')
  local directions={forward=AniDir.FORWARD,reverse=AniDir.REVERSE,ping_pong=AniDir.PING_PONG,ping_pong_reverse=AniDir.PING_PONG_REVERSE}
  if type(params.direction)~='string' or not directions[params.direction] then fail('INVALID_ARGUMENT','Unsupported animation direction.') end
  for _,tag in ipairs(sprite.tags) do if tag.name==params.name then fail('TAG_EXISTS','A tag with this name already exists; choose a new name.') end end
  app.transaction('Create AI animation tag',function()
    local tag=sprite:newTag(first,last)
    tag.name=params.name;tag.aniDir=directions[params.direction];tag.repeats=params.repeats
  end)
  return M.get_document_info(params)
end
function M.set_layer_properties(params)
  local sprite=get_sprite(params.documentId);local layer=get_layer(sprite,params.layerId);editable(layer)
  if params.visible==nil and params.opacity==nil then fail('INVALID_ARGUMENT','Specify visibility or opacity.') end
  if params.visible~=nil and type(params.visible)~='boolean' then fail('INVALID_ARGUMENT','Visibility must be boolean.') end
  if params.opacity~=nil then integer(params.opacity,0,255,'opacity') end
  app.transaction('Change AI layer',function() if params.visible~=nil then layer.isVisible=params.visible end;if params.opacity~=nil then layer.opacity=params.opacity end end)
  return M.get_document_info(params)
end
function M.save_copy(params)
  local sprite=get_sprite(params.documentId)
  if type(params.stagingPath)~='string' or params.stagingPath:sub(-9)~='.aseprite' then fail('INVALID_ARGUMENT','A staging .aseprite path is required.') end
  sprite:saveCopyAs(params.stagingPath)
  return {savedCopy=true,documentId=params.documentId}
end
function M.open_document(params)
  local sprite=app.open(params.inputPath)
  if not sprite then fail('OPEN_FAILED','Could not open the saved sprite.') end
  return M.get_document_info({documentId=sprite_handle(sprite)})
end
local art_capabilities={}
function M.attach_art(factory)
  local art=factory{get_sprite=get_sprite,get_layer=get_layer,check_canvas=check_canvas,editable=editable,fail=fail}
  for _,method in ipairs(art.capabilities()) do M[method]=art[method];art_capabilities[#art_capabilities+1]=method end
end
function M.capabilities()
  local result={'list_documents','get_document_info','create_sprite','create_layer','read_pixels','draw_pixels','get_preview','undo','redo','add_frame','duplicate_frame','copy_cel','move_cel','set_frame_duration','create_animation_tag','set_layer_properties','save_copy'}
  for _,method in ipairs(art_capabilities) do result[#result+1]=method end
  return result
end
function M.dispatch(method, params)
  if method=='dispatch' or method=='capabilities' or method=='open_document' or type(M[method])~='function' then fail('UNKNOWN_OPERATION','Unsupported editor operation.') end
  return M[method](params)
end
return M
