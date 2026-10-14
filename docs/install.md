# Install Aseprite MCP

This guide covers the repository's Linux-tested setup for Codex and OpenCode. Aseprite runs on your computer; this repository packages an extension but does not include the editor itself. The installer changes only the named Aseprite MCP entries in the two clients and the shared `aseprite-pixel-art` skill. It does not change models, providers, other MCP servers, or Aseprite preferences.

## Prerequisites

- Aseprite with Lua scripting and extension installation available.
- Bun to run this MCP; `zip` to build the extension package.
- Codex or OpenCode to launch the MCP server. Install both if you want to verify both clients.
- Node.js only for the optional `check:editor` and `check:batch` scripts.

The project checks API features instead of promising support for every future Aseprite release. The currently recorded CLI test used Aseprite 1.3.18.6 and scripting API 41; see [compatibility](compatibility.md).

This pre-release checkout does not yet have a committed Bun lockfile. `bun install` therefore needs registry access and a clean-checkout dependency check remains a release task.

## Prepare and inspect

From the repository root:

```bash
bun install
bun run setup
bun run package:extension
bun run install:harness
```

`setup` creates `.local/connection.json` with a private token and generates example client entries under `install/`. It does not edit client settings. `package:extension` writes a versioned `.aseprite-extension` file under `dist/` and refuses to overwrite an existing package. `install:harness` without `--apply` is a read-only preview. Inspect the paths and requested changes before applying anything.

The preview should name the global Codex and OpenCode configuration files and the shared skill directory. If it reports a conflict, do not replace the existing entry or skill by hand. Inspect the differing target and use the [skill updater](#updating-the-art-skill) only when it recognizes a previous installation.

## Install and connect

1. Run `bun run install:harness --apply` after reviewing the preview. It merges only the Aseprite MCP entry into each client and installs the maintained art skill at the shared agent-skill location. It retains private backups and refuses conflicting or unsafe targets. The two client writes and skill installation are not one atomic transaction; inspect any reported partial failure before retrying.
2. In Aseprite, use **Edit > Preferences > Extensions > Add Extension** and select the package created in `dist/`. Relaunch Aseprite if its extension list requests it.
3. Restart Codex or OpenCode so that client launches this repository's current server. Use one client for the first connection test.
4. Run `bun run pairing-token` privately in your own terminal. Enter its port and token in Aseprite's **File > Connect Aseprite MCP...** dialog. The command prints a secret; do not capture or share its output.
5. In the AI client, check that Aseprite tools are listed, then call `get_editor_status`. Require a connected, compatible editor before asking the agent to draw. A listed tool is not proof that the editor is paired.

The extension commands are directly in Aseprite's File menu, after Scripts, not in the Scripts submenu. If pairing or tool discovery fails, use [troubleshooting](troubleshooting.md). Never solve a connection problem by creating a competing server, exposing the port to a network, or pasting the pairing token into a chat.

## Enable saved-file batch jobs

Batch jobs start a separate Aseprite command-line process. Configure the absolute path to the executable on your machine:

```bash
bun run setup --executable /absolute/path/to/aseprite
```

This writes `.local/executable.json`; it does not rotate the pairing token or change client settings. A batch tool works only on an explicitly named saved file and writes new copies. It cannot read unsaved changes in the open editor. `batch_status` reports configuration, not successful execution. Use `bun run check:batch` for a real CLI check after setup.

## Updating the art skill

The skill source lives in `skills/aseprite-pixel-art/`. When that source changes after installation:

```bash
bun run update:skill
bun run update:skill --apply
```

The first command previews only. The second updates a recognized, unchanged installation and retains the previous copy outside skill discovery. It refuses a customized copy, unknown receipt, duplicate same-name skill, symlinked or unsafe target, or stale plan. It does not change pairing or client configuration. Restart the client and verify it loaded the new revision. If application reports a partial failure, use the paths in its error report to inspect the retained copy before making another change.

The `verify-aseprite-mcp` skill is project-local in `skills/verify-aseprite-mcp/` and is routed by this repository's `AGENTS.md`; it is not installed globally by `install:harness`.

## Remove this integration

First disconnect this extension from the editor and stop the AI client that launches it. Back up the active client settings. Remove only `[mcp_servers.aseprite]` from Codex and only `mcp.aseprite` from OpenCode; preserve every other entry. Remove the shared art skill only after checking it still matches this project's installed copy and has no user additions. Uninstall this extension through Aseprite's extension preferences. Do not restore an old whole-config backup over newer user changes.
