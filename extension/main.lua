local socket, session, operations, extension, codec, compatibility
local cache, cache_order = {}, {}
local connection_status='Not paired. Use Connect Aseprite MCP.'
local feedback
local function close_feedback()
  local old=feedback;feedback=nil
  if old then pcall(function() old:close() end) end
end
local function status_lines(message)
  local lines={}
  while #message>0 and #lines<6 do
    local cut=math.min(64,#message)
    if #message>cut then
      local space=message:sub(1,cut):match('.*() ')
      if space and space>=54 then cut=space end
    end
    lines[#lines+1]=message:sub(1,cut):gsub('%s+$','')
    message=message:sub(cut+1):gsub('^%s+','')
  end
  if #message>0 then lines[6]=lines[6]:sub(1,61)..'...' end
  return lines
end
local function set_status(message)
  connection_status=message
  if not feedback then return end
  local lines=status_lines(message)
  local updated=pcall(function()
    for i=1,6 do feedback:modify{id='status_'..i,text=lines[i] or ''} end
  end)
  -- A UI failure must not interrupt pairing or an editor operation.
  if not updated then close_feedback() end
end
local function show_feedback()
  close_feedback()
  local window
  local shown=pcall(function()
    window=Dialog{title='Aseprite MCP Connection',onclose=function()
      if feedback==window then feedback=nil end
    end}
    local lines=status_lines(connection_status)
    for i=1,6 do
      window:label{id='status_'..i,text=lines[i] or ''}:newrow()
    end
    window:label{text='Closing this window leaves the connection running.'}:newrow()
    window:button{text='Close Status',focus=true,onclick=function() window:close() end}
    feedback=window
    -- A modal status dialog would block WebSocket callbacks during pairing.
    window:show{wait=false}
  end)
  if not shown then
    if feedback==window then feedback=nil end
    if window then pcall(function() window:close() end) end
  end
end
local function safe_error(value,token)
  local text=type(value)=='string' and value or 'Unknown connection error.'
  if token and #token>0 then text=text:gsub(token:gsub('(%W)','%%%1'),'[redacted]') end
  text=text:gsub('[A-Za-z0-9_-]+',function(part) return #part>=32 and '[redacted]' or part end)
  return text:gsub('[%c]',' '):sub(1,256)
end
local function disconnect()
  local old=socket;socket=nil;session=nil;cache={};cache_order={}
  set_status('Disconnected. Use Connect Aseprite MCP.')
  if old then old:close() end
end
local function stop_with_status(message)
  disconnect();set_status(message)
end
local function connect()
  local report=compatibility.inspect(codec)
  if not report.ready then set_status(compatibility.describe(report));app.alert(connection_status);return end
  local dialog=Dialog('Connect Aseprite MCP')
  dialog:entry{id='port',label='Local port',text=tostring(extension.preferences.port or 32123)}
  dialog:entry{id='token',label='Pairing token',text=''}
  dialog:button{id='connect',text='Connect'}:button{id='cancel',text='Cancel'}:show()
  local data=dialog.data
  if not data.connect then return end
  local port=tonumber(data.port)
  if not port or port%1~=0 or port<1024 or port>65535 or type(data.token)~='string' or #data.token<32 or #data.token>256 then app.alert('Enter a port from 1024 to 65535 and the pairing token from setup.');return end
  disconnect();extension.preferences.port=port
  set_status('Connecting to the local server on port '..port..'...')
  show_feedback()
  local token=data.token
  local ws
  local socket_error_status
  local created,value=pcall(function() return WebSocket{url='ws://127.0.0.1:'..port..'/aseprite',deflate=false,onreceive=function(kind,text,connection_error)
    if not ws or socket~=ws then return end
    if kind==WebSocketMessageType.OPEN then
      session=nil;cache={};cache_order={}
      socket_error_status=nil
      set_status('Server reached. Waiting for pairing confirmation...')
      local sent,send_error=pcall(function()
        local current=compatibility.inspect(codec)
        if not current.ready then stop_with_status(compatibility.describe(current));return end
        ws:sendText(codec.encode{type='hello',bridgeVersion=1,token=token,editorVersion=tostring(app.version),apiVersion=app.apiVersion,extensionVersion=compatibility.extensionVersion,compatibility=current,capabilities=operations.capabilities()})
      end)
      if not sent then stop_with_status('Could not send the pairing request: '..safe_error(send_error,token)) end
    elseif kind==WebSocketMessageType.TEXT then
      local ok,result=pcall(function()
        if #text>1024*1024 then error('Message too large') end
        local message=codec.decode(text)
        if message.type=='hello_ack' and message.bridgeVersion==1 and type(message.sessionId)=='string' then session=message.sessionId;set_status('Paired with the local MCP server on port '..port..'.');return end
        if not session or message.type~='request' or message.bridgeVersion~=1 or message.sessionId~=session or type(message.id)~='string' or #message.id>80 then error('Invalid request') end
        local prior=cache[message.id]
        if prior then if prior.request~=text then error('Request ID reused') end;ws:sendText(prior.reply);return end
        local success,value=pcall(operations.dispatch,message.method,message.params)
        local reply={type='response',bridgeVersion=1,sessionId=session,id=message.id,ok=success}
        if success then reply.result=value else reply.error=type(value)=='table' and value or {code='COMMAND_FAILED',message='Editor operation failed; inspect the Lua console.'} end
        local encoded=codec.encode(reply)
        cache[message.id]={request=text,reply=encoded};cache_order[#cache_order+1]=message.id
        if #cache_order>32 then cache[table.remove(cache_order,1)]=nil end
        ws:sendText(encoded)
      end)
      if not ok then stop_with_status('Invalid server message. Restart the MCP server and reconnect; no operation is automatically retried.') end
    elseif kind==WebSocketMessageType.ERROR then
      session=nil
      set_status('Connection error on port '..port..': '..safe_error(connection_error,token))
      socket_error_status=connection_status
    elseif kind==WebSocketMessageType.CLOSE then
      local was_paired=session~=nil;session=nil
      set_status(socket_error_status or (was_paired and 'The paired server disconnected. Check that your MCP client is still running.' or 'Pairing was not confirmed. Check the token from this project setup and restart the MCP client if needed.'))
    end
  end} end)
  if not created then stop_with_status('Cannot open the local connection: '..safe_error(value,token));app.alert(connection_status);return end
  ws=value;socket=ws
  local started,start_error=pcall(function() ws:connect() end)
  if not started then stop_with_status('Cannot start the local connection: '..safe_error(start_error,token));app.alert(connection_status) end
end
function init(plugin)
  extension=plugin
  codec=dofile(app.fs.joinPath(plugin.path,'codec.lua'))
  compatibility=dofile(app.fs.joinPath(plugin.path,'compatibility.lua'))
  operations=dofile(app.fs.joinPath(plugin.path,'operations.lua'))
  if operations.attach_art then operations.attach_art(dofile(app.fs.joinPath(plugin.path,'art_operations.lua'))) end
  plugin:newCommand{id='AsepriteMcpConnect',title='Connect Aseprite MCP...',group='file_scripts',onclick=connect}
  plugin:newCommand{id='AsepriteMcpDisconnect',title='Disconnect Aseprite MCP',group='file_scripts',onclick=disconnect}
  plugin:newCommand{id='AsepriteMcpStatus',title='Aseprite MCP Connection Status',group='file_scripts',onclick=function() app.alert(connection_status) end}
  plugin:newCommand{id='AsepriteMcpCompatibility',title='Check Aseprite MCP Compatibility',group='file_scripts',onclick=function() app.alert(compatibility.describe(compatibility.inspect(codec))) end}
end
function exit(plugin) disconnect();close_feedback() end
