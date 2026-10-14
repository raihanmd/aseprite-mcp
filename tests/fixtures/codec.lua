-- Native-like userdata fixtures model Aseprite's documented table-like JSON.
-- No real editor or real native decoder is present in this unit test.
local codec=dofile('extension/codec.lua')
local files={}
local function native(value,is_array)
  local file=assert(io.tmpfile());local original=getmetatable(file)
  files[#files+1]={file=file,original=original}
  local meta={
    __len=function() return #value end,
    __index=function(_,key) return value[key] end,
    __pairs=function() if is_array then error('Native arrays must use numeric indexing') end;return next,value,nil end,
  }
  debug.setmetatable(file,meta)
  meta.__json_mock_kind=is_array and '[' or '{'
  return file
end
json={encode=function(value) return getmetatable(value).__json_mock_kind..(getmetatable(value).__json_mock_kind=='[' and ']' or '}') end}
local rgba=native({255,0,0,255},true)
local pixel=native({x=1,y=2,rgba=rgba},false)
local message=native({pixels=native({pixel},true),empty=native({},true),flag=false,name='quote"\\\n雨'},false)
json.decode=function(text) assert(text=='{"mock":true}');return message end
local decoded=codec.decode('{"mock":true}')
assert(type(decoded)=='table' and type(decoded.pixels)=='table' and type(decoded.pixels[1].rgba)=='table')
assert(decoded.pixels[1].rgba[1]==255 and decoded.pixels[1].rgba[4]==255)
assert(decoded.flag==false and #decoded.empty==0)
local encoded=codec.encode(decoded)
assert(encoded:find('"empty":[]',1,true))
assert(codec.encode({documents=codec.array()})=='{"documents":[]}')
assert(codec.encode({object={}})=='{"object":{}}')
assert(codec.encode({value=codec.null})=='{"value":null}')
local cycle={};cycle.self=cycle;assert(not pcall(codec.encode,cycle))
assert(not pcall(codec.encode,{number=math.huge}))
assert(not pcall(codec.encode,{[2]='sparse'}))
assert(not pcall(codec.decode,string.rep('x',1024*1024+1)))
-- Also accept a decoder which yields ordinary Lua tables.
json.decode=function() return {pixels={{x=3,y=4,rgba={1,2,3,4}}}} end
assert(codec.decode('{}').pixels[1].rgba[4]==4)
local output=assert(io.open(arg[1],'w'));output:write(encoded);output:close()
for _,item in ipairs(files) do debug.setmetatable(item.file,item.original);item.file:close() end
print('Codec tests passed: native-like userdata and plain tables (not an Aseprite runtime check)')
