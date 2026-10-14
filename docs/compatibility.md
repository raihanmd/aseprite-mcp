# Check compatibility after an Aseprite update

The extension checks for required scripting features and a minimum API version of 25. It does not pin one exact editor release. A passing feature check makes a connection possible; it does not prove drawing, animation, export, or visual quality. See [Aseprite's API version](https://www.aseprite.org/api/app/#appapiversion) and [change notes](https://www.aseprite.org/api/Changes).

The [support record](../compatibility/support.json) distinguishes a reported installation from a workflow tested with an actual editor. The recorded batch check on Aseprite 1.3.18.6/API 41 is not a claim that all live tools or future releases work.

## Update procedure

1. In Aseprite, choose **File > Check Aseprite MCP Compatibility**. This read-only command reports missing editor features. If it fails, stop before editing user artwork.
2. Restart the AI client, reconnect the extension, and call `get_editor_status`. Check the reported editor, API, and extension versions. `compatibility.ready` is a feature report, not a completed workflow test.
3. Run `bun run check:editor` with the editor paired to the checker. It creates a separate 8 × 8 scratch document and output files in the configured asset folder. It checks pixels, protected edits, undo/redo, frame timing, layer properties, save, and PNG export. Do not use a pre-existing artwork tab as its target.
4. If saved-file work matters, configure the local executable and run `bun run check:batch`. This starts a separate Aseprite CLI process. Its result does not establish live-editor compatibility.
5. For a release or broad behavior change, follow all [verification recipes](../skills/verify-aseprite-mcp/features/README.md). Check tool and skill discovery in fresh Codex and OpenCode sessions, then review actual art and any web playback with a human.

Record the command, editor/API/extension versions, result, and limits before adding a workflow to the support record. Do not promote a mocked unit test or a read-only status check into verified editor support. If a check fails, inspect the new API behavior on scratch artwork and fix the extension before returning to a user's document.
