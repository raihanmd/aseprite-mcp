# Contributing

Issues and pull requests are welcome for reproducible bugs, documentation corrections, focused MCP tools, and pixel-art workflow improvements. This project is pre-release; check [ROADMAP.md](ROADMAP.md) before building a large feature.

For a bug, describe the expected and observed behavior, exact steps, editor/API/extension versions, client, and relevant sanitized error output. Say whether the tool was merely listed, the editor was paired, or the operation actually ran. Do not paste the pairing token, private configuration, personal paths, or artwork you cannot share.

For a code change, start with [development and verification](docs/development.md) and the affected [feature recipe](skills/verify-aseprite-mcp/features/README.md). Keep a pull request focused; explain a changed user-visible contract and update its recipe. Include the tests run and any editor, web, or human checks that could not be run. A unit test alone is not evidence of live editor behavior or art quality.

For a skill or documentation change, use specific examples and sources where a claim depends on Aseprite behavior or art guidance. Keep instructions usable without this project's old test folders. The bundled art skill belongs in `skills/aseprite-pixel-art/`; the globally installed copy is generated from it.

Do not commit generated packages, artwork, pairing data, machine-specific configuration, or local examples. The [MIT license](LICENSE) covers this repository's code and authored documentation; the [Aseprite API snapshot](docs/sources/README.md) retains its separate upstream notice.

Security and code-of-conduct contact policies are pending a private reporting channel. Until then, do not put secrets or exploit details into a public issue. This is an unresolved publication item, not an invitation to disclose them publicly.
