# Nexus-AI

Automated AI video production pipeline that discovers trending tech topics, researches them, writes narration scripts, and renders broadcast-quality videos.

## What this repository contains

Nexus-AI is a pnpm monorepo with 4 apps and 17 packages.

### Apps
- `apps/orchestrator` — HTTP orchestration service (Cloud Run friendly)
- `apps/render-service` — async render API and job tracking
- `apps/video-studio` — Remotion composition app
- `apps/operator-cli` — operator/developer CLI

### Pipeline packages
- `news-sourcing`, `research`, `script-gen`, `pronunciation`, `tts`, `timestamp-extraction`, `visual-gen`, `thumbnail`, `youtube`, `twitter`, `notifications`

### Shared platform packages
- `core`, `asset-library`, `audio-mixer`, `broll-engine`, `director-agent`, `config`

## Quick start

```bash
pnpm install --frozen-lockfile
cp .env.local.example .env.local
pnpm run pipeline:local "AI is disrupting the SaaS industry"
```

Output: `./output/{topic-slug}/video.mp4`

## Runtime flow (code-accurate)

The orchestrator stage order is:
1. news-sourcing
2. research
3. script-gen
4. pronunciation
5. tts
6. timestamp-extraction
7. visual-gen (includes render-service integration)
8. thumbnail
9. youtube
10. twitter
11. notifications

Source of truth: `apps/orchestrator/src/stages.ts`.

## Validation commands (standard gate)

```bash
pnpm install --frozen-lockfile
pnpm -r --if-present run build
pnpm -r --if-present run lint
pnpm -r --if-present run type-check
pnpm -r --if-present run check-types
pnpm run test:ci
```

### Integration test policy

By default, CI and local baseline test runs skip external-network/cloud integration assertions.
To include integration tests explicitly:

```bash
RUN_INTEGRATION_TESTS=true pnpm run test:ci
```

## Security notes

- Never commit real credentials or tokens.
- Use `.env.local` for local secrets and cloud secret management for deployments.
- Manual trigger and render auth are protected by `NEXUS_SECRET` (production requires it).
- Run secret scanning: `pnpm run scan:secrets`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Pipeline](docs/PIPELINE.md)
- [API Keys](docs/API-KEYS.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Local Mode](docs/LOCAL_MODE.md)
- [System Map](SYSTEM_MAP.md)
- [Audit Report](AUDIT_REPORT.md)

## License

Private — all rights reserved.
