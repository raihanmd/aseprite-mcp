-- Palette, selection, and lossless rectangular edits. The host supplies the
-- document-handle helpers from operations.lua so this module has no own state.
local function create(deps)
  local M = {}
  local get_sprite, get_layer = deps.get_sprite, deps.get_layer
  local check_canvas, editable, fail = deps.check_canvas, deps.editable, deps.fail

  local function integer(value, low, high, name)
    if type(value) ~= 'number' or value % 1 ~= 0 or value < low or value > high then
      fail('INVALID_ARGUMENT', 'Invalid '..name)
    end
    return value
  end
  local function rgba(value, name)
    if type(value) ~= 'table' or #value ~= 4 then fail('INVALID_ARGUMENT', 'Invalid '..name) end
    for i = 1, 4 do integer(value[i], 0, 255, name..' byte') end
    return value
  end
  local function color_array(color)
    return {color.red, color.green, color.blue, color.alpha}
  end
  local function same_color(a, b)
    return a[1] == b[1] and a[2] == b[2] and a[3] == b[3] and a[4] == b[4]
  end
  local function palette_for(sprite)
    local palette = sprite.palettes[1]
    if not palette then fail('PALETTE_MISSING', 'This sprite has no palette.') end
    return palette
  end
  local function bounds(selection)
    if selection.isEmpty then return nil end
    local b = selection.bounds
    return {x=b.x, y=b.y, width=b.width, height=b.height}
  end
  local function selection_state(sprite)
    local selection = sprite.selection
    local b = bounds(selection)
    local first, second, count = 5381, 7807, 0
    local function feed(n)
      first = (first * 33 + n + 1) % 2147483647
      second = (second * 37 + n + 1) % 2147483629
    end
    feed(sprite.width); feed(sprite.height)
    if b then
      feed(b.x); feed(b.y); feed(b.width); feed(b.height)
      for y = math.max(0, b.y), math.min(sprite.height, b.y + b.height) - 1 do
        for x = math.max(0, b.x), math.min(sprite.width, b.x + b.width) - 1 do
          local selected = selection:contains(x, y)
          feed(selected and 1 or 0)
          if selected then count = count + 1 end
        end
      end
    end
    return {
      isEmpty = b == nil,
      bounds = b,
      rectangular = b ~= nil and b.x >= 0 and b.y >= 0
        and b.x + b.width <= sprite.width and b.y + b.height <= sprite.height
        and count == b.width * b.height,
      selectedPixels = count,
      selectionKey = string.format('%08x%08x', first, second),
    }
  end
  local function cel_pixel(cel, x, y)
    if not cel then return 0 end
    local local_x, local_y = x - cel.position.x, y - cel.position.y
    if local_x < 0 or local_y < 0 or local_x >= cel.image.width or local_y >= cel.image.height then return 0 end
    return cel.image:getPixel(local_x, local_y)
  end
  local function pixel_key(cel, b)
    local first, second = 5381, 7807
    local pc = app.pixelColor
    local function feed(n)
      first = (first * 33 + n + 1) % 2147483647
      second = (second * 37 + n + 1) % 2147483629
    end
    feed(b.x); feed(b.y); feed(b.width); feed(b.height)
    for y = b.y, b.y + b.height - 1 do
      for x = b.x, b.x + b.width - 1 do
        local pixel = cel_pixel(cel, x, y)
        feed(pc.rgbaR(pixel)); feed(pc.rgbaG(pixel)); feed(pc.rgbaB(pixel)); feed(pc.rgbaA(pixel))
      end
    end
    return string.format('%08x%08x', first, second)
  end
  local function cel_target(sprite, params)
    local frame = integer(params.frame or 1, 1, #sprite.frames, 'frame')
    local layer = get_layer(sprite, params.layerId)
    if layer.isGroup or layer.isTilemap or layer.isReference then
      fail('UNSUPPORTED_LAYER', 'An ordinary image layer is required.')
    end
    return layer, frame, layer:cel(frame)
  end

  function M.get_palette(params)
    local sprite = get_sprite(params.documentId); check_canvas(sprite)
    local palette = palette_for(sprite)
    local colors = {}
    for index = 0, #palette - 1 do
      colors[#colors + 1] = {index=index, rgba=color_array(palette:getColor(index))}
    end
    return {documentId=params.documentId, size=#palette, colors=colors}
  end

  function M.set_palette_colors(params)
    local sprite = get_sprite(params.documentId); check_canvas(sprite)
    local palette = palette_for(sprite)
    integer(params.expectedSize, 1, 256, 'expected palette size')
    if #palette ~= params.expectedSize then fail('STALE_STATE', 'Palette size changed. Inspect it again.') end
    local size = params.extendTo or #palette
    integer(size, #palette, 256, 'new palette size')
    if type(params.colors) ~= 'table' or #params.colors < 1 or #params.colors > 256 then
      fail('INVALID_ARGUMENT', 'Supply 1 to 256 palette edits.')
    end
    local seen = {}
    for _, item in ipairs(params.colors) do
      local index = integer(item.index, 0, size - 1, 'palette index')
      if seen[index] then fail('INVALID_ARGUMENT', 'Duplicate palette index.') end
      seen[index] = true
      rgba(item.rgba, 'palette color')
      if index < #palette then
        rgba(item.expected, 'expected palette color')
        if not same_color(color_array(palette:getColor(index)), item.expected) then
          fail('STALE_STATE', 'Palette entry changed. Inspect it again.')
        end
      elseif item.expected ~= nil then
        fail('INVALID_ARGUMENT', 'A newly added palette entry must not have an expected color.')
      end
    end
    app.transaction('Edit AI palette', function()
      if size > #palette then palette:resize(size) end
      for _, item in ipairs(params.colors) do
        local c = item.rgba
        palette:setColor(item.index, Color{r=c[1], g=c[2], b=c[3], a=c[4]})
      end
    end)
    app.refresh()
    return M.get_palette(params)
  end

  function M.get_selection(params)
    local sprite = get_sprite(params.documentId); check_canvas(sprite)
    local state = selection_state(sprite)
    state.documentId = params.documentId
    if params.layerId ~= nil then
      local _, frame, cel = cel_target(sprite, params)
      state.layerId = params.layerId
      state.frame = frame
      if state.rectangular then state.pixelKey = pixel_key(cel, state.bounds) end
    elseif params.frame ~= nil then
      fail('INVALID_ARGUMENT', 'A frame requires a layer ID.')
    end
    return state
  end

  function M.set_selection(params)
    local sprite = get_sprite(params.documentId); check_canvas(sprite)
    local before = selection_state(sprite)
    if before.selectionKey ~= params.expectedSelectionKey then
      fail('STALE_STATE', 'Selection changed. Inspect it again.')
    end
    if params.mode ~= 'replace' and params.mode ~= 'clear' then fail('INVALID_ARGUMENT', 'Invalid selection mode.') end
    local rectangle
    if params.mode == 'replace' then
      local r = params.rectangle
      if type(r) ~= 'table' then fail('INVALID_ARGUMENT', 'A selection rectangle is required.') end
      integer(r.x, 0, sprite.width - 1, 'selection x')
      integer(r.y, 0, sprite.height - 1, 'selection y')
      integer(r.width, 1, sprite.width - r.x, 'selection width')
      integer(r.height, 1, sprite.height - r.y, 'selection height')
      rectangle = Rectangle(r.x, r.y, r.width, r.height)
    elseif params.rectangle ~= nil then
      fail('INVALID_ARGUMENT', 'Clear mode must not include a rectangle.')
    end
    app.transaction('Change AI selection', function()
      sprite.selection = rectangle and Selection(rectangle) or Selection()
    end)
    app.refresh()
    return M.get_selection({documentId=params.documentId})
  end

  function M.transform_selection(params)
    local sprite = get_sprite(params.documentId); check_canvas(sprite)
    local state = selection_state(sprite)
    if state.selectionKey ~= params.expectedSelectionKey then
      fail('STALE_STATE', 'Selection changed. Inspect it again.')
    end
    if state.isEmpty then fail('EMPTY_SELECTION', 'Select a rectangular region first.') end
    if not state.rectangular then fail('UNSUPPORTED_SELECTION', 'Only rectangular selections can be transformed.') end
    local layer, frame, cel = cel_target(sprite, params); editable(layer)
    if not cel then fail('EMPTY_REGION', 'The target layer has no cel in this frame.') end
    for _, other in ipairs(sprite.cels) do
      if other ~= cel and other.image.id == cel.image.id then
        fail('LINKED_CEL', 'Unlink this cel before changing only one frame.')
      end
    end
    local b = state.bounds
    if pixel_key(cel, b) ~= params.expectedPixelKey then
      fail('STALE_STATE', 'Selected pixels changed. Inspect them again.')
    end
    local operation = params.operation
    local dx, dy = params.dx or 0, params.dy or 0
    if operation == 'translate' then
      integer(dx, -255, 255, 'dx'); integer(dy, -255, 255, 'dy')
      if dx == 0 and dy == 0 then fail('INVALID_ARGUMENT', 'Translation must move at least one pixel.') end
    elseif operation == 'flip_h' or operation == 'flip_v' or operation == 'rotate_cw' or operation == 'rotate_ccw' then
      if params.dx ~= nil or params.dy ~= nil then fail('INVALID_ARGUMENT', 'Only translation accepts dx and dy.') end
    else
      fail('INVALID_ARGUMENT', 'Unsupported transform.')
    end
    local out_width = (operation == 'rotate_cw' or operation == 'rotate_ccw') and b.height or b.width
    local out_height = (operation == 'rotate_cw' or operation == 'rotate_ccw') and b.width or b.height
    local dest_x, dest_y = b.x + dx, b.y + dy
    if dest_x < 0 or dest_y < 0 or dest_x + out_width > sprite.width or dest_y + out_height > sprite.height then
      fail('OUTSIDE_CANVAS', 'The transformed selection would extend outside the canvas.')
    end
    local source = {}
    local occupied = false
    for y = 0, b.height - 1 do
      source[y] = {}
      for x = 0, b.width - 1 do
        local pixel = cel_pixel(cel, b.x + x, b.y + y)
        source[y][x] = pixel
        if app.pixelColor.rgbaA(pixel) ~= 0 then occupied = true end
      end
    end
    if not occupied then fail('EMPTY_REGION', 'The selected region contains no visible pixels.') end
    for y = dest_y, dest_y + out_height - 1 do
      for x = dest_x, dest_x + out_width - 1 do
        local inside_source = x >= b.x and y >= b.y and x < b.x + b.width and y < b.y + b.height
        if not inside_source and cel_pixel(cel, x, y) ~= 0 then
          fail('DESTINATION_OCCUPIED', 'The transform would overwrite pixels outside the selection.')
        end
      end
    end
    local left = math.min(cel.position.x, b.x, dest_x)
    local top = math.min(cel.position.y, b.y, dest_y)
    local right = math.max(cel.position.x + cel.image.width, b.x + b.width, dest_x + out_width)
    local bottom = math.max(cel.position.y + cel.image.height, b.y + b.height, dest_y + out_height)
    if right - left > 512 or bottom - top > 512 then
      fail('LIMIT_EXCEEDED', 'Preserving this cel would exceed the 512 by 512 image limit.')
    end
    local copy = Image(right - left, bottom - top, ColorMode.RGB)
    for y = 0, cel.image.height - 1 do
      for x = 0, cel.image.width - 1 do
        copy:drawPixel(x + cel.position.x - left, y + cel.position.y - top, cel.image:getPixel(x, y))
      end
    end
    for y = b.y, b.y + b.height - 1 do
      for x = b.x, b.x + b.width - 1 do copy:drawPixel(x - left, y - top, 0) end
    end
    for y = 0, b.height - 1 do
      for x = 0, b.width - 1 do
        local tx, ty
        if operation == 'flip_h' then tx, ty = b.width - 1 - x, y
        elseif operation == 'flip_v' then tx, ty = x, b.height - 1 - y
        elseif operation == 'rotate_cw' then tx, ty = b.height - 1 - y, x
        elseif operation == 'rotate_ccw' then tx, ty = y, b.width - 1 - x
        else tx, ty = x, y end
        copy:drawPixel(dest_x + tx - left, dest_y + ty - top, source[y][x])
      end
    end
    local preserved = Selection(); preserved:add(sprite.selection)
    app.transaction('Transform AI selection', function()
      cel.image = copy
      cel.position = Point(left, top)
      if selection_state(sprite).selectionKey ~= state.selectionKey then sprite.selection = preserved end
    end)
    app.refresh()
    return {
      documentId=params.documentId, layerId=params.layerId, frame=frame,
      operation=operation, source=b,
      destination={x=dest_x, y=dest_y, width=out_width, height=out_height},
      selectionPreserved=true,
    }
  end

  function M.capabilities()
    return {'get_palette', 'set_palette_colors', 'get_selection', 'set_selection', 'transform_selection'}
  end
  return M
end

return create
