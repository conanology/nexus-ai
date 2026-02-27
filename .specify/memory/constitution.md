<!--
  Sync Impact Report
  ==================
  Version change: 2.0.0 → 2.1.0
  Bump type: MINOR — New principle added (XII. Cognitive & MCP
    Integration). No existing principles modified or removed.

  Unchanged principles:
    I.    Package-First Architecture
    II.   Strict TypeScript & ESM
    III.  Test Discipline
    IV.   Pipeline Order Integrity
    V.    Dual-Mode Operation
    VI.   Schema Safety
    VII.  Simplicity & YAGNI
    VIII. Strict Visual Identity
    IX.   Backward Compatibility
    X.    Component Modularity
    XI.   No Hallucinations

  Added principles:
    XII.  Cognitive & MCP Integration — MCP-wrapped external
          interactions with graceful pipeline fallbacks

  Unchanged sections:
    - Technical Constraints (added MCP constraint line)
    - Development Workflow (added MCP integration guidance)

  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ compatible
    - .specify/templates/spec-template.md         ✅ compatible
    - .specify/templates/tasks-template.md        ✅ compatible
    - .specify/templates/checklist-template.md    ✅ compatible

  Files requiring manual follow-up:
    - apps/video-studio/src/theme.ts              ⚠ prior: migrate Neon Hacker palette
    - apps/video-studio/src/utils/colors.ts       ⚠ prior: migrate Neon Hacker palette
    - docs/VIDEO_SYSTEM_SPEC.md Section 4.2       ⚠ prior: color spec references old palette

  Deferred items: none
-->

# NEXUS-AI Constitution

## Core Principles

### I. Package-First Architecture

Every capability MUST live in a dedicated `@nexus-ai/*` workspace
package with a clear, single purpose. Packages MUST be independently
buildable and testable. Cross-package dependencies use the
`"workspace:*"` protocol. No package may import another package's
internals — only its public exports.

**Rationale**: The monorepo has 17 packages and 4 apps. Tight package
boundaries prevent coupling drift and enable parallel development.

### II. Strict TypeScript & ESM

All source code MUST be TypeScript in strict mode with
`noUnusedLocals` and `noUnusedParameters` enabled. All packages MUST
use ESM (`"type": "module"`) with `.js` extensions in import paths.
Per-package `tsconfig.json` MUST extend the shared config chain
(`packages/config/tsconfig.json` → `tsconfig.base.json`). There is
no root `tsconfig.json` — type-checking runs per-package.

**Rationale**: Strict mode catches errors at compile time. ESM is the
standard module system; consistent `.js` extensions prevent runtime
resolution failures.

### III. Test Discipline

All new functionality MUST include unit tests. Tests use Vitest in
workspace mode (`vitest.workspace.ts`). Test files live alongside
source in `src/__tests__/*.test.ts`. Before committing, affected
packages MUST pass type-checking (`npx tsc --noEmit`) and their test
suite. Pre-existing test failures (documented in CLAUDE.md) are
excluded from this gate.

**Rationale**: The project maintains 3000+ passing tests. Regressions
caught early prevent compounding failures in the 11-step pipeline.

### IV. Pipeline Order Integrity

The video enrichment pipeline MUST execute in this fixed order:
`logos → audio → geo → source screenshots → content screenshots →
company screenshots → stock → concept fallback → AI images →
overlays → annotations → memes`. Each enricher MUST NOT assume or
depend on fields set by enrichers later in the sequence. Adding a
new enricher requires explicit placement in the pipeline order and
updating `run-local.ts`.

**Rationale**: Enrichers write fields that downstream enrichers and
the renderer consume. Out-of-order execution causes missing visuals
or data races.

### V. Dual-Mode Operation

Every service MUST function in both cloud (GCP) and local mode.
`getStorageClient()` MUST return `LocalStorageClient` when
`STORAGE_MODE=local` or `NEXUS_BUCKET_NAME` is unset.
`FirestoreClient` MUST become a no-op in local mode. API key
resolution MUST check environment variables first, then GCP Secret
Manager. New services MUST NOT hard-depend on GCP credentials.

**Rationale**: Local mode enables development and testing without
GCP billing. The pipeline must produce identical output structure
regardless of storage backend.

### VI. Schema Safety

Zod schemas for scene data MUST use `.passthrough()` to preserve
enrichment fields not explicitly declared in the schema. Remotion
`inputProps` MUST NOT contain base64-encoded images (data URIs);
large assets MUST be materialized to disk and served via HTTP.
`bundle()` MUST set `publicDir` explicitly. Frame calculations
MUST use `Math.max(1, ...)` to prevent zero-frame scenes.

**Rationale**: Zod's default `z.object()` silently strips unknown
keys — this has caused production data loss. Data URI images bloat
JSON to 24MB+, crashing the renderer.

### VII. Simplicity & YAGNI

Changes MUST be the minimum needed for the current task. No
speculative abstractions, no feature flags for one-time operations,
no helpers for single-use logic. Three similar lines of code are
preferred over a premature abstraction. Error handling and validation
MUST only be added at system boundaries (user input, external APIs),
not for internal invariants guaranteed by the type system.

**Rationale**: Over-engineering has higher maintenance cost than
duplication. The pipeline is complex enough without unnecessary
indirection layers.

### VIII. Strict Visual Identity (V3 Overhaul)

The project is migrating to a **"Neon Hacker"** aesthetic. The
canonical palette is:

| Role             | Value                    |
|------------------|--------------------------|
| Primary accent   | Neon Green `#aaff00`     |
| Background range | Deep Black `#0a0a0a` to `#111111` |

All new and updated components MUST use this palette exclusively.
The previous Cyan (`#00d4ff`) and Violet (`#8b5cf6`) colors MUST
NOT be used in any new code. Existing references in `theme.ts` and
`colors.ts` MUST be migrated to the Neon Hacker palette as part
of V3 work. Glow effects, gradients, and accent colors MUST derive
from `#aaff00`. Background gradients MUST stay within the
`#0a0a0a`–`#111111` range.

**Rationale**: Visual consistency is the single largest quality
signal in the output video. Mixed palettes (cyan + green) produce
an incoherent brand identity. The Neon Hacker aesthetic targets a
Fireship-competitive 8.5+/10 quality score.

### IX. Backward Compatibility (V1 Coexistence)

The V1 `timeline` input mode in `TechExplainer.tsx` MUST NOT be
broken. The `TechExplainerSchema` Zod union MUST continue to
accept all three input variants in this priority order:

1. `ScenesSchema` (V2-Director scenes — checked first)
2. `DirectionDocumentSchema` (V2 intermediate)
3. `TimelineSchema` (V1 legacy — checked last)

Both V1 and V2 code paths MUST coexist until the `render-service`
is fully migrated to pass V2 scenes format. Removing or breaking
the V1 timeline path requires explicit sign-off and a verified
migration of `apps/render-service/src/render.ts`.

**Rationale**: The render-service currently only passes V1 timeline
format. Breaking V1 would halt all production renders. The union
order ensures V2 props match first without stripping V1 defaults.

### X. Component Modularity (2.5D Cinematic UI)

When upgrading Remotion scene components to the 2.5D Cinematic UI
style, each component MUST remain self-contained and reusable. A
component MUST render correctly given only its typed props — no
implicit global state or cross-component coupling.

Any new external service calls (e.g., updated Playwright for
screenshots, new API integrations) MUST have **silent fallbacks**
that degrade gracefully without throwing. Specifically:

- Screenshot enrichers MUST catch network/browser errors and skip
  the scene's screenshot rather than crash the pipeline.
- API enrichers MUST return a neutral default (empty array, null
  visual) on failure rather than propagating the error.
- No enricher failure may abort the entire render.

**Rationale**: A single Playwright timeout or API outage must not
block a 5-minute video render. Silent fallbacks preserve pipeline
throughput while still producing watchable output.

### XI. No Hallucinations (Structural Fidelity)

All implementation work MUST adhere strictly to the file structures
defined in `docs/ARCHITECTURE.md` and `docs/VIDEO_SYSTEM_SPEC.md`.
New packages MUST NOT be created unless the user explicitly requests
them. New files MUST be placed in existing directories following
established naming conventions (e.g., enrichers in
`packages/visual-gen/src/*-enricher.ts`, scene components in
`apps/video-studio/src/components/scenes/*.tsx`).

When in doubt about where code belongs, consult these documents
before proposing a location. Inventing new organizational structures
(new directories, new packages, new config files) without explicit
approval is prohibited.

**Rationale**: The monorepo has well-defined boundaries documented
across ARCHITECTURE.md, VIDEO_SYSTEM_SPEC.md, and CLAUDE.md.
Undocumented structural changes create hidden complexity that
diverges from the team's mental model of the codebase.

### XII. Cognitive & MCP Integration

All external interactions — including memory persistence, web
fetching, browser automation, documentation retrieval, and any
future cognitive services — MUST be wrapped as standard Model
Context Protocol (MCP) clients or tools. MCP integrations MUST
be housed in `packages/core` (for shared infrastructure) or in
their respective agent packages (for domain-specific tools).

The main pipeline MUST NEVER block on an MCP server being
unavailable. Every MCP-dependent call MUST implement a graceful
fallback:

- Memory/context MCP tools MUST fall back to stateless generation
  (no cached context) when the MCP server is unreachable.
- Web interaction MCP tools MUST fall back to standard HTTP
  clients or skip the enrichment step entirely.
- Documentation retrieval MCP tools MUST fall back to bundled
  or cached documentation when the live server is down.
- Fallback activation MUST be logged at `warn` level so
  degraded operation is visible in pipeline output.

MCP client wrappers MUST use a consistent pattern: attempt the
MCP call with a timeout (max 10 seconds for non-critical calls,
max 30 seconds for critical enrichment calls), catch connection
and timeout errors, invoke the fallback, and continue the
pipeline. No MCP failure may propagate as an unhandled exception.

**Rationale**: MCP provides a standardized protocol for external
tool integration, but external servers are inherently unreliable.
The video pipeline produces output on a schedule; a downed MCP
server must degrade quality gracefully rather than halt
production. Wrapping all external interactions behind MCP
ensures consistent error handling, timeout management, and
fallback behavior across the entire system.

## Technical Constraints

- **Runtime**: Node >= 20, pnpm 10.x, Turbo 2.x
- **AI models**: Gemini family (`gemini-3.1-pro-preview` primary,
  `gemini-2.5-flash` director, `gemini-2.0-flash` health)
- **Video**: Remotion, 1920x1080, 30fps, h264+aac output
- **TTS cascade**: AI Studio TTS → edge-tts → silent fallback
- **Scene types**: 16 defined types; adding a new type requires
  updating `scenes.ts`, `SceneRouter.tsx`, `scene-classifier.ts`,
  and rebuilding `director-agent` (`npx tsc`)
- **API key**: `getSecret('nexus-gemini-api-key')` from
  `@nexus-ai/core` — checks `NEXUS_GEMINI_API_KEY` env first
- **Package versions**: `@google/generative-ai` ^0.16.0, Zod ^3.23.8
- **V3 palette**: Primary `#aaff00`, BG `#0a0a0a`–`#111111`
  (supersedes prior Cyan/Violet references in theme files)
- **MCP integration**: All external tool interactions via MCP
  protocol; max 10s timeout (non-critical), 30s (critical);
  graceful fallback required (Principle XII)

## Development Workflow

### Pre-Commit Checklist

1. `git diff` to review all changes
2. Type-check affected packages: `npx tsc --noEmit` (per-package)
3. Run tests for affected packages: `pnpm test --filter @nexus-ai/<pkg>`
4. If scene types changed: rebuild director-agent
   (`cd packages/director-agent && npx tsc`)
5. Conventional commit message (e.g., `feat(visual-gen): ...`)

### Adding New Enrichers

1. Create `packages/visual-gen/src/<name>-enricher.ts`
2. Place in pipeline order in `scripts/run-local.ts`
3. Add tests in `packages/visual-gen/src/__tests__/`
4. Update `SceneRouter.tsx` if enricher adds visual data
5. Update this constitution's Pipeline Order (Principle IV)
6. Ensure silent fallback on failure (Principle X)
7. If enricher uses external services, wrap via MCP (Principle XII)

### Adding New Scene Types

1. Add type to `apps/video-studio/src/types/scenes.ts`
2. Create component in `apps/video-studio/src/components/scenes/`
3. Register in `apps/video-studio/src/SceneRouter.tsx`
4. Add classification in
   `packages/director-agent/src/scene-classifier.ts`
5. Rebuild director-agent: `cd packages/director-agent && npx tsc`
6. Add SFX mapping in `packages/asset-library/src/audio-assets.ts`
7. Add tests for component and classification
8. Use Neon Hacker palette only (Principle VIII)

### Adding MCP Integrations

1. Define the MCP client wrapper in `packages/core` (shared) or
   the relevant agent package (domain-specific)
2. Implement the fallback path (stateless generation, cached data,
   or skip) alongside the MCP call
3. Set appropriate timeout: 10s for non-critical, 30s for critical
4. Log fallback activation at `warn` level
5. Add tests covering both MCP-available and MCP-unavailable paths
6. Verify the pipeline completes successfully with the MCP server
   intentionally stopped

### V3 Migration Guidance

When touching any existing component:
1. Replace Cyan (`#00d4ff`) → Neon Green (`#aaff00`)
2. Replace Violet (`#8b5cf6`) → Neon Green variants or remove
3. Replace background `#0a0e1a` → `#0a0a0a`
4. Verify V1 timeline path still renders (Principle IX)
5. Confirm file placement matches ARCHITECTURE.md (Principle XI)

## Governance

This constitution is the authoritative source of project standards.
All code changes and reviews MUST verify compliance with these
principles. Amendments require:

1. A clear description of what changes and why.
2. Version bump following semver (MAJOR: principle removal/redefinition,
   MINOR: new principle or material expansion, PATCH: clarifications).
3. Update of `LAST_AMENDED_DATE` to the amendment date.
4. Propagation check: verify `.specify/templates/` and `CLAUDE.md`
   remain consistent with amended principles.

Complexity that violates Principle VII MUST be justified in the
plan's Complexity Tracking table before implementation.

Runtime development guidance lives in `CLAUDE.md` and
`docs/CLAUDE-OPS.md`. This constitution governs principles; those
files govern day-to-day operations.

**Version**: 2.1.0 | **Ratified**: 2026-02-21 | **Last Amended**: 2026-02-22
