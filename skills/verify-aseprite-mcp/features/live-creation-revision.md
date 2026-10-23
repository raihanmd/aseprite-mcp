# Live creation and revision

A user can ask the AI to create an editable sprite in the open Aseprite instance, inspect it, revise only a requested part, and undo or redo that revision.

## Sub-features

- `live-connect`: paired extension reports editor version and named capabilities; a second client can share its connection.
- `live-create`: new sprite/layer/pixels appear in the editor and preview.
- `live-revise`: expected pixels, mask, and allowed colors protect unrelated artwork.
- `live-reject`: stale pixels, locks, invalid coordinates, linked cels, and missing documents refuse mutation.
- `live-history`: targeted revision is one undoable change; redo restores it.
- `live-assembly`: separate open RGB sources become independent, editable cels inside a new named group in a different scratch master; source pixels and metadata stay unchanged.

## How to get to it (user POV)

- In Codex or OpenCode, connect the Aseprite MCP and ask for a new sprite or revision of the open one.
- Open Aseprite and use its extension Connect action; the current session then calls `get_editor_status` and `list_documents`.
- Run `bun run check:editor` for a fresh 8×8 scratch asset; it never selects an existing user document for editing.

## Driving it with Aseprite MCP and checkers

Preconditions:

- MCP `get_editor_status` reports connected and compatible; record the extension and API versions. For assembly require `create_group` and `import_component` in `capabilities`.
- Record the existing document IDs and do not use them as mutation targets.

- **Create and inspect.** Run `bun run check:editor`; require the returned source and PNG paths plus `create`, `draw`, `protected-pixels`, `preview-pixels`, `undo`, and `redo` checks. Open the scratch tab and inspect the actual result.
- **Direct revision.** On a fresh sprite, call `create_sprite`, `create_layer`, `draw_pixels`, `get_preview`, and `read_pixels`; revise one colored patch using current `expected` RGBA and `allowedMask`. Re-read the whole bounded region and require equality outside the mask.
- **Stale rejection.** Repeat the original edit with outdated `expected` RGBA. Require `STALE_STATE` and an identical before/after pixel read.
- **Manual change.** Ask the user to change the scratch sprite in Aseprite, then call `get_document_info` and `read_pixels` again before revising. Never use cached expected bytes. If no human edit occurs, record this case as pending rather than simulating one.
- **Two clients.** In fresh Codex and OpenCode sessions connected to the same editor, inspect status from both, make one scratch-sprite edit from each in sequence, and verify the second sees the first's pixels. If concurrent use is required, issue overlapping scratch requests and require serialized results without duplicate edits or session loss. Record each client's observed tool list and results; one client alone does not prove sharing.
- **History.** Call `undo` then `redo` on the scratch document and compare exact pixels after each; never undo the user's unrelated tab.
- **Inactive-tab history.** With another scratch tab active, edit the first scratch document by its ID. Require that the original active tab remains active, one `undo` on the edited document removes the whole edit, and one `redo` restores it. This guards against transactions entering the wrong tab's undo stack.
- **Editable assembly.** Create two fresh scratch sprites: a source with a nested group and at least two image layers, and a target with a named host group. Capture source metadata and rendered pixels first. Call `import_component` with an explicit frame map and offset. Require a new group under the host, nested child `parentLayerId` values, independent unlinked cels, exact copied pixels and positions, unchanged source reads, and unchanged target timing/tags. Test a same-document import, sibling name collision, unsupported source layer, and off-canvas placement; each must fail without a new target layer or cel. Undo and redo only this target import and compare layer hierarchy and pixels. For a saved deliverable, reopen the `.aseprite` source copy to confirm groups survive.
- **Regression.** Run `bun test tests/unit/bridge.test.ts tests/unit/lua.test.ts tests/unit/shapes.test.ts tests/unit/availability.test.ts` and record any failures separately from live evidence.
- **Regression for assembly.** Run `bun run check:advanced-api` (real Aseprite CLI scratch process) and `bun test tests/unit/contracts.test.ts tests/unit/tool-results.test.ts tests/unit/mcp.test.ts`. This is not a paired desktop test.

## Gotchas

- This session's old MCP tool list can lag behind a freshly installed extension; restart the port-owning client before claiming discovery.
- The two existing unsaved sprites in a user's editor are not test fixtures. Always create a new scratch sprite.
- A timeout can mean the edit completed without a reply. Inspect the recovery document before retrying.
- A passing checker does not establish that a pixel-art illustration is good; inspect the native-size output and ask the user.
