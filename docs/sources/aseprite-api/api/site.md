# Site

This is an object that saves the active state of the editor in a specific moment. Which active sprite, layer, frame, cel, image, etc. were in a specific moment.

If you save the object:

    local site = app.site

The `site` object will not be updated if the active sprite is modified.

## Site.sprite

Gets the active sprite at the time the site object was created.

## Site.layer

Gets the active layer at the time the site object was created.
## Site.cel

Gets the active cel at the time the site object was created.

## Site.frame

Gets the active frame at the time the site object was created.

## Site.frameNumber

Gets the active frame number (an integer value, 1 is the first frame). Same as `app.site.frame.frameNumber` .

## Site.image

Gets the active image at the time the site object was created.

## Site.tilemapMode

Gets TilemapMode . On non-tilemap layers, this field returns 0.
## Site.tilesetMode

Gets TilesetMode . On non-tilemap layers, this field returns 0.
