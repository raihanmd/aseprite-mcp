# Roadmap

This is a direction, not a compatibility promise. The [verification map](skills/verify-aseprite-mcp/features/README.md) defines what must be demonstrated before a feature is called working.

## Current focus

- Make live Aseprite editing reliable across client restarts, concurrent clients, and editor updates.
- Improve the asset-first animation workflow: editable component sprites, readable poses, then scene assembly and playback review.
- Keep the art skill and MCP tools aligned with human revisions in the same Aseprite document.

## Next

- Extend animation, palette, selection, transform, and sprite-sheet tools beyond their current operations.
- Expand saved-file batch processing while keeping the live-versus-file boundary explicit.
- Better cross-document assembly and layer organization for complex scenes, without silently flattening sources.
- Repeatable art and playback benchmarks, including both Codex and OpenCode runs.

## Before a public release

- Publish a reproducible dependency lockfile and complete clean-checkout installation.
- Capture a real installation/demo recording and screenshots. Media remains TBA until it has been reviewed.
- Complete live-editor, batch, both-client, and human visual acceptance on supported Aseprite versions.
- Decide a private reporting route before adding security and code-of-conduct contact policies.
