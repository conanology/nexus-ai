# Contributing

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 20.0.0 | [nodejs.org](https://nodejs.org/) |
| pnpm | 10.27.0 | `corepack enable && corepack prepare pnpm@10.27.0` |
| ffmpeg | any | OS package manager or [ffmpeg.org](https://ffmpeg.org/) |
| edge-tts | any (optional) | `pip install edge-tts` |

## Setup

```bash
git clone <repo-url>
cd nexus-ai
pnpm install
```

Create `.env.local` from the template:
```bash
cp .env.local.example .env.local
# Edit .env.local — add NEXUS_GEMINI_API_KEY at minimum
```

## Common Commands

| Command | What It Does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Build all packages (via Turbo) |
| `pnpm test` | Run all tests (Vitest workspace mode) |
| `pnpm run pipeline:local "topic"` | Run full local pipeline |
| `pnpm run pipeline:local -- --script path/to/script.txt` | Run pipeline with pre-written script |

### Per-Package Commands

```bash
# Type-check a single package (no root tsconfig)
cd packages/visual-gen && npx tsc --noEmit

# Run tests for one package
cd packages/visual-gen && npx vitest run

# Watch tests
cd packages/visual-gen && npx vitest
```

## Coding Conventions

### TypeScript

- **Strict mode** enabled: `noUnusedLocals`, `noUnusedParameters`
- **ESM only**: all packages use `"type": "module"`
- **Import extensions**: always use `.js` extensions in imports (TypeScript resolves `.ts` → `.js`)
- **Config inheritance**: all tsconfigs extend `../../packages/config/tsconfig.json`

### Package Structure

Every package follows this layout:

```
packages/<name>/
  src/
    index.ts          # Public exports
    __tests__/
      *.test.ts       # Test files
  package.json
  tsconfig.json
  vitest.config.ts    # (if package has tests)
```

### Package.json Template

```json
{
  "name": "@nexus-ai/<name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@nexus-ai/core": "workspace:*"
  },
  "devDependencies": {
    "@nexus-ai/config": "workspace:*"
  }
}
```

### tsconfig.json Template

```json
{
  "extends": "../../packages/config/tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## Testing

- **Framework**: Vitest (workspace mode via `vitest.workspace.ts`)
- **Globals**: `globals: true` — `describe`, `it`, `expect` available without import
- **Environment**: `node`
- **Test location**: `src/__tests__/*.test.ts`
- **Current baseline**: 3033 passing, 37 pre-existing failures (see CLAUDE.md for details)

Run tests:
```bash
pnpm test                    # All tests
pnpm test -- --reporter=verbose  # Verbose output
cd packages/core && npx vitest run  # Single package
```

## Adding a New Scene Type

Adding a scene type requires changes in 5 packages:

1. **`packages/director-agent`** — Add to `SceneType` union, update classification prompt, add default `visualData` fallback in `scene-classifier.ts`

2. **`packages/script-gen`** — Add to `SceneType` in `types.ts`

3. **`apps/video-studio`** — Add `VisualData` interface in `types/scenes.ts`, create scene component in `components/scenes/`, register in `SceneRouter.tsx`

4. **`packages/visual-gen`** — Update enrichers if the new type needs special handling (annotation exclusions, image exclusions, audio SFX mappings)

5. **`packages/asset-library`** — Add SFX mapping if the scene type has default sound effects

After changes:
```bash
# Rebuild director-agent (visual-gen imports from dist/)
cd packages/director-agent && npx tsc

# Verify types
cd apps/video-studio && npx tsc --noEmit
cd packages/visual-gen && npx tsc --noEmit

# Run tests
pnpm test
```

## Adding a New Package

1. Create directory: `packages/<name>/`
2. Add `package.json` and `tsconfig.json` from templates above
3. Add to `pnpm-workspace.yaml` (already covered by `packages/*` glob)
4. Run `pnpm install` to link
5. Import in other packages via `"@nexus-ai/<name>": "workspace:*"`

## Gotchas

These are common pitfalls documented from experience:

| Gotcha | Details |
|--------|---------|
| **Zod `.passthrough()`** | Scene schemas must use `.passthrough()` or enrichment fields (backgroundImage, sfx, overlays, etc.) get silently stripped by Zod's default behavior |
| **Director-agent rebuild** | After changing scene types or the Scene interface, rebuild: `cd packages/director-agent && npx tsc` — visual-gen imports from `dist/` |
| **`noUnusedLocals`** | TypeScript strict mode — clean up unused imports before type-checking |
| **pnpm strict resolution** | Root-level scripts can't import workspace package deps directly — use `createRequire()` |
| **Remotion `publicDir`** | Must explicitly set `publicDir` in `bundle()` when entry point isn't at project root |
| **Data URI images** | Don't pass base64 images in Remotion `inputProps` (~24MB JSON) — materialize to disk and serve via HTTP |
| **Frame math** | `Math.floor()` on small counts can produce 0 — always wrap with `Math.max(1, ...)` |
| **`.js` extensions** | All imports must end in `.js` even though source files are `.ts` — this is how TypeScript ESM works |

## Related Documentation

- [Architecture](ARCHITECTURE.md) — System overview and dependency graph
- [Pipeline](PIPELINE.md) — Pipeline step reference
- [Scene Types](SCENE-TYPES.md) — Scene type reference
- [Visual Layers](VISUAL-LAYERS.md) — Rendering stack
- [API Keys](API-KEYS.md) — External services
- [Local Mode](LOCAL_MODE.md) — Running without GCP
