# ACTION_PLAN_30_60_90

Date: 2026-02-27

## Objective
Move the repository from partially gated + security-exposed state to deterministic, secure, release-ready engineering baseline.

## First 30 days (containment + unblockers)

1. Security incident containment
- Rotate all exposed credentials and tokens.
- Remove/replace secret-bearing values in tracked files.
- Purge secret history from git and enforce forced credential rollover.

2. Re-establish hard quality gates
- Fix turbo execution compatibility issue causing Exec format errors.
- Normalize root/workspace typecheck contract (check-types vs type-check).
- Ensure root build/lint/typecheck/test commands fail correctly on regressions.

3. Resolve release blockers
- Fix orchestrator build failures.
- Fix render-service build/module resolution failures.

4. Add prevention controls
- Add secret scanning pre-commit + CI.
- Add mandatory PR gate status for build/lint/typecheck/test.

Exit criteria (30d):
- No exposed secrets in current tree/history.
- All critical services build successfully.
- Root quality gates execute deterministically.

## Days 31-60 (stabilization + hardening)

1. Lint and test stabilization
- Standardize ESLint configuration across all workspaces.
- Add tsconfig.eslint coverage for test files.
- Fix currently failing vitest tests (arXiv and STT).
- Split unit vs integration test stages in CI.

2. Auth and endpoint hardening
- Add explicit auth middleware to manual/resume orchestrator endpoints.
- Add request rate limiting and idempotency protection for trigger routes.
- Enforce render-service non-local auth requirement.

3. Dependency hygiene
- Resolve version skew with central policy (pnpm overrides or equivalent).

Exit criteria (60d):
- Lint and tests produce actionable, low-noise signals.
- Trigger/render surfaces are protected by explicit app-layer controls.

## Days 61-90 (operational maturity)

1. CI/CD maturity
- Add or expand provider-agnostic CI workflows (PR gates, artifacts, status badges).
- Keep Cloud Build deployment flows but add pre-deploy verification jobs.

2. Security depth
- Add SAST/dependency scanning with triage SLA.
- Add periodic secret scanning on full git history and release branches.

3. Documentation and runbook parity
- Restore missing architecture documentation and keep docs linked to code truth.
- Replace stale hardcoded baseline stats with CI-generated metrics.

4. Local tooling safety
- Replace shell interpolation patterns with argument-safe process spawning.
- Add path normalization/containment checks in local file-serving and storage utilities.

Exit criteria (90d):
- Deterministic gates, secure secret lifecycle, hardened runtime surfaces, and accurate docs/ops runbooks.
