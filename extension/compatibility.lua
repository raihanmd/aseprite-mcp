-- Feature checks deliberately do not pin one exact Aseprite release.
-- They do not open sockets, create sprites, or prove editor behavior/permissions.
local M={minimumApiVersion=25,extensionVersion='0.1.7'}
local function callable(value)
  if type(value)=='function' then return true end
  local meta=getmetatable(value)
  return type(meta)=='table' and type(meta.__call)=='function'
end
function M.inspect(codec)
  local features,missing={},codec.array()
  local function check(name,operation)
    local ok,value=pcall(operation);features[name]=ok and value==true
    if not features[name] then missing[#missing+1]=name end
  end
  check('apiVersion',function() return type(app.apiVersion)=='number' and app.apiVersion%1==0 and app.apiVersion>=M.minimumApiVersion end)
  check('editorUI',function() return app.isUIAvailable==true end)
  check('jsonDecode',function() return callable(json.decode) end)
  check('jsonEncode',function() return callable(json.encode) end)
  check('jsonMessages',function()
    local value=codec.decode('{"rgba":[1,2,3,4],"empty":[],"flag":false}')
    return type(value)=='table' and type(value.rgba)=='table' and #value.rgba==4 and value.rgba[4]==4 and value.flag==false and
      codec.encode(value):find('"empty":[]',1,true)~=nil
  end)
  check('websocket',function() return callable(WebSocket) end)
  check('websocketEvents',function() return WebSocketMessageType.OPEN~=nil and WebSocketMessageType.TEXT~=nil and WebSocketMessageType.CLOSE~=nil and WebSocketMessageType.ERROR~=nil end)
  check('dialog',function() return callable(Dialog) end)
  check('sprite',function() return callable(Sprite) end)
  check('image',function() return callable(Image) end)
  check('point',function() return callable(Point) end)
  check('rgbMode',function() return ColorMode.RGB~=nil end)
  check('transaction',function() return callable(app.transaction) end)
  check('undo',function() return callable(app.undo) end)
  check('redo',function() return callable(app.redo) end)
  check('refresh',function() return callable(app.refresh) end)
  check('rgba',function() local pc=app.pixelColor;return callable(pc.rgba) and callable(pc.rgbaR) and callable(pc.rgbaG) and callable(pc.rgbaB) and callable(pc.rgbaA) end)
  return {checkVersion=1,ready=#missing==0,features=features,missing=missing,workflowVerified=false}
end
function M.describe(report)
  return 'Aseprite '..tostring(app.version)..' / API '..tostring(app.apiVersion or 'unknown')..' / extension '..M.extensionVersion..'\n'..
    (report.ready and 'Connection feature checks passed. Editor behavior is not yet verified.' or 'Cannot connect. Missing or failing checks: '..table.concat(report.missing,', '))
end
return M
