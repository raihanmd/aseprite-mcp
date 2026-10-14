# Palette, selection, and transforms

A user can inspect colors, select an exact region, and perform pixel-preserving changes to one cel without touching protected artwork.

## Sub-features

- `palette-read`: palette indices and RGBA colors are inspectable.
- `palette-edit`: expected palette size and old entry colors reject stale changes; indexed-mode effects are reviewed explicitly.
- `selection`: rectangular selection can be replaced or cleared only from an inspected state.
- `transform`: flip, quarter-turn, or translation moves exact selected pixels without smoothing.
- `preserve`: linked cels, occupied destinations, locks, empty/irregular selections, and stale keys reject unsafe edits.

## How to get to it (user POV)

- Ask the AI to select an object, flip it, rotate it 90°, move it by whole pixels, or edit sprite palette entries. For recoloring one material in an RGB sprite, use inspected `draw_pixels` with an exact mask or a dedicated material layer; palette-entry edits are not a local recolor.
- Inspect the selection marquee and resulting cel in the editor; use `get_preview` plus `read_pixels` for exact checks.

## Driving it with Aseprite MCP and checkers

Preconditions:

- Doctor reports `get_palette`, `set_palette_colors`, `get_selection`, `set_selection`, and `transform_selection`.
- Use a fresh scratch sprite with separate subject and background layers. Capture before-pixels for both.

- **Palette.** Call `get_palette`, then `set_palette_colors` on one entry with `expectedSize` and that entry's current RGBA. Re-read and verify exactly the requested entry changed. Repeat with an old `expected` color; require `STALE_STATE`. Inspect rendered colors separately from palette bytes.
- **Select.** Call `get_selection`; use its key in `set_selection` to select a rectangle. Require returned bounds and selected-pixel count. Attempt an old key; require `STALE_STATE` and unchanged selection.
- **Transform.** Call `get_selection` with layer/frame to obtain `selectionKey` and `pixelKey`. Pass both to `transform_selection` for flip, rotate, or translate. Compare affected pixels and every protected pixel; verify editor selection remains as expected. Undo/redo and compare exact pixels again.
- **Unsafe cases.** On scratch data, try an occupied destination, empty selection, linked cel, locked layer, and stale pixel key; each must fail without an image change. Treat indexed sprites separately: an RGB-only editor operation must reject unsupported modes honestly.
- **Regression.** Run `bun test tests/unit/art-operations.test.ts` and `bun run check:advanced-api`; the latter runs a real Aseprite CLI smoke test with a temporary private settings folder.

## Gotchas

- A rectangular selection can include unrelated painted pixels. The AI still must identify the right material; tool validation cannot make that semantic decision.
- Palette edits on indexed sprites can recolor every pixel with that index, not just the selected region.
- `transform_selection` targets one layer and frame; it does not transform the composed scene.
- A key detects ordinary stale state, not a cryptographic or cross-session lock. Re-inspect after human edits or reconnect.
