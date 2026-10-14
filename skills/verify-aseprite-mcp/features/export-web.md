# Export and web playback

A user can keep an editable `.aseprite` source, export a transparent PNG or animation atlas with timing metadata, and play the same frames on a web canvas.

## Sub-features

- `source-copy`: save a new editable source without changing the open sprite's saved state.
- `frame-png`: export a selected unsaved live frame to a new PNG.
- `sprite-sheet`: export every live frame as PNG atlas and JSON with 1-based frame numbers, 0-based pixel rectangles, durations, and tags.
- `no-overwrite`: existing or unsafe destinations reject output; partial two-file publication is reported honestly.
- `web-playback`: browser loads those exact files and honors per-frame timing and loop behavior.

## How to get to it (user POV)

- Ask the AI to save source, export a PNG, or deliver the animation as a sprite sheet for the web.
- Open the example's web player and use its play/pause and scrub controls.

## Driving it with Aseprite MCP and checkers

Preconditions:

- Doctor reports the editor connected. Use a fresh scratch or approved example sprite with at least two differently timed frames.
- Choose new filenames inside the configured asset root; never target an existing file.

- **Source and still.** Call `save_sprite`, then inspect the `.aseprite` header and reopen a copy. Call `export_sprite` on a chosen frame and compare PNG dimensions and pixels to `get_preview`. Require the live filename and modified state unchanged.
- **Atlas.** Call `export_sprite_sheet` with new `.png` and `.json` names in the same directory. Parse JSON: each 1-based frame maps to the correct 0-based `x,y` atlas rectangle; durations, tags, size, and transparency match live reads. Require both paths to exist and decode the PNG.
- **Safety.** Retry an existing filename and path escape; require an error and unchanged existing bytes. Force or simulate a late second-file collision in unit tests; require `PARTIAL_EXPORT` and an explicit retained PNG path.
- **Playback.** Copy the already verified atlas and JSON from the configured MCP `assets` root into the example's web `public/assets`; record both source and copied paths, then start its documented dev command and verify a complete cycle in a browser. Capture loaded scene, playhead/frame changes, paused pose, last-to-first loop, and absence of 404s. A contact sheet is not playback proof.
- **Regression.** Run `bun test tests/unit/sprite-sheet.test.ts tests/unit/files.test.ts tests/unit/tool-results.test.ts`.

## Gotchas

- The atlas JSON is the MCP's own `aseprite-mcp/sprite-sheet-v1` format, not Aseprite's built-in JSON schema.
- A manual edit during sequential frame reads might create a mixed snapshot without changing frame metadata; pause editing during export and visually compare afterward.
- PNG and JSON are separate filesystem publications; a late failure can leave the PNG. Do not call that an atomic pair.
- Browser timing can diverge from editor timing if the player ignores `durationMs` or tag direction; compare actual playback.
