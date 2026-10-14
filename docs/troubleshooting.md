# Troubleshooting

Start by separating three states: the client can list MCP tools, the extension is paired, and a specific editor operation works. Each needs its own check.

## No Aseprite tools in the client

Run `bun run install:harness` to preview the registered Codex and OpenCode entries. Verify the entry points at this checkout's `scripts/launch.ts`, then restart the client. A client that was open before an installer change can keep an old server process. If another MCP copy owns the local port, this server should still list its tools; a live call either shares a compatible owner or returns `LIVE_PORT_IN_USE`. Do not start extra copies to diagnose this.

If tool discovery fails, run the project's unit and integration checks from [development](development.md) and inspect client stderr. Keep the pairing token out of logs and issues.

## Tools listed, editor not paired

Open Aseprite and confirm the extension's **File > Connect Aseprite MCP...** command exists. If it is missing, inspect **Edit > Preferences > Extensions**, install the current package, and relaunch Aseprite if requested. `bun run pairing-token` prints the local port and secret token for the dialog. Use them privately; a token displayed unchanged after a restart is normal until setup changes it.

Press **Connect**, then call `get_editor_status` from the client. A browser or `curl` request returning `WebSocket required` only proves that something responds on the port; it is not a pairing test. `403` means the connection was rejected. Check the current extension package, port, and token in the dialog without posting the token publicly. The server listens on `127.0.0.1`; do not expose or forward it to another machine.

## Paired, but an edit or preview fails

Read the tool's error and call `get_editor_status` and `get_document_info`. Confirm the document and layer identifiers before retrying. After a timeout or disconnect during a mutation, inspect the artwork first; the edit might have succeeded even if the reply was lost. The server intentionally does not replay an uncertain edit. Use a scratch document for a compatibility check, not artwork that predates the check.

## Saved-file job fails

Run `batch_status` to see whether the CLI executable is configured, then run `bun run check:batch` against scratch files. Batch mode cannot read unsaved editor tabs. It is not an automatic fallback for a disconnected editor. Check output paths and any overwrite refusal before retrying.

## A web animation does not play

Verify that the exported image and timing manifest are both reachable from the web app's public asset path. Inspect the browser network requests for `404`, then check frame dimensions, order, durations, and loop boundary in the manifest. A successful sprite-sheet export or contact sheet is not a playback test. Run the [web playback recipe](../skills/verify-aseprite-mcp/features/README.md) and watch a complete loop.

If an issue remains, include exact steps, sanitized status/error output, editor and extension versions, and whether the failure occurs in Codex, OpenCode, or both. Do not include pairing tokens, private paths, or copyrighted artwork without permission.
