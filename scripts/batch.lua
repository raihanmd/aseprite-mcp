-- This fixed runner executes only named bounded operations. It never loads Lua
-- supplied by an MCP argument, and never saves over an input file.
local request_file=assert(io.open(assert(app.params.request),'rb'))
local text=request_file:read(1024*1024+1);request_file:close()
assert(#text<=1024*1024,'Request too large')
-- Load our codec from the runner's location before trusting decoded requests.
local module_root=assert(app.params.moduleRoot)
local codec=dofile(app.fs.joinPath(module_root,'codec.lua'))
local request=codec.decode(text)
assert(request.version==1 and type(request.args)=='table','Invalid batch request')
local operations=dofile(app.fs.joinPath(module_root,'operations.lua'))
operations.attach_art(dofile(app.fs.joinPath(module_root,'art_operations.lua')))
local function fail(code,message)error({code=code,message=message},0)end
local function run()
  if type(app.apiVersion)~='number' or app.apiVersion<25 or app.isUIAvailable~=false then fail('UNSUPPORTED_API','File jobs require a supported API in --batch mode.') end
  local args=request.args
  local document
  if request.method=='batch_create_sprite' then
    document=operations.create_sprite({width=args.width,height=args.height,name=args.name})
    local layer=operations.create_layer({documentId=document.documentId,name=args.layerName})
    if #args.pixels>0 then operations.draw_pixels({documentId=document.documentId,layerId=layer.layerId,frame=1,pixels=args.pixels,label='Create file asset'}) end
  elseif request.method=='batch_inspect_sprite' or request.method=='batch_edit_sprite' then
    document=operations.open_document({inputPath=request.inputPath})
  else fail('INVALID_ARGUMENT','Unknown file workflow') end
  local id=document.documentId
  local function layer_id(index)
    if type(index)~='number' or index%1~=0 or index<1 then fail('INVALID_ARGUMENT','Invalid layer index') end
    local info=operations.get_document_info({documentId=id})
    if not info.layers[index] then fail('INVALID_ARGUMENT','Layer index is not present') end
    return info.layers[index].layerId
  end
  if request.method=='batch_edit_sprite' then
    for _,step in ipairs(args.operations) do
      local params={documentId=id}
      for key,value in pairs(step) do if key~='method' and key~='layerIndex' then params[key]=value end end
      if step.method=='draw_pixels' or step.method=='set_layer_properties' then params.layerId=layer_id(step.layerIndex)
      elseif step.method~='add_frame' and step.method~='undo' and step.method~='redo' then fail('INVALID_ARGUMENT','Unsupported file operation') end
      operations.dispatch(step.method,params)
    end
  end
  local info=operations.get_document_info({documentId=id})
  if #info.layers>256 or #info.frames>256 then fail('LIMIT_EXCEEDED','File metadata exceeds this release limits') end
  local pixels
  if args.region then
    local params={documentId=id,layerId=layer_id(args.region.layerIndex)}
    for key,value in pairs(args.region) do if key~='layerIndex' then params[key]=value end end
    pixels=operations.read_pixels(params).pixels
  end
  local rendered=operations.get_preview({documentId=id,frame=args.frame})
  if request.method~='batch_inspect_sprite' then
    operations.save_copy({documentId=id,stagingPath=request.outputPath})
    -- Reopen the saved copy before reporting success. Compare the selected
    -- render, layer state and frame timings, not just existence of a file.
    local reopened=operations.open_document({inputPath=request.outputPath})
    local check=operations.get_preview({documentId=reopened.documentId,frame=args.frame})
    if check.width~=rendered.width or check.height~=rendered.height or check.rgbaHex~=rendered.rgbaHex or #reopened.layers~=#info.layers or #reopened.frames~=#info.frames then fail('ROUNDTRIP_FAILED','Saved copy differs from the requested artwork') end
    for i,layer in ipairs(info.layers) do local other=reopened.layers[i];if other.name~=layer.name or other.group~=layer.group or other.visible~=layer.visible or other.opacity~=layer.opacity then fail('ROUNDTRIP_FAILED','Saved layer state differs') end end
    for i,frame in ipairs(info.frames) do if reopened.frames[i].durationMs~=frame.durationMs then fail('ROUNDTRIP_FAILED','Saved frame timing differs') end end
  end
  for index,layer in ipairs(info.layers) do
    layer.layerIndex=index;layer.layerId=nil
    layer.parentLayerId=nil;layer.stackIndex=nil;layer.blendMode=nil;layer.background=nil
  end
  -- Handles/temporary paths are process-local, not future live-editor targets.
  -- Keep this file-job reply on its published contract. Rich live-only cel
  -- handles/tags are not yet part of batch inspection or parity guarantees.
  info.documentId=nil;info.filename=nil;info.cels=nil;info.tags=nil
  return {ok=true,workflow='batch',editorVersion=tostring(app.version),apiVersion=app.apiVersion,document=info,preview=rendered,pixels=pixels}
end
local ok,value=pcall(run)
local response=ok and value or {ok=false,error=type(value)=='table' and value or {code='COMMAND_FAILED',message='File operation failed; no result was published.'}}
local output=assert(io.open(request.resultPath,'wb'));output:write(codec.encode(response));output:close()
