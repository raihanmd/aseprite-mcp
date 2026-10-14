# Aseprite MCP agent guidance

Before changing user-facing MCP behavior, read [the project verification skill](skills/verify-aseprite-mcp/SKILL.md) and its [feature map](skills/verify-aseprite-mcp/features/README.md). Update the affected feature recipe when behavior intentionally changes; otherwise preserve its observable contract and run the mapped regression checks. For a release or substantial refactor, cover all five features. Do not claim live editor, web playback, or artistic quality from unit mocks alone.

For pixel-art creation, use [the art skill](skills/aseprite-pixel-art/SKILL.md). Never mutate a document that predates a verification run without explicit user direction.
