# Contributing

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | >=20 |
| pnpm | 10.27.0 (see root packageManager) |
| ffmpeg | required for rendering/media checks |

## Setup

```bash
git clone <repo-url>
cd NEXUS-AI-PROJECT
pnpm install --frozen-lockfile
cp .env.local.example .env.local
```

## Standard local validation (must pass before PR)

```bash
pnpm -r --if-present run build
pnpm -r --if-present run lint
pnpm -r --if-present run type-check
pnpm -r --if-present run check-types
pnpm run test:ci
```

## Integration tests (opt-in)

Some tests hit external systems (network/cloud APIs). They are disabled by default.

```bash
RUN_INTEGRATION_TESTS=true pnpm run test:ci
```

## Package-level workflows

```bash
pnpm --filter @nexus-ai/visual-gen run build
pnpm --filter @nexus-ai/visual-gen run lint
pnpm --filter @nexus-ai/visual-gen run type-check
pnpm --filter @nexus-ai/visual-gen run test
```

## Code standards

- TypeScript ESM across workspace
- Imports should use runtime-correct `.js` extension where required
- Keep public package entrypoint exports in `src/index.ts`
- Keep tests deterministic by default; gate external integration behind env flags

## Security requirements

- Never commit real credentials/tokens.
- Run secret scan before push: `pnpm run scan:secrets`.
- Keep `.env.local` local only.
- For production-protected endpoints, maintain `NEXUS_SECRET` policy.

## Repo governance (big-repo baseline)

- CODEOWNERS: `/CODEOWNERS`
- PR template: `.github/pull_request_template.md`
- CI workflow: `.github/workflows/ci.yml`
- Security workflow: `.github/workflows/security.yml`
- Dependency updates: `.github/dependabot.yml`

## Related docs

- `docs/ARCHITECTURE.md`
- `docs/PIPELINE.md`
- `docs/API-KEYS.md`
- `docs/LOCAL_MODE.md`
