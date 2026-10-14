# Rectangle

If a function receives a rectangle as an argument it could be several things:
  1. You can specify the parameters `x, y, width, height` directly as arguments of the function. E.g. `sprite:crop(0, 16, 64, 32)`
  2. You can specify an object with `x`, `y`, `width`, and `height` properties. E.g. `sprite:crop{ x=0, y=16, width=64, height=32 }`
  3. You can specify an array with 4 elements: E.g. `sprite:crop{ 0, 16, 64, 32 }`
  4. You can specify a `Rectangle` instance: E.g. `sprite:crop(Rectangle(0, 16, 64, 32))`
## Rectangle()

    Rectangle()
    Rectangle(otherRectangle)
    Rectangle(x, y, width, height)
    Rectangle{x=number, y=number, width=number, height=number}
    Rectangle{x=number, y=number, w=number, h=number}
    Rectangle{number, number, number, number}

## Rectangle.x

    local x = rectangle.x
    rectangle.x = newX

Gets or sets the x-coordinate of the rectangle. 0 means at the left side of the screen/sprite.
## Rectangle.y

    local y = rectangle.y
    rectangle.y = newY

Gets or sets the y-coordinate of the rectangle. 0 means at the top side of the screen/sprite.

## Rectangle.width

    local width = rectangle.width
    rectangle.width = newWidth

Gets or sets the width of the rectangle. If it's 0, the rectangle is empty (so the coordinate doesn't matter).
## Rectangle.height

    local height = rectangle.height
    rectangle.height = newHeight

Gets or sets the height of the rectangle. If it's 0, the rectangle is empty (so the coordinate doesn't matter).

## Rectangle.w

Same as Rectangle.width.

## Rectangle.h

Same as Rectangle.height.

## Rectangle.origin

    local point = rectangle.origin
    rectangle.origin = newPoint

Gets or sets the origin of the rectangle with a Point object, just like changing Rectangle.x and Rectangle.y at the same time.
## Rectangle.size

    local size = rectangle.size
    rectangle.size = newSize

Gets or sets the size of the rectangle with a Size object, just like changing Rectangle.width and Rectangle.height at the same time.

## Rectangle.isEmpty

    local booleanResult = rectangle.isEmpty

Returns true if the rectangle is empty i.e. width and/or height are 0.
## Rectangle:contains()

    local booleanResult = rectangle:contains(otherRectangle)

Returns true if `otherRectangle` is inside `rectangle`.

Example:

    local bounds = Rectangle{ x=0, y=0, width=32, height=32 }
    local rectInside = Rectangle{ x=4, y=4, width=8, height=8 }
    if bounds:contains(rectInside) then ... end

## Rectangle:intersects()

    local booleanResult = rectangle:intersects(otherRectangle)

Returns true if `rectangle` intersects in some way `otherRectangle`.
## Rectangle:intersect()

    local newRectangle = rectangle:intersect(otherRectangle)

Returns the new rectangle `newRectangle` which is the intersection of `rectangle` and `otherRectangle`. If both rectangles don't intersect each other, the result will be an empty rectangle

## Rectangle:union()

    local newRectangle = rectangle:union(otherRectangle)

Returns the new rectangle `newRectangle` which will be a rectangle big enough to contains both given rectangles `rectangle` and `otherRectangle`.
