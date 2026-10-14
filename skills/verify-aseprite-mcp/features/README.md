# Aseprite MCP verification map

This map is the maintained source for repeatable, user-visible checks. Read it before a release test and update the affected feature file when tool behavior changes. A feature is verified only when its own entry path and observable result are exercised; a different route does not count as a substitute.

## Baseline preconditions

- Run from the cloned repository root, or resolve it from the skill directory.
- For live work, Aseprite is open, the current packaged extension is paired, and read-only MCP `get_editor_status` reports connected with required capabilities.
- Start from a new scratch sprite. Never mutate any document that existed before the run.
- For file jobs, configure the absolute Aseprite executable path; `batch_status` reports configuration, not proof of operation.
- Keep each run's evidence in its own directory and retain it after the client/CLI process exits.

## Driving conventions

- Record document and layer handles returned by the current session; do not reuse handles after reconnect.
- Inspect current state before a targeted edit. For existing pixels pass the observed RGBA as `expected`; for palette edits pass observed entry colors; for selection transforms pass the observed keys.
- Check a returned image and an independent state read after a mutation. A successful call alone is not the final proof.
- Use a new export filename; the exporter must not overwrite an existing target.
- After an unknown outcome, inspect the reported recovery document before any retry.

## Proof and skip reporting

- Record exact command/tool, inputs relevant to the assertion, result/error, and the observed editor or file state.
- A copied frame must be independent unless linking was explicitly requested; a moved cel must not move its source frame.
- A protected region requires exact pixel comparison, not a visual guess.
- A sprite sheet requires both PNG and JSON plus actual playback where web delivery is in scope.
- Report an unreachable path with the attempted route and missing prerequisite; never mark it as passed through a mock.

## Features

- [Live creation and revision](./live-creation-revision.md): pairing, drawing, stale protection, manual edits, undo/redo.
- [Animation control](./animation.md): independent pose copying, cel movement, duration, tags, preview.
- [Palette, selection, transforms](./art-controls.md): constrained colors, exact selection and pixel preservation, lossless geometry.
- [Export and web playback](./export-web.md): editable source, PNG, atlas+JSON, actual browser playback.
- [Saved-file batch](./saved-file-batch.md): explicit file-only create, inspect, revise, no overwrite or live fallback.
