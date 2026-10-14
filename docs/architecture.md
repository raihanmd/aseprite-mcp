# Architecture

An AI client starts the Bun MCP process over stdio. The server exposes named tools with checked inputs. For live work, a paired Aseprite extension connects back to a localhost WebSocket listener and executes the corresponding Lua editor operation. Batch tools instead start a separate Aseprite CLI process against saved files.

```text
AI client
  | MCP over stdio
  v
scripts/launch.ts -> src/mcp/server.ts
                        | live calls                | explicit saved-file jobs
                        v                           v
                src/bridge/server.ts          src/batch/runner.ts
                        | paired localhost WS             | Aseprite CLI
                        v                                 v
                extension/main.lua             scripts/batch.lua
                        |
                extension/operations.lua
                extension/art_operations.lua
```

## Entry points

- `scripts/launch.ts` reads the private pairing configuration and starts `src/mcp/server.ts`. Clients should launch this stable entry point rather than calling low-level modules directly.
- `src/mcp/server.ts` registers MCP tools, validates arguments, renders PNG previews, and routes live or batch requests.
- `src/bridge/server.ts` binds `127.0.0.1`, authenticates the editor with the private token, serializes requests, and reports uncertain outcomes instead of replaying edits.
- `src/bridge/availability.ts` keeps tools discoverable when another MCP copy owns the port. A compatible process can forward authenticated local requests through that owner's queue; incompatible ownership produces `LIVE_PORT_IN_USE`.
- `extension/main.lua` supplies Aseprite's connection commands. `extension/operations.lua`, `art_operations.lua`, `compatibility.lua`, and `codec.lua` execute and adapt editor operations.
- `src/batch/runner.ts` and `scripts/batch.lua` implement file-only jobs. `src/security/files.ts` confines generated outputs to the configured asset root and prevents overwrites.

## Document and failure boundaries

Live tools work on a specific open document and can see unsaved state. The editor reports handles for documents and layers; clients must re-read state after a reconnect or manual edit. Pixel revisions can require observed old RGBA values so stale edits fail rather than silently replacing newer paint. Operations intended to be undoable are grouped in Aseprite transactions.

The pairing token authenticates both the editor connection and local sharing requests. The listener is bound to localhost, not a public interface. This is a local integration, not a remote service. Never put the token in source control or a transcript. A timeout or disconnect during an edit can leave its outcome unknown; inspect the affected document before another mutation. The server does not retry that edit automatically.

Saved-file jobs cannot access unsaved live changes. They require an explicit path, run the configured CLI executable separately, and write new output copies. The server never chooses batch mode as a fallback for a disconnected editor. See [usage](usage.md) for the user-visible distinction and [verification](../skills/verify-aseprite-mcp/features/README.md) for the checks that prove each route.

## Updating Aseprite

The extension checks required scripting features and reports editor, API, and extension versions. A successful feature report is a prerequisite for connection, not proof of every workflow. After an editor update, run the separate [compatibility procedure](compatibility.md) on scratch artwork before working on a user's document.
