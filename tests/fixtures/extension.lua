-- Mocked plugin/socket lifecycle only; never opens Aseprite or a network socket.
local actual_dofile=dofile
local codec=actual_dofile('extension/codec.lua')
local token=string.rep('a',64)
local commands,alerts,sockets,windows={},{},{},{}
local compatible=true
local dialog_data={connect=true,port='32123',token=token}
local create_error,start_error,send_error
local ui_create_error,ui_show_error,ui_modify_error,emit_during_create
local dispatches=0
local report={checkVersion=1,ready=true,features={},missing=codec.array(),workflowVerified=false}
local compatibility={extensionVersion='0.1.3',inspect=function() report.ready=compatible;return report end,describe=function() return 'Compatibility failed.' end}
dofile=function(path)
  if path=='mock/codec.lua' then return codec end
  if path=='mock/compatibility.lua' then return compatibility end
  if path=='mock/operations.lua' then return {capabilities=function() return {'list_documents'} end,dispatch=function() dispatches=dispatches+1;return {documents=codec.array()} end} end
  return actual_dofile(path)
end
app={version='mock-editor',apiVersion=41,fs={joinPath=function(a,b) return a..'/'..b end},alert=function(message) alerts[#alerts+1]=message end}
Dialog=function(options)
  local is_feedback=type(options)=='table'
  if is_feedback and ui_create_error then error('Mock feedback unavailable',0) end
  local dialog={data=dialog_data,options=options,labels={},closed=false}
  for _,method in ipairs({'entry','newrow'}) do dialog[method]=function(self) return self end end
  function dialog:label(widget) if widget.id then self.labels[widget.id]=widget.text end;return self end
  function dialog:button(widget) if widget.onclick then self.close_button=widget.onclick end;return self end
  function dialog:show(params)
    self.show_options=params
    if is_feedback and ui_show_error then error('Mock show failed',0) end
    return self
  end
  function dialog:modify(widget)
    if ui_modify_error then error('Mock update failed',0) end
    self.labels[widget.id]=widget.text;return self
  end
  function dialog:close()
    self.closed=true
    if is_feedback and self.options.onclose then self.options.onclose() end
  end
  if is_feedback then windows[#windows+1]=dialog end
  return dialog
end
WebSocketMessageType={OPEN=1,TEXT=2,CLOSE=3,ERROR=4}
WebSocket=function(options)
  if create_error then error(create_error,0) end
  local ws={options=options,sent={},closed=false}
  function ws:connect() if start_error then error(start_error,0) end end
  function ws:sendText(text) if send_error then error(send_error,0) end;self.sent[#self.sent+1]=text end
  function ws:close() self.closed=true;self.options.onreceive(WebSocketMessageType.CLOSE,'','') end
  function ws:emit(kind,text,err) self.options.onreceive(kind,text or '',err or '') end
  if emit_during_create then ws:emit(WebSocketMessageType.ERROR,'','Early callback must be ignored') end
  sockets[#sockets+1]=ws;return ws
end
json={decode=function(text)
  if text=='{"mock":"ack"}' then return {type='hello_ack',bridgeVersion=1,sessionId='mock-session'} end
  if text=='{"mock":"request"}' then return {type='request',bridgeVersion=1,sessionId='mock-session',id='request-1',method='list_documents',params={}} end
  error('Invalid mock JSON',0)
end}
local plugin={path='mock',preferences={},newCommand=function(_,command) commands[command.id]=command.onclick end}
actual_dofile('extension/main.lua');init(plugin)
local function status()
  commands.AsepriteMcpStatus();local text=alerts[#alerts]
  assert(not text:find(token,1,true),'Status leaked a pairing token');return text
end
local function visible_status(window)
  local lines={}
  for i=1,6 do
    local line=window.labels['status_'..i]
    assert(type(line)=='string' and #line<=64,'Status labels must be bounded')
    assert(not line:find(token,1,true),'Feedback leaked a pairing token')
    lines[#lines+1]=line
  end
  return table.concat(lines,' ')
end
assert(status():find('Not paired',1,true))
commands.AsepriteMcpConnect();local first=sockets[#sockets]
local first_window=windows[#windows]
assert(first_window.show_options.wait==false and visible_status(first_window):find('Connecting',1,true))
assert(first.options.url=='ws://127.0.0.1:32123/aseprite' and first.options.deflate==false)
assert(status():find('Connecting',1,true) and plugin.preferences.port==32123 and plugin.preferences.token==nil)
first:emit(WebSocketMessageType.OPEN)
assert(visible_status(first_window):find('Waiting for pairing',1,true))
assert(status():find('Waiting for pairing',1,true) and #first.sent==1)
assert(first.sent[1]:find('"type":"hello"',1,true) and first.sent[1]:find(token,1,true))
first:emit(WebSocketMessageType.TEXT,'{"mock":"ack"}');assert(status():find('Paired with',1,true))
assert(visible_status(first_window):find('Paired with',1,true))
first_window.close_button();assert(first_window.closed and not first.closed and status():find('Paired with',1,true))
first:emit(WebSocketMessageType.TEXT,'{"mock":"request"}');first:emit(WebSocketMessageType.TEXT,'{"mock":"request"}');assert(dispatches==1)
dialog_data={connect=false};commands.AsepriteMcpConnect();assert(status():find('Paired with',1,true) and #sockets==1)
first:emit(WebSocketMessageType.CLOSE);assert(status():find('paired server disconnected',1,true))
dialog_data={connect=true,port='32123',token=token};commands.AsepriteMcpConnect();local second=sockets[#sockets]
local second_window=windows[#windows]
first_window.options.onclose();assert(not second_window.closed)
first:emit(WebSocketMessageType.ERROR,'','old error');assert(status():find('Connecting',1,true))
assert(visible_status(second_window):find('Connecting',1,true))
second:emit(WebSocketMessageType.ERROR,'','HTTP 403 Forbidden '..token..'\n'..string.rep('b',64))
assert(status():find('403 Forbidden',1,true) and status():find('[redacted]',1,true))
assert(visible_status(second_window):find('403 Forbidden',1,true) and visible_status(second_window):find('[redacted]',1,true))
second:emit(WebSocketMessageType.CLOSE);assert(status():find('403 Forbidden',1,true))
assert(visible_status(second_window):find('403 Forbidden',1,true))
second:emit(WebSocketMessageType.OPEN);second:emit(WebSocketMessageType.CLOSE);assert(status():find('Pairing was not confirmed',1,true))
commands.AsepriteMcpConnect();local third=sockets[#sockets]
assert(second_window.closed,'Starting a new connection must replace the old status window')
third:emit(WebSocketMessageType.TEXT,'{"mock":"request"}');assert(third.closed and dispatches==1 and status():find('Invalid server message',1,true))
create_error='permission denied '..token;commands.AsepriteMcpConnect();assert(status():find('Cannot open',1,true));create_error=nil
start_error='startup failed '..token;commands.AsepriteMcpConnect();assert(sockets[#sockets].closed and status():find('Cannot start',1,true));start_error=nil
send_error='send failed '..token;commands.AsepriteMcpConnect();local fourth=sockets[#sockets]
fourth:emit(WebSocketMessageType.OPEN);assert(fourth.closed and status():find('Could not send',1,true));send_error=nil
-- Optional feedback must never be required for pairing or sending messages.
ui_create_error=true;emit_during_create=true;commands.AsepriteMcpConnect();local fifth=sockets[#sockets]
assert(status():find('Connecting',1,true));fifth:emit(WebSocketMessageType.OPEN)
fifth:emit(WebSocketMessageType.TEXT,'{"mock":"ack"}');assert(not fifth.closed and status():find('Paired with',1,true))
ui_create_error=nil;emit_during_create=nil
ui_show_error=true;commands.AsepriteMcpConnect();local sixth=sockets[#sockets]
assert(windows[#windows].closed);sixth:emit(WebSocketMessageType.OPEN)
assert(not sixth.closed and #sixth.sent==1);ui_show_error=nil
commands.AsepriteMcpConnect();local seventh=sockets[#sockets]
ui_modify_error=true;seventh:emit(WebSocketMessageType.OPEN)
assert(windows[#windows].closed and not seventh.closed and #seventh.sent==1)
ui_modify_error=nil;seventh:emit(WebSocketMessageType.TEXT,'{"mock":"ack"}')
assert(status():find('Paired with',1,true))
compatible=false;commands.AsepriteMcpConnect();assert(status()=='Compatibility failed.');compatible=true
dialog_data={connect=true,port='32123'};commands.AsepriteMcpConnect();assert(alerts[#alerts]:find('Enter a port',1,true))
commands.AsepriteMcpDisconnect();assert(status():find('Disconnected',1,true));exit(plugin)
dofile=actual_dofile
print('Mock extension lifecycle passed: nonmodal feedback, connection phases, UI failure isolation, guarded errors, stale callbacks, deduplication and secret redaction (not an editor test).')
