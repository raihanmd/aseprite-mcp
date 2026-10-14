# Development and verification

Use Bun for the server and TypeScript scripts. The live editor bridge is Lua inside the extension; saved-file jobs call Aseprite's CLI separately. [Architecture](architecture.md) identifies each entry point. The project does not include Aseprite itself.

## Work on a change

1. Read the relevant [verification feature recipe](../skills/verify-aseprite-mcp/features/README.md) before changing user-facing behavior. Preserve its contract, or update the recipe when intentionally changing it.
2. Make the smallest scoped change. Keep connection secrets and generated client entries under ignored local directories. Do not test against a pre-existing user document without explicit direction.
3. Run the checks mapped to the feature. For server code, use `bun run typecheck` and `bun test tests/unit`; for documentation, use `bun run check:docs`. Run `bun test tests/integration` when transport or tool behavior changes.
4. For editor behavior, test the current packaged extension in a running Aseprite instance on scratch artwork. `bun run check:editor` exercises the live path; `bun run check:batch` exercises the separate CLI path. Animation and art changes also need visual review. Mocks cannot stand in for these checks.
5. Report what passed, what failed, and what was not run. Do not claim support for a new Aseprite release from a feature probe alone.

`bun run package:extension` builds a versioned extension archive under `dist/` and refuses to overwrite one. `bun run install:harness` previews global client changes; `--apply` is explicit. `bun run update:skill` previews changes to the installed art skill; `--apply` updates only a recognized installation. Treat both global writes as user-environment operations, not ordinary build steps.

The [API source inventory](sources/README.md) is a dated local snapshot for research. Verify update-sensitive API behavior against [current Aseprite documentation](https://www.aseprite.org/api/) before changing an adapter. Keep its upstream license notice if updating the snapshot.

For a public contribution, see [CONTRIBUTING.md](../CONTRIBUTING.md). Do not commit `.local/`, `install/`, `assets/`, `examples/`, pairing tokens, test screenshots, or machine-specific paths.
