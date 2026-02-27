# API Keys & External Services

Store local secrets in `.env.local` only. Do not commit real values.

## Required core key

### Gemini
- Primary env: `NEXUS_GEMINI_API_KEY`
- Fallback env: `GEMINI_API_KEY`
- Used by research/script/director/visual/TTS flows

## Security/auth variables

| Variable | Used by | Notes |
|---|---|---|
| `NEXUS_SECRET` | orchestrator manual/resume trigger + render-service auth | Required in production for protected routes |
| `RENDER_SERVICE_URL` | visual-gen/orchestrator render calls | Cloud/local render endpoint |
| `GOOGLE_APPLICATION_CREDENTIALS` | cloud integrations + optional integration tests | Path to service account JSON |
| `RUN_INTEGRATION_TESTS` | test suite | Set `true` to run network/cloud integration tests |

## Optional service keys

| Variable | Service | Purpose |
|---|---|---|
| `PEXELS_API_KEY` | Pexels | Stock image enrichment |
| `GIPHY_API_KEY` | Giphy | Meme reaction enrichment |
| `NEXUS_DISCORD_WEBHOOK_URL` | Discord | notifications package |

## Cloud deployment variables

| Variable | Purpose |
|---|---|
| `NEXUS_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | GCP project identity |
| `NEXUS_BUCKET_NAME` | artifact storage bucket |

## Security policy

- Never keep live credentials in docs or source files.
- Keep `client_secret*.json` out of git.
- Use secret manager in cloud deployments.
- Run secret checks before push: `pnpm run scan:secrets`.
