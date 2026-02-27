# SYSTEM_MAP

## 1. Repository topology

Root layout:
- apps/
- packages/
- infrastructure/
- scripts/
- docs/
- tests/
- cloudbuild*.yaml

Workspace model:
- pnpm-workspace.yaml:1-4
- turbo task graph: turbo.json:5-28

Apps (runtime services/tools):
1) @nexus-ai/operator-cli
   - entry: apps/operator-cli/src/index.ts, src/cli.ts
   - binary: nexus -> dist/index.js
2) @nexus-ai/orchestrator
   - entry: apps/orchestrator/src/index.ts
3) @nexus-ai/render-service
   - entry: apps/render-service/src/index.ts
4) @nexus-ai/video-studio
   - entry: apps/video-studio/src/index.ts

Packages (functional modules):
- core platform: core, config
- pipeline stages: news-sourcing, research, script-gen, pronunciation, tts, timestamp-extraction, visual-gen, thumbnail, youtube, twitter, notifications
- video/asset stack: director-agent, asset-library, audio-mixer, broll-engine

## 2. Runtime HTTP surfaces

Orchestrator (apps/orchestrator/src/index.ts):
- GET /health
- POST /trigger/scheduled
- POST /trigger/manual
- POST /trigger/resume

Scheduled auth path:
- apps/orchestrator/src/handlers/scheduled.ts checks Bearer token shape and assumes Cloud Run IAM identity path.

Manual trigger path:
- apps/orchestrator/src/handlers/manual.ts executes manual/resume with request options (wait, skip health, stages).

Render-service (apps/render-service/src/index.ts):
- POST /render/async
- GET /render/status/:jobId
- request auth via x-nexus-secret (conditioned by NEXUS_SECRET)

## 3. Pipeline dataflow

Stage order source: apps/orchestrator/src/stages.ts
Nominal flow:
1. news-sourcing
2. research
3. script-gen
4. pronunciation
5. tts
6. timestamp-extraction
7. visual-gen
8. thumbnail
9. youtube
10. twitter
11. notifications

Execution engine: apps/orchestrator/src/pipeline.ts
- retry + severity handling
- stage state persistence hooks

## 4. Storage and state model

Storage abstraction:
- packages/core/src/storage/storage-factory.ts
  - local if STORAGE_MODE=local or bucket unset
  - cloud otherwise

Local storage client:
- packages/core/src/storage/local-storage-client.ts

Cloud storage client:
- packages/core/src/storage/cloud-storage-client.ts

Secret resolution:
- packages/core/src/secrets/get-secret.ts
  precedence: cache -> env var -> Secret Manager

Logging model:
- packages/core/src/observability/logger.ts
  pino-based structured logging, env-driven level

## 5. Build/test/lint orchestration

Root scripts (package.json):
- build, lint, test, test:ci, check-types, test:e2e, pipeline:local

Task graph (turbo.json):
- build dependsOn ^build
- lint dependsOn ^lint
- check-types dependsOn ^check-types
- test/test:ci non-cached

Test workspace:
- vitest.workspace.ts includes all packages/* and apps/* vitest configs
- playwright.config.ts for e2e path

## 6. CI/CD and infrastructure

Build/deploy manifests:
- cloudbuild.yaml
- cloudbuild-orchestrator.yaml
- cloudbuild-render.yaml

Terraform:
- cloud scheduler job with OIDC token to /trigger/scheduled:
  infrastructure/cloud-scheduler/main.tf:51-59
- scheduler SA + roles/run.invoker:
  infrastructure/service-accounts/scheduler.tf:43-49

GitHub workflows:
- .github directory present, no workflow files found during this audit.

## 7. Env/config surfaces

Examples:
- .env.local.example
- .env.example

Observed env usage across code: 46 distinct process.env keys in apps/packages/scripts scan.
High-impact keys include:
- NEXUS_GEMINI_API_KEY / GEMINI_API_KEY
- NEXUS_SECRET
- RENDER_SERVICE_URL
- NEXUS_BUCKET_NAME / NEXUS_PROJECT_ID
- STORAGE_MODE / LOCAL_STORAGE_PATH

## 8. External integration map

Direct integrations (docs/API-KEYS.md + code):
- Google AI Studio / Gemini
- Google Cloud: Storage, Firestore, Secret Manager
- Hacker News, HuggingFace, arXiv
- Giphy, Pexels
- YouTube, Twitter/X, Discord webhook

## 9. Architecture boundary notes

Strong boundaries:
- stage modules mostly isolated under packages/*
- orchestrator coordinates via stage registry
- core package centralizes storage/secrets/observability

Boundary pressure points:
- render-service imports internal dist path from core (build fragility)
- quality gates currently inconsistent between root task names and workspace scripts
