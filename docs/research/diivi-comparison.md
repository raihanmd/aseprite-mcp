# What we borrowed from diivi/aseprite-mcp

Reviewed 2026-10-14 against upstream commit [`90d1696`](https://github.com/diivi/aseprite-mcp/tree/90d1696a7e41edff89bbd0823ae6a5f86c114bcc). This is a design comparison, not a copied implementation or a claim that upstream's tools were executed locally.

| Need | Upstream approach | This project |
| --- | --- | --- |
| Assemble a scene | [`copy_layers_between_sprites`](https://github.com/diivi/aseprite-mcp/blob/90d1696a7e41edff89bbd0823ae6a5f86c114bcc/aseprite_mcp/tools/scene.py) works between saved sprites in a fresh batch process. | `import_component` copies between two open documents into a new editable group. It preserves nested ordinary image layers and independent cels; it does not write or overwrite files. |
| Inspect motion | [`render_onion_skin` and `compare_frames`](https://github.com/diivi/aseprite-mcp/blob/90d1696a7e41edff89bbd0823ae6a5f86c114bcc/aseprite_mcp/tools/analysis.py) render batch diagnostics. | The same diagnostic ideas read two frames from the paired live editor and return PNG images without changing artwork or editor onion-skin settings. |
| Guide an agent | [`animation_workflow_guide`](https://github.com/diivi/aseprite-mcp/blob/90d1696a7e41edff89bbd0823ae6a5f86c114bcc/aseprite_mcp/tools/guide.py) returns guidance as a tool result. | The bundled art skill carries guidance; MCP calls perform observable editor operations. |
| Execution boundary | [`AsepriteCommand`](https://github.com/diivi/aseprite-mcp/blob/90d1696a7e41edff89bbd0823ae6a5f86c114bcc/aseprite_mcp/core/commands.py) starts Aseprite with generated Lua scripts for file jobs. | Live tools use an authenticated localhost bridge to the already-open editor. Saved-file jobs stay separate and explicit. |

We did not adopt a raw Lua execution tool or treat a larger tool count as a quality metric. Import deliberately rejects reference, tilemap, and background source layers instead of flattening them. It does not copy tags or change the target timeline, because those are global scene decisions rather than component-local properties. Newer Aseprite releases still need scratch-editor verification.
