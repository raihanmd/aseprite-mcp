# Pixel art through saved files

Use this route only when the user asks to work from disk or agrees to it. Prefer live control for the open artwork and its unsaved edits. A disconnected editor is not permission to switch workflows.

Discover the available `batch_*` tools and their schemas. `batch_status` reports configuration, not a tested editor. Explain a missing executable or failed file job; never invent a successful edit.

For a new saved asset, use `batch_create_sprite` with the agreed new `.aseprite` filename, canvas dimensions and bounded pixels. Its `Art` layer remains editable. PNG image content is a preview; an optional `pngFilename` also writes that image when export is requested.

Before revising a file, use `batch_inspect_sprite` to obtain its current SHA256, rendered preview, flattened layer indices and exact pixels in the intended region. These 1-based indices belong to that inspected file; they are not live-editor handles. Names can repeat. After a user saves changes, inspect again.

Pass the inspected SHA256 as `expectedFileSha256` to `batch_edit_sprite`, with a different output filename. Named operations use the same expected-RGBA, edit-mask and allowed-color rules as live patches. Compare every protected pixel through an inspection of the new copy; a file hash prevents stale input but does not prove the AI identified the right material.

Inspect the new source, view its preview at native size and integer enlargement, then return the new filename and meaningful changes. The selected preview/layer/frame round-trip checks do not prove every aspect of file fidelity or artistic quality. Undo/redo within a file job affects that job's edit sequence, not previous saved files or the desktop editor's undo history. To reverse an older saved revision, use the retained earlier copy and explain which file you selected.

If a file job fails, the original input is not edited and successful output is not assumed. A partial-export error can mean the new source exists but its PNG could not be published; inspect the reported source before retrying. Do not overwrite an existing source or replay the whole job blindly.
