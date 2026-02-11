# NEXUS-AI Dead Code & File Audit Report

**Date**: 2026-02-11
**Scope**: Full monorepo — 4 apps, 17 packages, scripts, root files
**Mode**: READ ONLY (no files modified)

---

## Definitely Safe to Delete

These files/folders have ZERO references, ZERO imports, and are confirmed orphaned.

### Root-level debris

| # | Path | Size | Reason |
|---|------|------|--------|
| 1 | `nul` | 0 bytes | Windows NUL device artifact. Tracked in git. Empty file. |
| 2 | `repro_bug.ts` | small | Manual debug script for SSML tag handling. Not imported anywhere, not in package.json. |
| 3 | `check-pipeline.mjs` | small | Manual debug script querying Firestore with hardcoded 2026-01-29 pipeline ID. Not in package.json. |

### Stale backup files (tracked in git)

| # | Path | Reason |
|---|------|--------|
| 4 | `apps/orchestrator/src/__tests__/pipeline.test.ts.backup` | Manual backup. Originals exist. Use git history instead. |
| 5 | `apps/orchestrator/src/__tests__/pipeline.integration.test.ts.backup` | Same — stale manual backup. |

### BMAD framework directories (tracked in git)

These are BMAD (Build Model Architecture Design) workflow/agent definitions — project methodology automation, NOT application code. They are not imported or used by any source code in apps/ or packages/.

| # | Path | Tracked Files | Size | Reason |
|---|------|---------------|------|--------|
| 6 | `.agent/` | 44 files | 124K | BMAD agent workflow definitions. Not used by app code. |
| 7 | `_bmad/` | 291 files | 6.2M | BMAD templates, knowledge base, .bak files. Not used by app code. |
| 8 | `_bmad-output/` | 95 files | 2.0M | Generated planning/design docs from BMAD workflows. Not used by app code. |

**Total BMAD: 430 files, 8.3 MB tracked in git.**

> **Note**: `.cursor/`, `.gemini/`, `.opencode/`, `.ralph/`, `nexus-epic5/` already show as deleted in git status. They need to be committed as deletions.

---

## Probably Safe to Delete (Need Confirmation)

### broll-engine package

| # | Path | Reason | Verify |
|---|------|--------|--------|
| 9 | `packages/broll-engine/` | Functions (`generateCodeSnippetProps`, `generateBrowserDemoProps`) have tests but are NOT integrated into the visual pipeline. No external consumers. | Is this package planned for future use? If so, keep. If abandoned, remove. |

---

## Unused Dependencies

| # | Package | Dependency | Type | Evidence |
|---|---------|-----------|------|----------|
| 1 | `packages/tts` | `wav` (^1.0.2) | dependencies | 0 imports in src/. Audio handled via Buffer. Keep `@types/wav` if needed for types. |
| 2 | `packages/news-sourcing` | `zod` (^3.22.4) | dependencies | 0 imports in src/. Uses plain TS interfaces, not Zod schemas. |
| 3 | `apps/render-service` | `@remotion/cli` (^4.0.0) | dependencies | 0 imports in src/. Only video-studio uses it (in remotion.config.ts). |

---

## Dead Exports

**No significant dead exports found.** All public API exports from index.ts files across all 17 packages are consumed by:
- The pipeline (scripts/run-local.ts, orchestrator, operator-cli)
- Downstream packages (visual-gen → asset-library, etc.)
- Test suites
- React components (video-studio)

The `broll-engine` exports are fully tested but not yet wired into the pipeline (see "Probably Safe to Delete" above).

---

## Build Artifacts to Gitignore

### Must fix

| # | Item | Action |
|---|------|--------|
| 1 | `nul` file tracked in git | Add `nul` to `.gitignore`, then `git rm --cached nul` |
| 2 | `.gitignore:14` — broken absolute path | Change `/mnt/d/05_Work/NEXUS-AI-PROJECT/SETUP-PROGRESS.md` → `SETUP-PROGRESS.md` |

### Cleanup (cosmetic)

| # | Item | Action |
|---|------|--------|
| 3 | `.gitignore:25-27` — duplicate entries | Remove duplicate `test-results/`, `playwright-report/`, `playwright/.auth/` |
| 4 | `.gitignore:44-45` — orphaned entries | `.ralph/` and `.ralph.backup.epic5/` dirs are gone; entries can be removed |

### Already correct (no action)

- `dist/` — properly gitignored, not tracked
- `node_modules/` — properly gitignored, not tracked
- `.env`, `.env.local` — properly gitignored
- `local-storage/`, `output/` — properly gitignored
- `client_secret_*.json` — gitignored on lines 16-17, NOT tracked
- No `.js`/`.js.map` files in any `src/` directory

---

## Structural Issues

### TypeScript Config Inconsistency

Two patterns used for `tsconfig.json` extends:

| Pattern | Used By |
|---------|---------|
| `../../packages/config/tsconfig.json` | 14 packages (standard) |
| `@nexus-ai/config/tsconfig.json` | operator-cli, orchestrator (aliased) |
| `../../tsconfig.base.json` | render-service, video-studio (direct) |
| N/A | config (IS the base) |

**Recommendation**: Standardize on `../../packages/config/tsconfig.json` everywhere.

### Test Directory Layout Inconsistency

| Pattern | Used By |
|---------|---------|
| `src/__tests__/*.test.ts` (standard) | 18 packages/apps |
| `src/*.test.ts` (colocated) | render-service, news-sourcing, thumbnail |

**Recommendation**: Move colocated tests to `src/__tests__/` for consistency.

### Version Number Inconsistency

| Version | Used By |
|---------|---------|
| `0.1.0` (standard) | 14 packages |
| `1.0.0` | operator-cli, orchestrator |
| `0.0.0` | render-service, video-studio, config |

**Recommendation**: Align all to `0.1.0`.

### Missing Build Scripts

| Package | Issue |
|---------|-------|
| `packages/asset-library` | No `build` script (has `type-check` only) |
| `apps/video-studio` | `"test": "echo 'Tests run at root level'"` — noop test script |

### Package entry point anomaly

| Package | Issue |
|---------|-------|
| `packages/asset-library` | `"main": "src/index.ts"` — points to source, not `dist/` |

---

## DO NOT DELETE

These look unusual but serve a purpose:

| Path | Reason to Keep |
|------|---------------|
| `scripts/seed-pronunciation.ts` | DB seeding utility (used manually) |
| `scripts/upload-music-library.ts` | Asset upload utility (used manually) |
| `scripts/upload-sfx-library.ts` | Asset upload utility (used manually) |
| `packages/core/src/providers/tts/chirp-provider.ts` | Registered in TTS provider cascade |
| `packages/core/src/providers/tts/wavenet-provider.ts` | Registered in TTS provider cascade |
| `packages/config/` (no src/) | Config-only package (exports tsconfig + eslint) — intentional |
| `data/templates/`, `data/assets/` | Production templates, fonts |
| `infrastructure/` | Terraform configs for cloud deployment |
| `apps/video-studio/public/audio/` | Runtime SFX/music assets for Remotion |
| `packages/timestamp-extraction/scripts/generate-test-audio.ts` | Test fixture generator |
| `client_secret_*.json` | Already gitignored, NOT tracked. Exist only on disk. |

---

## Summary

| Category | Count | Disk Impact |
|----------|-------|-------------|
| **Definitely safe to delete** | 8 items (5 files + 3 dirs) | ~8.3 MB (mostly BMAD) |
| **Probably safe to delete** | 1 package (broll-engine) | ~50K |
| **Unused dependencies** | 3 | Reduces install size |
| **Dead exports** | 0 | — |
| **Gitignore fixes** | 4 items | — |
| **Structural issues** | 7 categories | — |
| **Pending git deletions** | ~150 files (.cursor, .gemini, .opencode, .ralph, nexus-epic5) | Already deleted on disk, need commit |
