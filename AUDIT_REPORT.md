# AUDIT_REPORT

Date: 2026-02-27
Repository: /home/conanology/Downloads/NEXUS-AI-PROJECT (2)/NEXUS-AI-PROJECT

## Executive summary

This repository is a TypeScript monorepo with 4 apps and 17 packages, a staged AI-video pipeline, Cloud Run deployment manifests, and Terraform for scheduler/service account wiring. Core architecture is coherent, but the current engineering posture has one Critical issue and multiple High issues.

Overall posture:
- Architecture: Medium-High
- Build/quality gates: Medium-Low
- Security: Low-Medium (Critical secret exposure)
- Release readiness: Medium-Low

Top outcomes:
1) Critical: tracked secrets/credential material detected in repository content.
2) High: root turbo build/lint gates fail at runtime in current environment (Exec format error).
3) High: typecheck gate contract mismatch (turbo task name check-types vs workspace scripts type-check) causes effectively non-executing typecheck tasks.
4) High: build failures in orchestrator and render-service remain unresolved.
5) Medium: test and lint health are partially degraded.

---

## 1) Architecture + repo map (verified)

### Monorepo scope
- Workspaces: pnpm-workspace.yaml:1-4
- Root scripts/tasks: package.json:10-22, turbo.json:5-28
- Apps declared in docs: README.md:38-45

Apps discovered:
- apps/operator-cli
- apps/orchestrator
- apps/render-service
- apps/video-studio

Packages discovered:
- asset-library, audio-mixer, broll-engine, config, core, director-agent, news-sourcing, notifications, pronunciation, research, script-gen, thumbnail, timestamp-extraction, tts, twitter, visual-gen, youtube

### Runtime service entry points
- Orchestrator: apps/orchestrator/src/index.ts:30-33
- Render service: apps/render-service/src/index.ts:106,175
- Operator CLI bin: apps/operator-cli/package.json (bin) via runtime inspection
- Video studio entry: apps/video-studio/src/index.ts (runtime inspection)

### Pipeline flow (code)
- Stage registry and order: apps/orchestrator/src/stages.ts:1-120
- Pipeline execution core/retries: apps/orchestrator/src/pipeline.ts (see stage execution and retry sections)

### Infra and deployment
- Cloud Build manifests:
  - cloudbuild.yaml
  - cloudbuild-orchestrator.yaml
  - cloudbuild-render.yaml
- Terraform scheduler and IAM:
  - infrastructure/cloud-scheduler/main.tf:28-71
  - infrastructure/service-accounts/scheduler.tf:43-49

### Config/env surfaces
- .env.example:1-14
- .env.local.example:8-37
- Secret retrieval strategy: packages/core/src/secrets/get-secret.ts:61-105
- Storage mode switch (local/cloud): packages/core/src/storage/storage-factory.ts:34-38,66-71

### External integrations (verified from docs + code)
- Gemini / Google AI Studio + GCP services: docs/API-KEYS.md:11-27,56-64
- News sources (HN/HF/arXiv): docs/API-KEYS.md:72-74
- Visual providers (Giphy/Pexels/logo APIs): docs/API-KEYS.md:34-50,75-77

---

## 2) Real checks executed (build/lint/typecheck/tests/security)

## What I actually ran

1. ./node_modules/.bin/turbo run build
   - Result: failed
   - Error: Exec format error in workspace child process (asset-library)

2. ./node_modules/.bin/turbo run lint
   - Result: failed
   - Error: Exec format error in workspace child process (asset-library)

3. ./node_modules/.bin/turbo run check-types --dry
   - Result: completed dry-run, but commands are <NONEXISTENT> for tasks
   - Evidence: task command shows <NONEXISTENT> across workspaces

4. node node_modules/vitest/vitest.mjs run --workspace vitest.workspace.ts --reporter=verbose
   - Result: failed

5. node node_modules/vitest/vitest.mjs run --workspace vitest.workspace.ts --reporter=json --outputFile vitest-results.json
   - Result: failed run summary generated
   - Parsed summary:
     - total tests: 510
     - passed: 508
     - failed: 2

6. npm run -w @nexus-ai/orchestrator build
   - Result: failed
   - Error class: TypeScript compile errors in orchestrator pipeline/stages

7. npm run -w @nexus-ai/render-service build
   - Result: failed
   - Error class: TS2307 cannot find module @nexus-ai/core/dist/storage/firestore-client.js

8. npm run -w @nexus-ai/core build
   - Result: passed

9. npm run -w @nexus-ai/news-sourcing build
   - Result: passed

10. npm run -w @nexus-ai/tts build
    - Result: passed

11. npm run -w @nexus-ai/core lint
    - Result: failed
    - Error class: parserOptions.project / TSConfig include mismatch for test files

12. npm run -w @nexus-ai/news-sourcing lint
    - Result: failed
    - Error class: parserOptions.project / TSConfig include mismatch for test files

13. npm run -w @nexus-ai/tts lint
    - Result: failed
    - Error class: no ESLint config found

14. npm run -w @nexus-ai/core type-check
    - Result: passed

15. npm run -w @nexus-ai/news-sourcing type-check
    - Result: passed

16. npm audit --omit=dev --json
    - Result: failed
    - Error: ENOLOCK (npm lockfile required, repo uses pnpm lock)

17. pnpm audit --json
    - Result: success exit, no actionable output returned in this environment

18. pnpm outdated -r
    - Result: success exit, no outdated lines returned

19. Dependency skew check script (workspace manifest scan)
    - Result: 9 dependencies with multiple version ranges (zod, typescript, vitest, express, etc.)

20. Secret and exposure checks
    - find client_secret*.json
    - git ls-files sensitive surfaces
    - nl + grep checks for provider.tf / config docs / env templates

### Failed commands and fallback handling
- turbo build/lint failed (Exec format error) -> fallback: workspace-level npm run -w commands.
- full aggregate long-run build script attempt timed out in tool call -> fallback: targeted parallel workspace build checks.
- npm audit failed (ENOLOCK) -> fallback: pnpm audit + manifest skew analysis.

---

## 3) Findings (severity ordered)

## Critical

### C1) Tracked secret material in repository
Verified facts:
- infrastructure/service-accounts/provider.tf:4 contains hardcoded token material.
- docs/CONFIGURATION-STATUS.md includes plaintext secret values (observed at sensitive lines; previous checks flagged lines ~119,126,127).

Impact:
- Immediate credential compromise risk; potential cloud/API account abuse.

Likelihood: High

---

## High

### H1) Root build/lint gates are broken in this environment
Verified facts:
- Root tasks configured via turbo: package.json:10,12 and turbo.json:5-11.
- Commands fail with Exec format error.

Impact:
- Gate reliability compromised; CI/dev parity risk.

### H2) Typecheck gate contract mismatch (effectively non-executing task)
Verified facts:
- Root uses check-types: package.json:17 and turbo.json:13-15.
- Workspaces mostly define type-check, not check-types (e.g., packages/core/package.json:60; packages/tts/package.json:20).
- turbo dry-run shows command <NONEXISTENT> for check-types tasks.

Impact:
- Root typecheck gate can pass without executing real typechecks.

### H3) Build is not green (orchestrator, render-service)
Verified facts:
- npm run -w @nexus-ai/orchestrator build failed.
- npm run -w @nexus-ai/render-service build failed.
- Relevant areas:
  - apps/orchestrator/src/pipeline.ts
  - apps/orchestrator/src/stages.ts
  - apps/render-service/src/index.ts

Impact:
- Release blockers in core runtime services.

### H4) Manual trigger endpoints lack explicit app-layer auth guard
Verified facts:
- Exposed routes: apps/orchestrator/src/index.ts:31-33.
- Scheduled handler has auth shape checks and IAM assumption: apps/orchestrator/src/handlers/scheduled.ts:21-29,39-55.
- Manual handler processes request body and trigger controls without equivalent auth middleware: apps/orchestrator/src/handlers/manual.ts.

Impact:
- If perimeter/IAM config drifts, manual trigger abuse risk increases.

---

## Medium

### M1) Render-service auth enforcement is conditional on env secret presence
Verified facts:
- Secret check uses process.env.NEXUS_SECRET and returns next() if unset path not properly enforced globally: apps/render-service/src/index.ts:52-63.
- Protected endpoints exist at /render/async and /render/status/:jobId: apps/render-service/src/index.ts:106,175.

Impact:
- Misconfiguration could expose render operations.

### M2) Lint setup inconsistency
Verified facts:
- Many workspace lint scripts assume local config: e.g., packages/tts/package.json:17.
- tts lint fails due missing ESLint config.
- core/news-sourcing lint failures tied to tsconfig test-file inclusion mismatch:
  - packages/core/.eslintrc.cjs:3-6
  - packages/core/tsconfig.json:7-8 excludes test files

Impact:
- Lint signal quality degraded; harder to enforce policy.

### M3) Test suite not fully green
Verified facts:
- Vitest workspace coverage scope: vitest.workspace.ts:3-6.
- Failed tests include:
  - packages/news-sourcing/src/sources/arxiv-rss-source.test.ts:52
  - packages/timestamp-extraction/src/__tests__/stt-accuracy.test.ts:410

Impact:
- Regression confidence reduced.

### M4) Documentation drift
Verified facts:
- README references docs/ARCHITECTURE.md: README.md:59.
- docs directory does not contain ARCHITECTURE.md (direct listing).
- CONTRIBUTING baseline line may be stale: docs/CONTRIBUTING.md:122.

Impact:
- Onboarding and operational reliability degrade.

### M5) Local tooling security hardening gaps
Verified facts:
- Command construction with execSync string interpolation: scripts/run-local.ts:506-514.
- Static file server path join on request path without explicit base containment guard: scripts/run-local.ts:953-955.
- Local storage resolvePath uses path.resolve(basePath, normalized) without explicit post-check containment guard: packages/core/src/storage/local-storage-client.ts:59-63.

Impact:
- Local-mode command/path abuse risk if inputs become untrusted.

### M6) Dependency range skew
Verified facts:
- 9 dependencies with multiple ranges across workspaces (zod, typescript, vitest, express, GCP libs).

Impact:
- Upgrade friction and potential behavioral drift.

---

## Low

### L1) CI/CD coverage is partial
Verified facts:
- Cloud Build manifests exist (cloudbuild*.yaml).
- .github exists but no workflow files found.

Impact:
- Limited gate visibility for non-GCP pathways.

---

## 4) Verified facts vs inferred conclusions vs unknowns

Verified facts:
- Monorepo structure, task config, endpoint wiring, and command results listed above were directly observed.

Inferred conclusions:
- Release readiness is currently below production-grade due broken gates + unresolved core service build failures.
- Security incident probability is elevated until exposed credentials are rotated and history scrubbed.

Unknowns / gaps:
- Deployed Cloud Run IAM/network posture was not validated from live cloud state.
- pnpm audit returned no actionable detail in this environment; full SBOM-based vulnerability posture is incomplete.

---

## 5) Top 10 highest-leverage fixes (exact order)

1. Rotate all exposed credentials/tokens now (incident containment).
2. Purge secret-bearing files from git history and force credential reissue.
3. Add mandatory secret scanning in pre-commit and CI (block merges on findings).
4. Fix orchestrator build errors.
5. Fix render-service build/module-resolution errors.
6. Repair root gate contract: align check-types vs type-check across all workspaces.
7. Resolve turbo Exec format runtime issue (or replace with deterministic gate runner in CI).
8. Standardize ESLint configuration + test-inclusive tsconfig.eslint.
9. Add explicit auth middleware for /trigger/manual and /trigger/resume.
10. Enforce non-local startup hard-fail when render auth secret/identity config missing.


## Post-fix verification (2026-02-27)

### Commands run
- `/home/conanology/.npm-global/bin/pnpm install --frozen-lockfile`
- `/home/conanology/.npm-global/bin/pnpm -r --if-present run build`
- `/home/conanology/.npm-global/bin/pnpm -r --if-present run lint`
- `/home/conanology/.npm-global/bin/pnpm -r --if-present run type-check`
- `/home/conanology/.npm-global/bin/pnpm -r --if-present run check-types`
- `/home/conanology/.npm-global/bin/pnpm run test:ci`

### Results
- Build: pass
- Lint: pass (warnings present)
- Type-check: pass
- Check-types: pass
- Tests: pass (`vitest run --workspace vitest.workspace.ts`)

### Remaining operational item
- Credentials previously exposed in repository history still require external rotation + history cleanup workflow.
