# Use the MCP and pixel-art skill

The MCP supplies editor operations. The AI client decides what to draw, calls those operations, inspects the returned image and document state, and revises the result after your feedback. The server does not contain a trained pixel-art generator. The bundled [art skill](../skills/aseprite-pixel-art/SKILL.md) gives the agent a workflow for silhouettes, lighting, materials, animation, and review; it does not guarantee artistic quality.

## Live editor

Open Aseprite, connect the extension, and ask the client to call `get_editor_status`. Then give a brief that names the subject, intended size/use, view or mood, and any constraints. For example:

> Use the aseprite-pixel-art skill and Aseprite MCP to make a 32 × 32 potion icon. Use a transparent background, blue liquid, and one warm highlight. Show a native-size preview before saving.

The skill asks short questions when a creation brief leaves important visual choices open. After a draft, you can inspect or edit it in Aseprite and ask for a targeted revision:

> Keep the bottle silhouette and highlight. Change only the liquid to purple, then show the updated preview.

The agent should read the current document and relevant pixels before changing them. A fresh preview, the target document identity, and unchanged regions matter more than a success message from a drawing call. `undo` and `redo` remain available for reversible edits. Saving or exporting is a separate requested action, not an automatic side effect of a preview.

For a complex scene, the skill calls for a rough composition proof, editable component sources, readable key poses, then an assembled editable master. The current MCP does not expose every assembly operation, such as cross-document import or layer-group creation. The agent must explain such a gap before promising a fully editable composite; it should not silently flatten the artwork or substitute file mode for an unsaved live document.

## Saved-file batch

Use a `batch_*` tool only when the request explicitly targets a saved file or asks for a new saved artifact. Configure the local executable first with `bun run setup --executable /absolute/path/to/aseprite`. These tools run Aseprite separately from the open editor, inspect or revise named files, and write new output copies. They cannot see unsaved editor changes. A disconnected live editor never triggers an automatic batch fallback.

## Animation and web output

Plan the visible action before adding frames. Review representative still poses and a short caption-free sequence at delivery size, then inspect the actual playback speed and loop boundary. Sprite-sheet export produces image and timing data; a web player must load both and be checked through a complete cycle. A contact sheet or passing manifest test is not evidence that the animation plays or reads well to a human.

For repeatable user-path checks, follow the [verification map](../skills/verify-aseprite-mcp/features/README.md). It separates live editor, animation, art controls, export/playback, and batch behavior. The user's artistic review remains the acceptance test for visual quality.
