# Animation control

A user can develop an animation by copying an existing pose, moving a cel independently, changing timing, and previewing a readable sequence.

## Sub-features

- `frame-copy`: `duplicate_frame` appends an independent copy with source duration and cel appearance.
- `cel-copy`: `copy_cel` fills only an empty destination; conflict never overwrites an existing cel.
- `cel-move`: `move_cel` changes only its target frame/layer, with explicit off-canvas intent.
- `animation-meta`: frame durations and tags survive preview/export.
- `animation-review`: contact sheet and actual playback make action and loop legible.

## How to get to it (user POV)

- Ask the AI to animate an existing Aseprite sprite, revise one pose, or change the timing of a beat.
- Inspect the frame timeline and play the result in Aseprite; for web delivery use the exported player as well.

## Driving it with Aseprite MCP and checkers

Preconditions:

- Doctor reports `duplicate_frame`, `copy_cel`, and `move_cel` capabilities.
- Use a fresh scratch sprite with a separate compact image layer for a movable subject; record source pixels, cel bounds, and duration.

- **Copy pose.** Call `duplicate_frame` from frame 1; require the new frame duration and cel bounds to match. Edit one target pixel, then verify frame 1 stayed byte-identical and the new cel is not linked.
- **Copy one layer.** Add an empty frame and call `copy_cel` for the subject layer; require `independent: true`. Attempt again to that occupied destination; require `CEL_EXISTS` and unchanged pixels.
- **Move.** Call `move_cel` on the copy with a small integer displacement; verify target coordinates and source frame unchanged. Try a move past the edge without `allowOffCanvas`; require `OUTSIDE_CANVAS` and no change.
- **Timing and loop.** Set two distinct frame durations, create a tag, and call `get_animation_preview`; compare frame order, timing, tag range, and native-size contact sheet. Play the loop in Aseprite and observe the last-to-first boundary.
- **Regression.** Run `bun run check:advanced-api` and `bun test tests/unit/contracts.test.ts tests/unit/lua.test.ts`. The CLI proves actual Lua API behavior, not the desktop connection.

## Gotchas

- A default full-canvas cel cannot move inside the canvas without crossing an edge; use a compact subject layer rather than casually enabling clipping.
- Independent copying is intentional. No linked-cel creation tool is promised by this feature.
- More frames do not prove good acting. Review a caption-free rough sequence and record what the agent can infer; independent viewer comprehension remains pending until the user or another human responds.
- Frame numbers are 1-based; duration input is milliseconds.
