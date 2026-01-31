# System-Level Test Design

**Date:** 2026-01-30
**Author:** Cryptology
**Status:** Draft
**Project:** NEXUS-AI (youtube-automation)
**Mode:** System-Level Testability Review (Phase 3)

---

## Executive Summary

This document provides a system-level testability review of the NEXUS-AI architecture — a 10-stage autonomous YouTube video production pipeline built on a Turborepo monorepo with GCP infrastructure (Cloud Run, Cloud Functions, Firestore, Cloud Storage). The architecture supports 46 functional requirements and 25 non-functional requirements across 6 epics and 82 stories.

The existing codebase already has **151 test files** across **19 Vitest workspaces** with solid unit test coverage in critical packages (core: 46 tests, orchestrator: 19 tests). The architecture's provider abstraction pattern, typed stage contracts, and quality gate framework provide strong testability foundations.

**Overall Testability Assessment: PASS with CONCERNS**

The architecture is fundamentally testable with strong patterns (provider abstraction, typed contracts, quality gates). Concerns center on: (1) CI/CD pipeline lacks quality gates, (2) render performance validation requires dedicated infrastructure, (3) 15/19 workspaces still need vitest.config.ts files (most already created but untracked).

---

## Testability Assessment

### Controllability: PASS

**Strengths:**
- **Provider Abstraction with Interfaces**: All external APIs (LLM, TTS, Image) use `LLMProvider`, `TTSProvider`, `ImageProvider` interfaces — fully mockable via dependency injection
- **Typed Stage Contracts**: `StageInput<T>` / `StageOutput<T>` ensure every stage has well-defined boundaries, making test doubles straightforward
- **`withRetry` and `withFallback` Utilities**: Centralized wrappers allow testing retry/fallback behavior without hitting real APIs — both already have test coverage in `core/utils/__tests__/`
- **Provider Registry**: Primary/fallback chains are configured declaratively — tests can swap in mock providers trivially
- **Pipeline State in Firestore**: State can be seeded, inspected, and reset via Firestore emulator for deterministic testing
- **Cloud Storage Artifacts**: GCS emulator enables controlled artifact setup for render/upload stages
- **Quality Gates per Stage**: Each gate is a pure function (`validateOutput`, `qualityGate`) — fully unit-testable and already tested in `core/quality/__tests__/`

**Concerns:**
- **Cloud Scheduler Trigger**: The daily 6 AM UTC trigger is infrastructure-level; testing requires either emulation or manual invocation. The orchestrator HTTP handler is testable independently of the scheduler.
- **Secret Manager Access**: `getSecret()` calls need to be mockable in tests. Architecture enforces secret injection pattern (already tested in `core/secrets/__tests__/`).

### Observability: PASS

**Strengths:**
- **Structured Logging**: Logger pattern (`nexus.{package}.{module}`) with `onStageStart`, `onStageComplete`, `onQualityDegraded`, `onError` events — test assertions can verify log output
- **Cost Tracking (`CostTracker`)**: Per-stage, per-video cost tracking provides measurable output for cost NFR validation — already tested in `core/observability/__tests__/`
- **Quality Metrics in `StageOutput`**: Every stage returns `quality: QualityMetrics` and `provider: { name, tier, attempts }` — test assertions can verify quality decisions
- **Error Severity Classification**: `ErrorSeverity` enum (RETRYABLE, FALLBACK, DEGRADED, RECOVERABLE, CRITICAL) enables deterministic error handling verification — tested in `core/errors/__tests__/`
- **Pipeline State Persistence**: Firestore documents capture stage progression, enabling state inspection in integration tests

**Concerns:**
- **GCP Cloud Monitoring Integration**: Production metrics (Cloud Logging, Monitoring) are infrastructure-bound. Tests should validate metric emission (log output), not the monitoring platform itself.
- **Discord/Email Alerts**: Notification delivery is external. Tests should verify alert trigger conditions and payload construction, not actual delivery.

### Reliability: PASS with CONCERNS

**Strengths:**
- **Stage Isolation**: Each stage is an independent package with its own `execute{Stage}()` function — tests run in isolation without cross-stage contamination
- **Deterministic Error Handling**: Four-tier severity (RETRYABLE → FALLBACK → DEGRADED → CRITICAL) with explicit stage criticality mapping — fully testable decision tree
- **Quality Gate Pre-Publish**: `qualityGateCheck()` returns `AUTO_PUBLISH`, `AUTO_PUBLISH_WITH_WARNING`, or `HUMAN_REVIEW` — deterministic, unit-testable
- **Typed Error Codes**: `NEXUS_{DOMAIN}_{TYPE}` format enables precise error matching in tests
- **Pipeline Orchestration**: 6 test files covering pipeline flow, skip recovery, and health checks in `apps/orchestrator`

**Concerns:**
- **Remotion Render Testing**: Video rendering (4 CPU, 8GB Cloud Run) is resource-intensive. Unit/integration tests can validate scene composition and timeline JSON, but actual render output validation requires either lightweight render in CI or dedicated staging environment.
- **Audio Stitching**: TTS chunking and stitching (FR17) involves actual audio file manipulation. Tests need audio fixture files or mock audio generation. Existing `tts` package has 5 tests including chunking integration.
- **Parallel Test Safety**: Firestore documents keyed by `YYYY-MM-DD` pipeline ID create potential date collisions in parallel test runs. Tests should use unique pipeline IDs (e.g., `test-{uuid}`).

---

## Architecturally Significant Requirements (ASRs)

These quality requirements drive architecture decisions and pose testability challenges:

| ASR ID | Requirement | Source | Probability | Impact | Score | Testability Challenge |
|--------|-------------|--------|-------------|--------|-------|-----------------------|
| ASR-001 | 100% daily publish rate (30/30 days) | NFR1 | 2 | 3 | **6** | Requires end-to-end pipeline execution validation; buffer fallback verification |
| ASR-002 | Pipeline duration <4 hours | NFR6 | 2 | 2 | 4 | Performance testing requires full pipeline execution; stage timing instrumentation needed |
| ASR-003 | Cost per video <$0.50 (credit) / <$1.50 (post-credit) | NFR10-11 | 2 | 2 | 4 | Cost tracking must be validated per-stage; mock API responses must include realistic cost data |
| ASR-004 | Pronunciation accuracy >98% | NFR18 | 2 | 2 | 4 | Dictionary coverage testing; SSML output validation against known pronunciations |
| ASR-005 | 100% programmatic visuals (zero stock) | NFR19 | 1 | 3 | 3 | Remotion composition validation; no visual asset sourcing from external stock APIs |
| ASR-006 | News freshness <24hr hard / <12hr target | NFR20 | 2 | 2 | 4 | Time-based scoring algorithm validation; mock timestamp data for edge cases |
| ASR-007 | API credentials encrypted (Secret Manager) | NFR23 | 1 | 3 | 3 | Secret injection pattern testable; verify no hardcoded credentials in codebase |
| ASR-008 | 3 retries before fallback | NFR15 | 1 | 2 | 2 | `withRetry` utility fully unit-testable with mock failures — already tested |
| ASR-009 | Alert delivery <1 minute | NFR9 | 2 | 2 | 4 | Alert trigger timing testable; delivery depends on Discord/email external services |
| ASR-010 | Render <45 minutes for 8-min video | NFR7 | 2 | 3 | **6** | Render performance testing requires dedicated infrastructure; cannot run in standard CI |

**High-Priority ASRs (Score ≥6):**
- **ASR-001** (100% daily publish): Mitigate with integration tests validating buffer deployment, fallback chains, and quality gate decisions
- **ASR-010** (Render <45min): Mitigate with benchmark tests on dedicated Cloud Run instance; CI validates composition correctness only

---

## Test Levels Strategy

Based on the architecture (backend pipeline, API-heavy, no user-facing UI except operator CLI):

### Recommended Split: 60% Unit / 25% Integration / 15% E2E

| Level | Percentage | Rationale |
|-------|------------|-----------|
| **Unit** | 60% | Pipeline is logic-heavy: scoring algorithms, quality gates, error classification, cost calculation, SSML generation, script validation. All pure functions or mockable. |
| **Integration** | 25% | Stage-to-stage data flow, Firestore state persistence, Cloud Storage artifact handling, provider fallback chains with multiple services, orchestrator coordination. |
| **E2E** | 15% | Full pipeline execution (source → render → upload), operator CLI workflows, buffer deployment flow, alert → notification delivery chain. |

### Test Approach per Architecture Layer

| Layer | Test Level | Approach | Status |
|-------|------------|----------|--------|
| `packages/core/types` | Unit | Type compilation + contract tests | ✅ Tested |
| `packages/core/errors` | Unit | Factory methods, severity classification | ✅ Tested |
| `packages/core/utils` | Unit | `withRetry`, `withFallback`, `executeStage` | ✅ Tested |
| `packages/core/providers` | Unit + Integration | Mock API responses (unit), real API smoke (int) | ✅ Tested |
| `packages/core/storage` | Integration | Firestore emulator, GCS emulator | ⚠️ Recently modified |
| `packages/core/quality` | Unit | Quality gate pure functions | ✅ Tested |
| `packages/core/observability` | Unit + Integration | Logger output, cost tracking, alert triggers | ✅ Tested |
| `packages/news-sourcing` | Unit + Integration | Scoring algorithm (unit), source fetching (int) | ✅ 7 tests |
| `packages/research` | Unit + Integration | Prompt construction (unit), LLM mock (int) | ✅ 2 tests |
| `packages/script-gen` | Unit + Integration | Validation logic (unit), multi-agent pipeline (int) | ✅ 5 tests |
| `packages/pronunciation` | Unit | Dictionary lookup, SSML tagging, term extraction | ✅ 9 tests |
| `packages/tts` | Unit + Integration | Chunking logic (unit), audio stitching (int) | ✅ 5 tests |
| `packages/visual-gen` | Unit + Integration | Scene mapping (unit), timeline JSON (int) | ✅ 6 tests |
| `packages/thumbnail` | Unit + Integration | Template fallback (unit), image gen mock (int) | ⚠️ 1 test |
| `packages/youtube` | Integration | Upload mock, metadata, scheduling | ✅ 9 tests |
| `packages/twitter` | Integration | Post construction, API mock | ⚠️ 2 tests |
| `packages/notifications` | Unit + Integration | Digest construction (unit), dispatch mock (int) | ✅ 5 tests |
| `apps/orchestrator` | Integration + E2E | Stage coordination, state transitions, health | ✅ 19 tests |
| `apps/video-studio` | Unit + Integration | Remotion composition, component rendering | ✅ 4 tests |
| `apps/render-service` | Integration | Render dispatch, artifact storage | ⚠️ 2 tests |
| `apps/operator-cli` | Integration + E2E | CLI command execution, Firestore interaction | ✅ 10 tests |

---

## NFR Testing Approach

### Security (NFR23-25)

**Approach:** Static analysis + unit tests
- **Secret Handling (NFR23):** Verify all API keys retrieved via `getSecret()` (Secret Manager abstraction). Grep codebase for hardcoded credentials. Provider constructors require secret injection. Already tested in `core/secrets/__tests__/`.
- **Credential Rotation (NFR24):** Integration test that swapping secrets does not require code changes — providers re-fetch secrets on initialization.
- **Audit Logging (NFR25):** Unit test that all API calls emit structured log entries with timestamps. Integration test that Firestore `incidents` collection captures API call audit trail.
- **Tools:** Vitest (unit/integration), `npm audit` (dependency scanning), lint rules (no hardcoded secrets)

**Assessment: PASS** — Architecture uses Secret Manager abstraction; provider interfaces enforce secret injection.

### Performance (NFR6-9)

**Approach:** Instrumentation + benchmark tests
- **Pipeline Duration <4hr (NFR6):** Integration test validates stage timing instrumentation (`StageOutput.durationMs`). Benchmark test on staging validates aggregate pipeline time.
- **Render <45min (NFR7):** Benchmark test on Cloud Run (4 CPU, 8GB) with standardized input. Cannot run in CI — requires dedicated performance environment.
- **Retry Latency <30s (NFR8):** Unit test that `withRetry` exponential backoff produces delays within bounds. Already tested.
- **Alert Delivery <1min (NFR9):** Integration test that alert trigger → notification dispatch happens within timing budget (mock external delivery).
- **Tools:** Vitest (unit timing validation), benchmark scripts (staging environment), Cloud Monitoring (production)

**Assessment: CONCERNS** — Render performance (NFR7) cannot be validated in CI. Recommend dedicated benchmark environment for Sprint 0.

### Reliability (NFR1-5)

**Approach:** Integration tests + chaos scenarios
- **100% Daily Publish (NFR1):** Integration test covering: normal flow → publish, degraded → publish with warning, failure → buffer deployment. Pipeline orchestrator has 19 test files covering these flows.
- **5hr Buffer (NFR2):** Integration test that pipeline completion timestamp is >5 hours before 2 PM UTC publish time (mock clock).
- **Auto-Fallback (NFR3):** Integration test per stage: primary fails → fallback succeeds → `StageOutput.provider.tier === 'fallback'`.
- **Notification Always Runs (NFR4):** Integration test that notification stage executes even when preceding stages throw CRITICAL errors.
- **Buffer Minimum 1 (NFR5):** Integration test that buffer count is checked pre-pipeline; alert fires when buffer < 2.
- **Tools:** Vitest (integration), GCP emulators (Firestore state), mock providers (failure injection)

**Assessment: PASS** — Architecture's `ErrorSeverity` classification, `withFallback` chains, and quality gate pattern provide comprehensive testable reliability controls.

### Maintainability

**Approach:** CI tooling + observability validation
- **Test Coverage:** Vitest v8 coverage provider already configured. Target: 80% for `packages/core`, 60% for stage packages and apps.
- **Code Duplication:** Add `jscpd` to CI pipeline (<5% threshold).
- **Dependency Vulnerabilities:** `npm audit` in CI (no critical/high).
- **Observability:** Unit tests validate structured logger output format, cost tracker calculations, and quality metric emission.
- **Tools:** Vitest (coverage), GitHub Actions (CI pipeline), `jscpd`, `npm audit`

**Assessment: PASS** — Vitest workspace with per-package coverage thresholds already configured.

---

## Test Environment Requirements

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| **Local Development** | Unit + Integration tests | Docker Compose: Firestore emulator, GCS emulator. No external API access. Mock providers for all external services. |
| **CI (GitHub Actions)** | Unit + Integration tests | Containerized. Vitest workspace runs all packages in parallel. Coverage reporting via v8. |
| **Staging** | E2E + Performance tests | GCP project with real Cloud Run, Firestore, Cloud Storage. Test API keys. Render benchmark environment (4 CPU, 8GB). |
| **Production** | Monitoring + Smoke tests | Daily health check validates production pipeline readiness. Post-deploy smoke test verifies orchestrator HTTP endpoint. |

### Emulator Requirements

- **Firestore Emulator**: Required for all integration tests touching pipeline state, pronunciation dictionary, incidents, buffer management
- **Cloud Storage Emulator**: Required for artifact storage tests (audio files, video files, thumbnails, scene assets)
- **Secret Manager Mock**: Required for provider initialization tests. Simple environment variable fallback in test mode.

---

## Testability Concerns

### Concern 1: CI/CD Pipeline Lacks Quality Gates (HIGH)

**Issue:** `cloudbuild.yaml` runs Docker build only — no type-check, lint, test, or coverage steps before deployment.

**Impact:** Broken code can ship to production without any automated quality verification.

**Recommendation:**
1. Add quality gates to Cloud Build: install → type-check → lint → test → coverage → Docker build
2. Create `cloudbuild-pr.yaml` for PR validation that blocks merging on test failure
3. Enforce coverage thresholds: 80% (core), 60% (stage packages, apps)

### Concern 2: Remotion Render Validation (MEDIUM)

**Issue:** Video rendering (FR20) requires 4 CPU, 8GB RAM Cloud Run and produces MP4 output. Standard CI environments cannot execute full renders.

**Impact:** Cannot validate render quality (frame drops, audio sync) in CI.

**Recommendation:**
1. Unit test Remotion React compositions (component rendering, props, timeline structure)
2. Integration test scene timeline JSON generation (validates visual-gen output)
3. Lightweight render test with reduced resolution (480p, 10 seconds) in CI
4. Full render benchmark in staging environment (weekly schedule)

### Concern 3: Missing vitest.config.ts in Workspaces (MEDIUM)

**Issue:** While most workspace configs have been created (visible in git status as untracked files), they are not yet committed. 15 of 19 workspaces need their configs committed.

**Impact:** Workspace-aware test discovery and per-package coverage thresholds not fully enforced.

**Recommendation:**
1. Commit all existing vitest.config.ts files
2. Verify each config has appropriate coverage thresholds
3. Ensure vitest.workspace.ts references all workspace configs

### Concern 4: Low Coverage in Specific Packages (MEDIUM)

**Issue:** Several packages have insufficient test coverage relative to source file count: `thumbnail` (1 test), `render-service` (2 tests), `broll-engine` (2 tests), `twitter` (2 tests).

**Impact:** Under-tested packages increase risk of regressions during implementation.

**Recommendation:**
1. Prioritize test additions for `thumbnail` (directly impacts NFR22 — 3 A/B variants)
2. Add integration tests for `render-service` (critical path for video output)
3. Fill coverage gaps during epic-level implementation

### Concern 5: Date-Based Pipeline IDs (LOW)

**Issue:** Pipeline IDs use `YYYY-MM-DD` format. Parallel test runs on the same date could collide.

**Impact:** Flaky tests if multiple test suites touch Firestore pipeline documents simultaneously.

**Recommendation:**
1. Test pipeline IDs should use format `test-{uuid}` instead of date-based IDs
2. Firestore emulator resets between test suites
3. Each test uses isolated pipeline ID via test fixture

---

## Architecture Patterns — Test Coverage Status

| Pattern | Test Location | Status |
|---------|--------------|--------|
| `withRetry` + `withFallback` | `core/utils/__tests__/` | ✅ PASS |
| Quality Gates | `core/quality/__tests__/` | ✅ PASS |
| CostTracker | `core/observability/__tests__/` | ✅ PASS |
| NexusError hierarchy | `core/errors/__tests__/` | ✅ PASS |
| StageInput/StageOutput contracts | `core/types/__tests__/` | ✅ PASS |
| Provider Registry | `core/providers/__tests__/` | ✅ PASS |
| Pipeline orchestration | `orchestrator/__tests__/` (6 files) | ✅ PASS |
| Firestore persistence | `core/storage/__tests__/` | ⚠️ REVIEW (recently modified) |
| Cloud Storage operations | `core/storage/__tests__/` | ⚠️ REVIEW (recently modified) |
| Secret Manager access | `core/secrets/__tests__/` | ✅ PASS |
| Health checks | `orchestrator/health/__tests__/` | ✅ PASS |

---

## Recommendations for Sprint 0

### P0 — Must Fix Before Production

1. **Add quality gates to Cloud Build** — Install deps → type-check → lint → test → coverage → Docker build
2. **Commit vitest.config.ts files** — All 15+ untracked workspace configs need to be committed
3. **Set coverage thresholds** — 80% for `packages/core`, 60% for stage packages and apps
4. **Create PR validation pipeline** — `cloudbuild-pr.yaml` blocks merging on test failure

### P1 — Should Fix Before Production

5. **Create shared test utilities** — Common mock factories for Firestore, Cloud Storage, Logger, CostTracker, and all Provider interfaces
6. **Add Docker Compose emulators** — Firestore emulator and GCS emulator for local integration testing
7. **Fill critical coverage gaps** — `thumbnail` (1→5 tests), `render-service` (2→5 tests), `broll-engine` (2→5 tests)
8. **Tag integration tests** — Separate `@integration` tests for conditional CI execution

### P2 — After Initial Production

9. **Provision staging environment** — GCP project with Cloud Run for render benchmarking (NFR7)
10. **Add pipeline performance tests** — Validate stage timing instrumentation and aggregate pipeline duration (NFR6)
11. **Create E2E test scaffold** — Full pipeline execution test with mock providers and GCP emulators
12. **Review recently modified storage tests** — Verify Firestore and Cloud Storage test coverage after recent changes

---

## Existing Test Infrastructure Baseline

| Metric | Current | Target |
|--------|---------|--------|
| Test files | 151 | ~200+ |
| Vitest workspace configs | 20 (1 root + 19 packages/apps) | 20 (all committed) |
| CI quality gates | 0 | 6 (install, type-check, lint, test, coverage, build) |
| Coverage thresholds | None enforced | 80% core / 60% others |
| E2E tests | 0 | Scaffold (Sprint 0) |
| Integration tests | ~10 | ~25 |
| Test framework | Vitest 1.0.0+ | Vitest 1.1.0+ (aligned) |
| Coverage provider | v8 | v8 |

---

## Quality Gate Criteria (Solutioning Gate)

### Testability Gate Decision: **PASS with CONCERNS**

| Criteria | Status | Details |
|----------|--------|---------|
| Controllability | **PASS** | Provider abstraction, typed contracts, quality gates — all mockable |
| Observability | **PASS** | Structured logging, cost tracking, quality metrics in stage output |
| Reliability | **PASS** | Stage isolation, deterministic error handling, quality gate pre-publish |
| ASR Coverage | **CONCERNS** | ASR-001 (daily publish, score 6) and ASR-010 (render <45min, score 6) require dedicated integration/benchmark environments |
| NFR Security | **PASS** | Secret Manager abstraction, no hardcoded credentials pattern |
| NFR Performance | **CONCERNS** | Render benchmark needs dedicated environment; pipeline timing needs staging validation |
| NFR Reliability | **PASS** | Fallback chains, buffer system, quality gates fully testable |
| NFR Maintainability | **PASS** | Vitest workspace, coverage thresholds, CI pipeline structure defined |
| CI/CD Quality Gates | **CONCERNS** | Cloud Build currently lacks test/coverage steps |

**Overall Recommendation:** Proceed to implementation. Address CONCERNS by:
1. Adding CI quality gates (P0, Sprint 0)
2. Committing vitest workspace configs (P0, Sprint 0)
3. Setting up staging benchmark environment (P2, post-initial production)

---

## Appendix

### Knowledge Base References

- `nfr-criteria.md` — NFR validation approach (security, performance, reliability, maintainability)
- `test-levels-framework.md` — Test levels strategy guidance (unit/integration/E2E decision matrix)
- `risk-governance.md` — Testability risk identification and scoring
- `test-quality.md` — Quality standards and Definition of Done

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`

### Follow-on Workflows

- Run `*testarch-framework` to initialize/standardize Vitest configuration patterns
- Run `*testarch-ci` to scaffold CI/CD quality pipeline with test execution gates
- Run `*testarch-test-design` in **Epic-Level mode** per-epic during Phase 4 implementation
- Run `*testarch-atdd` to generate failing P0 acceptance tests (separate workflow, not auto-run)

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
