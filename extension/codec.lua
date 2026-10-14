-- Isolate Aseprite's table-like JSON objects from our ordinary Lua operations.
-- Native decoding validates JSON. Our encoder preserves empty arrays and nulls
-- without embedding native userdata inside Lua tables (which can become null).
local M={null={}}
local array_marker={__aseprite_mcp_array=true}
function M.array(value) return setmetatable(value or {},array_marker) end
local function marked_array(value)
  local meta=getmetatable(value)
  return type(meta)=='table' and meta.__aseprite_mcp_array==true
end
local function normalize(value,depth,budget)
  budget.remaining=budget.remaining-1
  if depth>32 or budget.remaining<0 then error('JSON structure exceeds limits',0) end
  if value==nil then return M.null end
  local kind=type(value)
  if kind~='table' and kind~='userdata' then return value end
  local is_array=false
  if kind=='userdata' then
    -- Encoding a native object at the root is supported by Aseprite's JSON API.
    local text=json.encode(value)
    if type(text)~='string' then error('Unsupported native JSON object',0) end
    local first=text:match('^%s*(.)')
    if first=='[' then is_array=true
    elseif first~='{' then error('JSON message must contain objects or arrays',0) end
  else is_array=#value>0 end
  local result=is_array and M.array() or {}
  if is_array then
    -- Numeric indexing avoids depending on native JSON array iterator behavior.
    for i=1,#value do result[i]=normalize(value[i],depth+1,budget) end
  else
    for key,item in pairs(value) do
      if type(key)~='string' then error('JSON object key must be a string',0) end
      result[key]=normalize(item,depth+1,budget)
    end
  end
  return result
end
function M.decode(text)
  if type(text)~='string' or #text>1024*1024 then error('JSON message exceeds limits',0) end
  local native=json.decode(text)
  local first=text:match('^%s*(.)')
  if first~='{' and first~='[' then error('JSON message must be an object or array',0) end
  local result=normalize(native,0,{remaining=250000})
  if first=='[' then M.array(result) end
  return result
end
local function quoted(value)
  return '"'..value:gsub('[%z\1-\31\\"]',function(character)
    if character=='"' then return '\\"' elseif character=='\\' then return '\\\\' end
    return string.format('\\u%04x',string.byte(character))
  end)..'"'
end
local function encode(value,depth,seen,budget)
  budget.remaining=budget.remaining-1
  if depth>32 or budget.remaining<0 then error('JSON structure exceeds limits',0) end
  if value==M.null or value==nil then return 'null' end
  local kind=type(value)
  if kind=='string' then return quoted(value)
  elseif kind=='boolean' then return value and 'true' or 'false'
  elseif kind=='number' then
    if value~=value or value==math.huge or value==-math.huge then error('Non-finite JSON number',0) end
    return tostring(value)
  elseif kind~='table' then error('Only normalized Lua values can be encoded',0) end
  if seen[value] then error('Cyclic JSON value',0) end;seen[value]=true
  local result={}
  local is_array=marked_array(value) or #value>0
  if is_array then
    local length=#value
    for key in pairs(value) do if type(key)~='number' or key%1~=0 or key<1 or key>length then error('Invalid JSON array key',0) end end
    for i=1,length do result[i]=encode(value[i],depth+1,seen,budget) end
  else
    for key,item in pairs(value) do
      if type(key)~='string' then error('JSON object key must be a string',0) end
      result[#result+1]=quoted(key)..':'..encode(item,depth+1,seen,budget)
    end
    table.sort(result)
  end
  seen[value]=nil
  return (is_array and '[' or '{')..table.concat(result,',')..(is_array and ']' or '}')
end
function M.encode(value)
  local text=encode(value,0,{},{remaining=250000})
  if #text>1024*1024 then error('JSON message exceeds limits',0) end
  return text
end
return M
