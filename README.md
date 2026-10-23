# Aseprite MCP

Create and revise editable pixel art in a running Aseprite editor from an AI client. This project provides a local MCP server, an Aseprite Lua extension, and a pixel-art skill that guides the agent through briefs, visual checks, and revisions. Saved-file batch tools are available separately.

```text
Codex or OpenCode  <-- stdio -->  MCP server  <-- paired localhost WebSocket -->  Aseprite extension
```

The project is pre-release. Its [verification recipes](skills/verify-aseprite-mcp/features/README.md) distinguish unit tests, CLI checks, live editor behavior, and human review. A successful tool call alone does not prove that an animation looks good.

## Quickstart

You need [Bun](https://bun.sh/), a local Aseprite installation with scripting support, and Codex or OpenCode. The extension package step also needs `zip`. From this repository's root:

```bash
bun install
bun run setup
bun run package:extension
bun run install:harness
```

Review the install preview, then run `bun run install:harness --apply` to add only this MCP entry and the shared art skill to your global Codex and OpenCode setup. The installer refuses conflicting entries or customized skill copies; it does not replace unrelated client settings. See [installation and recovery](docs/install.md) before applying it on an existing setup.

In Aseprite, open **Edit > Preferences > Extensions > Add Extension** and select the newly built `dist/aseprite-mcp-*.aseprite-extension`. Start a fresh AI-client session, then choose **File > Connect Aseprite MCP...** in Aseprite. Run `bun run pairing-token` in your own terminal to obtain the local port and token for that dialog. Never paste the token into chat, an issue, or a screenshot. The command does not install or start another MCP server.

Ask the client to call `get_editor_status` before drawing. A first art request could be:

> Use the aseprite-pixel-art skill and Aseprite MCP to make a 32 × 32 blue potion icon on a transparent background. Show me the preview before saving anything.

The AI should show the result for review, then revise the same editable document when you request a change. The [usage guide](docs/usage.md) explains live editing, saved-file mode, and what to expect from the skill.

Screenshots and a short installation/demo video are TBA until a repeatable desktop run is recorded. There are no placeholder images presented as a finished result.

## What is included

- [Live tools](docs/usage.md#live-editor): create sprites, layers, and groups; import editable components from another open sprite; draw and revise pixels; inspect frames and motion; and save or export on request.
- [Saved-file tools](docs/usage.md#saved-file-batch): run separate Aseprite CLI jobs on named files. They cannot see unsaved editor changes and do not silently replace a live workflow.
- [Pixel-art skill](skills/aseprite-pixel-art/SKILL.md): the maintained, bundled art instructions installed for both supported clients. A [skill-only updater](docs/install.md#updating-the-art-skill) handles later revisions.
- [Verification skill](skills/verify-aseprite-mcp/SKILL.md): project-local tests for live editing, animation, art controls, export, and batch work.

The server connects only on localhost and requires a private pairing token. Local tools can change artwork; review the requested target document and output path before approving an agent action. The repository does not bundle or redistribute Aseprite. [Architecture](docs/architecture.md) and [troubleshooting](docs/troubleshooting.md) cover the connection in more detail.

## Project docs

- [Install in Codex and OpenCode](docs/install.md)
- [Use the MCP and art skill](docs/usage.md)
- [Architecture and code entry points](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Aseprite update checks](docs/compatibility.md)
- [Development and verification](docs/development.md)
- [Roadmap](ROADMAP.md) and [documentation index](docs/README.md)
- [Comparison with another Aseprite MCP](docs/research/diivi-comparison.md)

Contributions are described in [CONTRIBUTING.md](CONTRIBUTING.md). This repository's code is [MIT licensed](LICENSE); the offline Aseprite API documentation snapshot retains its [separate upstream notice](docs/sources/README.md).
