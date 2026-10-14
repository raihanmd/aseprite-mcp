# Targeted revisions in the live editor

Use the actual tools discovered in this session; a skill file does not prove that the editor is connected.

## Start from the artwork that exists now

Read the current document, layer/frame state, and preview. The user may have drawn between prompts. Reuse the actual current state, not an earlier preview or a saved copy.

Identify both the requested change and what must stay unchanged. For “make the liquid purple, keep the bottle,” determine which pixels are liquid. A separate liquid layer may help, but names alone do not identify content. A rectangular area may contain bottle pixels too. Prefer a precise pixel mask, meaning the set of pixels allowed to change, when preservation requires it.

Capture the relevant before-state. Compare protected pixels as actual color/alpha values, not only visual similarity. Preserving the overall outline is weaker than preserving every bottle pixel. If the available tools cannot establish a reliable boundary, ask for a selection or clarification rather than claiming exact preservation.

## Apply the smallest useful change

Retain the asset's light-to-dark structure, perspective, palette constraints, and unrelated layers/frames unless the user requests otherwise. Recoloring one material should not trigger an unasked-for redesign.

Prefer an undoable logical change. Recheck the target and freshness before applying it. A layer and frame can share image data with another frame; the current drawing tool rejects linked cels rather than changing another frame implicitly.

For `draw_pixels`, read the exact current RGBA of each pixel being changed and include it as `expected`. This is a precondition: the tool refuses the edit if those pixels have changed. For a precise material-only revision, supply `allowedMask`, the list of coordinates permitted to change. The tool enforces the submitted mask; it cannot prove that the AI identified the material correctly. When untouched pixels must be preserved exactly, read and compare them after the change as well.

When the editor supports selections, `get_selection` exposes a freshness key and, for a chosen layer/frame, a selected-pixel key. `set_selection` can establish a rectangular area; `transform_selection` uses both keys to reject stale source pixels and refuses overwriting painted pixels outside that area. This moves or reshapes the selected cel pixels only—not the composed scene or every layer. Verify the actual result and protected regions after the transform. Use `get_palette` before `set_palette_colors` and pass inspected old RGBA values; changing an indexed palette can recolor every pixel using those indices, so do not treat it as a local material edit.

If the document changed after the before-state was read, inspect again and revise the plan. If a request times out, its outcome may be unknown; inspect current state before retrying. Editor status identifies a `recoveryDocumentId` when known. Inspect that document; inspecting a different one or reconnecting does not clear the uncertainty. If it has closed, explain the situation instead of automatically repeating the edit. Do not automatically undo when subsequent user edits might also be undone.

## Verify and return control

Obtain an updated preview of the unsaved live result. Verify the agreed unchanged areas, dimensions, and color constraints when the tools support those checks. Describe which checks were performed and which were unavailable. A checked image can still look wrong; review material and shading separately.

Show the revision and briefly describe it. Let the user review, manually adjust, or request another change. Do not silently save over their source file, flatten layers, or export a final asset during a review-only request.

The API explains why edits need transactions and image copies: [Aseprite transactions](https://www.aseprite.org/api/app/#apptransaction) and [image editing](https://www.aseprite.org/api/image/#imagedrawpixel). Software tests do not replace checking the installed editor's actual undo behavior.
