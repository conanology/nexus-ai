# NEXUS-AI Architecture

This document is aligned to the current codebase and runtime wiring.

## 1) Monorepo topology

### Apps
- `apps/orchestrator` — orchestrates stage execution and pipeline state
- `apps/render-service` — render API (sync + async) and in-memory job tracking
- `apps/video-studio` — Remotion root/compositions
- `apps/operator-cli` — trigger + operational commands

### Packages
- Core pipeline: `news-sourcing`, `research`, `script-gen`, `pronunciation`, `tts`, `timestamp-extraction`, `visual-gen`, `thumbnail`, `youtube`, `twitter`, `notifications`
- Platform: `core`, `config`, `asset-library`, `audio-mixer`, `broll-engine`, `director-agent`

Workspace/build control:
- `pnpm-workspace.yaml`
- `turbo.json`
- root `package.json` scripts

## 2) Service boundaries and API surfaces

## Orchestrator (`apps/orchestrator/src/index.ts`)
Routes:
- `GET /health`
- `POST /trigger/scheduled`
- `POST /trigger/manual`
- `POST /trigger/resume`
- `POST /trigger` (deprecated alias to manual)

Security:
- Manual/resume/trigger routes are guarded by `manualAuthMiddleware` using `x-nexus-secret`.
- In production, missing `NEXUS_SECRET` causes manual endpoints to return 503 auth-not-configured.

## Render service (`apps/render-service/src/index.ts`)
Routes:
- `GET /health`
- `POST /render`
- `POST /render/async`
- `GET /render/status/:jobId`

Security:
- Auth middleware validates `x-nexus-secret` when `NEXUS_SECRET` is set.
- Startup hard-fails in production if `NEXUS_SECRET` is absent.

## 3) Pipeline execution model

Stage registry and order are defined in:- `apps/orchestrator/src/stages.ts`

Execution order:
1) news-sourcing
2) research
3) script-gen
4) pronunciation
5) tts
6) timestamp-extraction
7) visual-gen
8) thumbnail
9) youtube
10) twitter
11) notifications

Notes:
- `render` is mapped in stage registry for compatibility but is executed inside `visual-gen`.

## 4) State, storage, and secrets

- Pipeline state manager: `apps/orchestrator/src/state.ts`
- Storage selection: `packages/core/src/storage/storage-factory.ts`
- Local storage: `packages/core/src/storage/local-storage-client.ts`
- Cloud storage: `packages/core/src/storage/cloud-storage-client.ts`
- Secret resolution: `packages/core/src/secrets/get-secret.ts`

## 5) Build/test/lint architecture

- Build orchestrator: Turborepo (root `turbo.json`)
- Test runner: Vitest workspace mode (root `vitest.workspace.ts`)
- E2E runner: Playwright (root `playwright.config.ts`)
- Lint config baseline: `packages/config/eslint.js`

Standard quality gate:
```bash
pnpm install --frozen-lockfile
pnpm -r --if-present run build
pnpm -r --if-present run lint
pnpm -r --if-present run type-check
pnpm -r --if-present run check-types
pnpm run test:ci
```

Integration tests are opt-in using:
`RUN_INTEGRATION_TESTS=true`

## 6) Delivery and CI/CD

### GitHub workflows
- `.github/workflows/ci.yml` — install/build/lint/typecheck/tests
- `.github/workflows/security.yml` — secret scan + dependency audit

### Cloud build/deploy specs
- `cloudbuild.yaml`
- `cloudbuild-render.yaml`
- `cloudbuild-orchestrator.yaml`

### Infrastructure as code
- `infrastructure/cloud-scheduler/main.tf`
- `infrastructure/service-accounts/scheduler.tf`
- `infrastructure/service-accounts/provider.tf`

## 7) Security invariants

- No real tokens in tracked docs/config.
- `NEXUS_SECRET` required for production manual/render protected routes.
- Local pre-commit runs secret scanner script: `scripts/scan-secrets.sh`.
- `client_secret*.json` and env files are ignored from VCS.

## 8) Related references

- `SYSTEM_MAP.md` — generated detailed system map
- `AUDIT_REPORT.md` — prioritized findings + remediation
- `RISK_REGISTER.md` — risk matrix
- `ACTION_PLAN_30_60_90.md` — phased execution plan
