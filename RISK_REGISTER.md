# RISK_REGISTER

Date: 2026-02-27

| ID | Risk | Evidence | Impact | Likelihood | Owner suggestion | Mitigation |
|---|---|---|---|---|---|---|
| R1 | Tracked secret exposure in repo content | infrastructure/service-accounts/provider.tf:4; docs/CONFIGURATION-STATUS.md sensitive lines | Critical | High | Security + Platform | Rotate credentials immediately, purge git history, add secret scanning gates |
| R2 | Root gate execution failure (build/lint) | turbo build/lint commands fail with Exec format error | High | High | DevEx/Platform | Fix runner compatibility; maintain fallback job path |
| R3 | Typecheck gate effectively non-executing | turbo check-types --dry shows command <NONEXISTENT>; workspace scripts are type-check | High | High | DevEx | Standardize script contract + enforce nonzero executed tasks |
| R4 | Core services not build-green | npm run -w @nexus-ai/orchestrator build failed; @nexus-ai/render-service build failed | High | High | Service owners | Resolve TS/module errors; block release on failures |
| R5 | Manual trigger abuse if perimeter misconfigured | apps/orchestrator/src/index.ts:31-33 + manual handler lacks explicit auth middleware | High | Medium | Backend/API owner | Add app-layer auth, rate limits, idempotency and actor auditing |
| R6 | Render endpoint auth conditional by env | apps/render-service/src/index.ts:52-63 | Medium-High | Medium | Render-service owner | Non-local startup hard-fail without auth secret/identity |
| R7 | Lint reliability degraded | core/news-sourcing parser project mismatch; tts missing ESLint config | Medium | High | DevEx | Unify ESLint config and tsconfig.eslint coverage |
| R8 | Test suite partially failing | vitest failures at arXiv and STT tests | Medium | Medium | QA + package owners | Fix tests and separate deterministic unit from integration checks |
| R9 | Local tooling injection/traversal hardening gaps | scripts/run-local.ts:506-514 and 953-955; local-storage resolvePath pattern | Medium | Medium | Security + Tooling | Use arg-safe spawn APIs + enforce path containment checks |
| R10 | Documentation drift | README.md:59 references missing docs/ARCHITECTURE.md; docs/CONTRIBUTING.md:122 stale baseline | Medium | Medium | Docs owner | Repair links; auto-sync quality metrics from CI artifacts |
| R11 | Dependency version skew | manifest scan found 9 multi-range dependencies | Medium | Medium | Platform | Introduce version policy/overrides and scheduled update cadence |
| R12 | Partial CI coverage model | cloudbuild exists; .github workflows absent | Medium | Low-Medium | Platform | Add provider-agnostic CI workflows for PR checks |
