-- Policy tests with mocked API globals; not evidence about an editor release.
local compatibility=dofile('extension/compatibility.lua')
local codec={array=function() return {} end,decode=function() return {rgba={1,2,3,4},empty={},flag=false} end,encode=function() return '{"empty":[]}' end}
local function noop() end
app={apiVersion=39,version='mock-baseline',isUIAvailable=true,transaction=noop,undo=noop,redo=noop,refresh=noop,pixelColor={rgba=noop,rgbaR=noop,rgbaG=noop,rgbaB=noop,rgbaA=noop}}
json={decode=noop,encode=noop};WebSocket=noop;Dialog=noop;Sprite=noop;Image=noop;Point=noop;ColorMode={RGB=0}
WebSocketMessageType={OPEN=1,TEXT=2,CLOSE=3,ERROR=4}
local report=compatibility.inspect(codec)
assert(report.ready and not report.workflowVerified and #report.missing==0)
app.apiVersion=100;app.version='future-mock';assert(compatibility.inspect(codec).ready)
app.apiVersion=nil;report=compatibility.inspect(codec);assert(not report.ready and report.features.apiVersion==false)
app.apiVersion=24;assert(not compatibility.inspect(codec).ready);app.apiVersion=39
WebSocket=nil;report=compatibility.inspect(codec);assert(not report.ready and report.features.websocket==false);WebSocket=noop
app.transaction=nil;report=compatibility.inspect(codec);assert(not report.ready and report.features.transaction==false);app.transaction=noop
codec.decode=function() error('Changed native JSON behavior') end
report=compatibility.inspect(codec);assert(not report.ready and report.features.jsonMessages==false)
assert(compatibility.describe(report):find('jsonMessages',1,true))
app.apiVersion=nil;assert(compatibility.describe(report):find('unknown',1,true))
print('Compatibility policy tests passed: missing features, changed JSON, and future API levels (mock only)')
