---
name: verify-aseprite-mcp
description: Verify Aseprite MCP's real editor, file, animation, art-control, and web-export workflows after implementation changes. Use before claiming a release or that a regression is fixed.
---

# Verify Aseprite MCP

Read [the feature map](features/README.md) first. Cover every affected feature; for a full release pass cover all five. A passing unit suite is necessary but does not prove desktop pairing, unsaved live edits, browser playback, or artistic quality. Do not silently substitute batch for a disconnected editor.

## Launch

From the repository root run `bun run typecheck`, `bun run test`, and `bun run check:docs` before a live pass. The user's desktop Aseprite must be open with this repository's packaged extension installed and connected to the local MCP owner on port 32123. The Codex/OpenCode MCP process launches through `bun scripts/launch.ts`; do not start a second owner or edit the user's pairing settings. A status report with `connected: true`, the actual editor/API/extension versions, and required capabilities marks live readiness. `bun run check:batch` starts its own short-lived Aseprite CLI process and does not require the desktop connection.

## Doctor

In the current MCP client, call read-only `get_editor_status` before any live drive and after an unexpected failure. Require `connected: true`, `compatibility.ready: true`, and the capabilities named by the affected feature file. If a newly installed extension advertises more operations than the MCP client lists, the port-owning client may still be running old server code; restart it before driving new tools. Stop live work and report missing prerequisites rather than guessing. Never output or request the pairing token. Repeat this check after Aseprite or Codex restarts.

## Drive

Use the named MCP tools in the current client for a fresh scratch sprite; never reuse the user's unsaved documents. Follow the exact user-facing recipes in the five feature files. `bun run check:editor` exercises a separate 8×8 live scratch sprite and leaves it open for inspection. `bun run check:batch` exercises saved-file creation/revision on new UUID-named files. For an artistic example, follow the `aseprite-pixel-art` skill and use direct MCP tool calls; a scripted geometric fixture is not an art-quality test. For web playback, use the example's actual browser player and inspect a complete cycle, not just atlas metadata.

## Evidence

Keep run-specific evidence under a new directory in `examples/<concept>/verification/` for art trials, or `assets/verification/<run-id>/` for technical trials. Record date, editor/API/extension/server versions, client and skill revision, exact calls or checker commands, response/error codes, before/after protected-pixel comparisons, artifact paths, screenshots or contact sheets, actual browser playback observation, and unresolved limits. Do not store credentials, pairing tokens, or unrelated open-document content. A screenshot alone does not prove frame timing or protected pixels; a green test alone does not prove visual quality. Preserve evidence when cleaning up.

## Cleanup

Close only temporary SDK processes started by checkers. Leave Aseprite and user documents alone. Scratch sprites deliberately remain open for inspection; ask before closing or deleting them. Generated UUID-named source/PNG/JSON proof files remain in place unless the user explicitly requests cleanup. If a checker fails, record what it created and whether the editor outcome is known before retrying; never replay an uncertain mutation automatically.

## Helpers

The repo's `bun run check:editor` and `bun run check:batch` are executable user-path probes; `bun run check:advanced-api` runs real Aseprite Lua animation/art-control tests without desktop pairing. `get_editor_status` is the live read-only preflight because a separate terminal process may be unable to open the local socket in restricted harnesses. Do not infer desktop success from mocked `tests/unit` fixtures.
