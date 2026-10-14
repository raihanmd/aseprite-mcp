# Saved-file batch

A user can create, inspect, and revise editable Aseprite files through a separate CLI process without touching unsaved desktop artwork.

## Sub-features

- `file-create`: new `.aseprite` source and optional PNG preview are verified after reopening.
- `file-inspect`: SHA256, layer indices, frame timing, preview, and requested pixels describe the saved file.
- `file-revise`: a new filename and inspected hash protect the original source.
- `file-safety`: stale hash, collision, path escape, invalid result, timeout, and absent executable fail clearly.
- `file-isolation`: file jobs do not see unsaved live changes and never become a silent fallback.

## How to get to it (user POV)

- Ask the AI to create or revise a named saved `.aseprite` file rather than the open editor document.
- Use `batch_status`, `batch_create_sprite`, `batch_inspect_sprite`, and `batch_edit_sprite` in an MCP client.

## Driving it with Aseprite MCP and checkers

Preconditions:

- The installed Aseprite CLI path is configured absolutely. File mode is explicit; a connected desktop editor is not required.
- Choose new UUID-named source and preview filenames in the configured asset root.

- **End-to-end.** Run `bun run check:batch`; require creation, reopened inspection, targeted revision, protected-pixel comparison, unchanged original, stale-file rejection, and exclusive output in its result.
- **Original preservation.** Inspect the source before and after `batch_edit_sprite`; require the same SHA256 and exact protected pixels. Inspect the new copy independently.
- **Failure cases.** Use unit fixtures for invalid path, symlink escape, output collision, timeout, malformed subprocess result, and partial PNG publication; require no silent switch to live mode.
- **Regression.** Run `bun test tests/unit/batch.test.ts tests/unit/batch-lua.test.ts` plus `bun run typecheck`.

## Gotchas

- `batch_status.configured` does not prove that the executable can run. Only an actual file job does.
- A batch layer index is from the inspected saved file, not a live `layerId`.
- Source copies and previews are separate outputs; a partial export must name any retained source.
- This feature does not yet promise parity for every newer live-only art operation; report gaps instead of inventing file results.
