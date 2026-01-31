# Test Design: All Epics (1-6) - NEXUS-AI Full System

**Date:** 2026-01-30
**Author:** Cryptology
**Status:** Draft
**Scope:** Full system test design covering all 6 epics (82 stories, 46 FRs, 25 NFRs)

---

## Executive Summary

**Scope:** Full test design across all epics for the NEXUS-AI autonomous YouTube video production pipeline.

**Risk Summary:**

- Total risks identified: 18
- High-priority risks (>=6): 5
- Critical categories: SEC, PERF, DATA, TECH, OPS

**Coverage Summary:**

- P0 scenarios: 22 (44 hours)
- P1 scenarios: 35 (35 hours)
- P2/P3 scenarios: 48 (18.5 hours)
- **Total effort**: 97.5 hours (~12.2 days)

**Existing Test Baseline:**

- 159 test files across 19 Vitest workspaces
- Strong unit coverage in core (46 tests), orchestrator (19 tests)
- Gaps in thumbnail (1 test), render-service (2 tests), broll-engine (2 tests), twitter (2 tests)
- E2E scaffold exists (1 file) but no production E2E tests

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | SEC | YouTube OAuth token exposure or mishandling during upload/scheduling (FR24-28). Tokens stored in Secret Manager but rotation and refresh token lifecycle untested at integration level. | 2 | 3 | 6 | Integration tests verifying OAuth refresh flow; secret injection pattern validation; credential rotation test without code change (NFR24). Existing `core/secrets/__tests__/` provides foundation. | Dev | Sprint 0 |
| R-002 | PERF | Remotion render exceeds 45-min SLA for 8-minute videos (NFR7). 4 CPU / 8GB Cloud Run instance. No performance benchmark in CI. | 2 | 3 | 6 | Lightweight render test (480p, 10s) in CI; full benchmark on staging Cloud Run (weekly). Scene composition validated at unit level. | QA | Sprint 1 |
| R-003 | DATA | Pipeline state corruption in Firestore during stage failures (FR42-46). Date-based pipeline IDs (`YYYY-MM-DD`) risk collision in parallel executions. State recovery after partial writes untested. | 2 | 3 | 6 | Integration tests with Firestore emulator covering: partial write recovery, concurrent pipeline ID handling, state consistency after CRITICAL errors. Use `test-{uuid}` IDs in tests. | Dev | Sprint 0 |
| R-004 | TECH | Provider fallback chain fails silently or loses quality metadata (FR43). `withFallback` returns `tier: 'fallback'` but downstream stages may not propagate quality context, leading to degraded content published without warning. | 2 | 3 | 6 | Integration tests validating full fallback chain: primary fails -> fallback succeeds -> `StageOutput.provider.tier === 'fallback'` -> quality gate receives degraded context -> correct gate decision. Test per provider type (LLM, TTS, Image). | Dev | Sprint 0 |
| R-005 | OPS | CI/CD pipeline has zero quality gates (Concern #1 from system-level review). Cloud Build runs Docker build only. Broken code can ship to production. | 3 | 2 | 6 | Implement `cloudbuild-pr.yaml` with: install -> type-check -> lint -> test -> coverage -> build. Block merges on test failure. Enforce coverage thresholds (80% core, 60% others). | Ops | Sprint 0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-006 | TECH | Audio chunking/stitching produces audible artifacts at chunk boundaries (FR17). TTS chunks >5000 chars stitched together; gap/overlap detection untested with real audio patterns. | 2 | 2 | 4 | Integration test with audio fixture files; validate silence detection at boundaries; waveform continuity check. Existing `tts/__tests__/stitching.test.ts` covers basics. | Dev |
| R-007 | BUS | Freshness scoring algorithm selects stale or irrelevant topics (FR2-3). Formula `(virality * authority / hours_since_break)` edge cases: all sources return same topic, no topics < 24hr old, zero virality score. | 2 | 2 | 4 | Unit tests for scoring edge cases: time boundary (23hr vs 25hr), zero/negative values, tie-breaking, insufficient viable topics (<3 trigger). Existing `scoring.test.ts` covers happy path. | Dev |
| R-008 | PERF | Pipeline exceeds 4-hour SLA (NFR6). 10 stages each with retry/fallback adds latency. No aggregate timing validation. | 2 | 2 | 4 | Integration test that instruments `StageOutput.durationMs` per stage; sum validates <4hr. Benchmark on staging with real API calls (mocked latency profiles). | QA |
| R-009 | DATA | Pronunciation dictionary grows unbounded; lookup performance degrades (FR11-14). No pagination or caching strategy for dictionary queries. Auto-add (FR14) could create duplicates. | 1 | 3 | 3 | Unit test for dictionary lookup performance with 1000+ entries; duplicate detection test for auto-add; Firestore query pagination if >500 terms. | Dev |
| R-010 | SEC | API keys logged in structured logs (NFR25). Logger pattern emits full context; if provider error includes request headers or auth tokens, they appear in logs. | 2 | 2 | 4 | Unit test that NexusError.context and logger output do NOT contain patterns matching API key formats. Add sanitization to logger for known secret patterns. | Dev |
| R-011 | TECH | Visual generation fallback produces monotonous content (FR21). "Text on gradient" fallback for all scenes creates unwatchable video. No variety in fallback visuals. | 1 | 2 | 2 | Unit test that fallback visuals include randomized gradient/color selection per scene. Integration test that consecutive fallback scenes produce visually distinct outputs. | Dev |
| R-012 | BUS | YouTube upload quota exceeded (NFR16). Daily quota at 80% threshold not enforced. Retry storms after upload failures could exhaust quota. | 2 | 2 | 4 | Integration test for quota tracking: verify quota check before upload, simulate approaching 80% threshold, validate alert trigger. Existing `quota.test.ts` provides foundation. | Dev |
| R-013 | OPS | Buffer video system empty during pipeline failure (NFR5). Buffer depletion alert fires at <2 but no automated buffer regeneration. Manual buffer creation required. | 2 | 2 | 4 | Integration test: simulate pipeline failure -> buffer deployed -> buffer count drops to 0 -> alert fires. Verify buffer status in daily digest. Existing `buffer/__tests__/` covers management. | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-014 | OPS | Twitter/X posting fails silently (FR29). RECOVERABLE severity means failure is logged but not alerted. Social promotion missed without notice. | 1 | 1 | 1 | Monitor |
| R-015 | BUS | Thumbnail A/B testing lacks feedback loop (FR22). 3 variants generated but no mechanism to select winner based on CTR data. | 1 | 1 | 1 | Monitor |
| R-016 | TECH | Remotion component library limited to 5-7 templates (NFR19). Repetitive visuals across daily videos may reduce viewer retention. | 1 | 2 | 2 | Monitor |
| R-017 | OPS | Operator CLI commands untested in production GCP context. All 10 CLI tests use mocks; no smoke test against real Firestore. | 1 | 2 | 2 | Monitor |
| R-018 | DATA | Cost tracking drift (NFR13). `CostTracker` calculates from API response metadata; if providers change pricing or token counting, costs become inaccurate. | 1 | 2 | 2 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Test Coverage Plan

### P0 (Critical) - Run on every commit

**Criteria**: Blocks core journey + High risk (>=6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| Pipeline orchestration: source->notify flow (FR1-FR46) | Integration | R-003, R-004 | 3 | QA | Full pipeline mock; stage skip recovery; buffer deployment |
| Provider fallback chain - LLM (FR43) | Unit + Integration | R-004 | 3 | Dev | Primary fail -> fallback -> quality context propagated |
| Provider fallback chain - TTS (FR43) | Unit + Integration | R-004 | 3 | Dev | Gemini -> Chirp -> WaveNet chain with quality tracking |
| Provider fallback chain - Image (FR43) | Unit + Integration | R-004 | 2 | Dev | Gemini Image -> template thumbnailer |
| Quality gate pre-publish decisions (FR42-46) | Unit | R-004 | 3 | Dev | AUTO_PUBLISH, WARNING, HUMAN_REVIEW paths |
| withRetry exponential backoff (NFR15) | Unit | R-004 | 2 | Dev | Retry count, delay bounds, exhaustion |
| Secret Manager injection (NFR23-24) | Unit + Integration | R-001 | 2 | Dev | No hardcoded credentials; rotation without code change |
| OAuth token refresh for YouTube (FR24) | Integration | R-001 | 2 | Dev | Expired token refresh; invalid token handling |
| Firestore state persistence (pipeline state) | Integration | R-003 | 2 | Dev | Partial write recovery; concurrent ID handling |

**Total P0**: 22 tests, 44 hours

### P1 (High) - Run on PR to main

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| News freshness scoring algorithm (FR2) | Unit | R-007 | 4 | Dev | Edge cases: 24hr boundary, zero virality, tie-breaking |
| Topic selection with <3 viable topics (FR4) | Unit | R-007 | 2 | Dev | Fallback trigger, deep-dive topic selection |
| Script generation validation (FR8-9) | Unit | - | 3 | Dev | Word count range, regeneration trigger |
| Multi-agent script pipeline (FR7) | Integration | - | 2 | Dev | Writer -> Critic -> Optimizer full chain |
| Pronunciation dictionary lookup + SSML (FR11-15) | Unit | R-009 | 3 | Dev | Term extraction, dictionary check, SSML output |
| Unknown term flagging >3 threshold (FR13) | Unit | - | 2 | Dev | Threshold trigger, review queue routing |
| TTS chunking and stitching (FR17) | Integration | R-006 | 3 | Dev | Chunk boundaries, silence detection |
| Visual cue matching to templates (FR18) | Unit | - | 2 | Dev | Cue parsing, template selection, fallback |
| Scene timeline JSON generation (FR19) | Unit + Integration | - | 3 | Dev | Valid JSON schema, dynamic duration, composition |
| Thumbnail generation 3 variants (FR22) | Unit + Integration | - | 2 | Dev | 3 variants produced, template fallback |
| YouTube upload + metadata (FR24-25) | Integration | R-012 | 3 | Dev | Resumable upload, metadata formatting, quota check |
| Scheduled publishing 2 PM UTC (FR27) | Unit | - | 2 | Dev | Timezone handling, schedule verification |
| Daily health check (FR30) | Integration | - | 2 | Dev | All services checked, failure handling |
| Cost tracking per-video (FR33, NFR10-13) | Unit | R-018 | 2 | Dev | Cost calculation, budget alerts |

**Total P1**: 35 tests, 35 hours

### P2 (Medium) - Run nightly/weekly

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| Discord webhook alerts (FR31) | Unit | - | 3 | Dev | Payload construction, severity routing |
| Daily digest email (FR32) | Unit + Integration | - | 3 | Dev | Digest assembly, template rendering |
| Incident logging (FR34) | Unit | - | 2 | Dev | Timestamp, duration, root cause capture |
| Buffer video management (FR36-37) | Integration | R-013 | 3 | Dev | Create, deploy, depletion alert |
| Pronunciation dictionary management (FR38) | Unit | - | 2 | Dev | CRUD operations, auto-add dedup |
| Human review queue (FR40) | Unit + Integration | - | 3 | Dev | Queue routing, item resolution |
| Topic skip/re-queue (FR41, FR46) | Unit | - | 2 | Dev | Skip logic, next-day queue |
| Twitter/X posting (FR29) | Integration | R-014 | 2 | Dev | Post construction, failure handling |
| Operator CLI commands | Integration | R-017 | 5 | Dev | trigger, status, retry, buffer, costs |
| Visual fallback variety (FR21) | Unit | R-011 | 2 | Dev | Gradient randomization, scene distinctness |
| Audio mixer integration (Epic 6) | Unit + Integration | - | 3 | Dev | Voice activity detection, music ducking |
| BrowserFrame component (Epic 6) | Unit | - | 2 | Dev | Browser demo template rendering |
| Remotion dynamic duration (Epic 6) | Unit | - | 2 | Dev | Scene duration calculation, composition timing |

**Total P2**: 34 tests, 17 hours

### P3 (Low) - Run on-demand

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| ----------- | ---------- | ---------- | ----- | ----- |
| Full pipeline performance benchmark (NFR6) | E2E | 2 | QA | Staging environment only |
| Remotion render benchmark (NFR7) | E2E | 2 | QA | Cloud Run 4CPU/8GB |
| Visual regression (Remotion components) | Component | 3 | Dev | Snapshot testing |
| Cost optimization scenarios | Unit | 2 | Dev | Budget threshold alerts |
| Milestone tracking (subscriber, revenue) | Unit | 2 | Dev | Achievement triggers |
| API rate limit behavior | Integration | 3 | Dev | YouTube, Gemini, Twitter quotas |

**Total P3**: 14 tests, 1.5 hours (setup only; execution time varies)

---

## Execution Order

### Smoke Tests (<5 min)

**Purpose**: Fast feedback, catch build-breaking issues

- [ ] Pipeline orchestrator HTTP handler responds (30s)
- [ ] Core package exports compile and resolve (15s)
- [ ] Provider registry initializes without errors (15s)
- [ ] Quality gate functions return valid decisions (15s)
- [ ] Firestore client connects to emulator (30s)

**Total**: 5 scenarios

### P0 Tests (<10 min)

**Purpose**: Critical path validation

- [ ] Full pipeline flow: source -> script -> TTS -> visual -> render -> upload -> notify (Integration)
- [ ] Provider fallback chain: LLM primary fails -> fallback succeeds (Integration)
- [ ] Provider fallback chain: TTS primary fails -> fallback succeeds (Integration)
- [ ] Provider fallback chain: Image primary fails -> template fallback (Integration)
- [ ] Quality gate: degraded pipeline -> HUMAN_REVIEW decision (Unit)
- [ ] Quality gate: clean pipeline -> AUTO_PUBLISH decision (Unit)
- [ ] Secret injection: providers initialize from Secret Manager (Integration)
- [ ] OAuth refresh: expired YouTube token refreshes successfully (Integration)
- [ ] Firestore state: partial failure recovery (Integration)
- [ ] Pipeline skip: stage fails -> buffer deployed -> notification sent (Integration)
- [ ] withRetry: 3 retries with exponential backoff (Unit)
- [ ] withFallback: provider chain with quality tier tracking (Unit)

**Total**: 12 scenarios (subset of 22 P0 tests)

### P1 Tests (<30 min)

**Purpose**: Important feature coverage

- [ ] News freshness scoring: time boundary, zero virality, tie-break (Unit)
- [ ] Topic selection: insufficient topics -> fallback trigger (Unit)
- [ ] Script validation: word count range, regeneration (Unit)
- [ ] Multi-agent script: Writer -> Critic -> Optimizer chain (Integration)
- [ ] Pronunciation: term extraction, dictionary lookup, SSML output (Unit)
- [ ] Unknown term flagging: >3 threshold -> review queue (Unit)
- [ ] TTS chunking: split >5000 chars, stitch audio segments (Integration)
- [ ] Visual cue matching: cue -> template -> fallback (Unit)
- [ ] Timeline JSON: valid schema, dynamic duration (Unit + Integration)
- [ ] Thumbnail: 3 variants generated, template fallback (Unit + Integration)
- [ ] YouTube upload: resumable upload, metadata, quota check (Integration)
- [ ] Scheduling: 2 PM UTC timezone handling (Unit)
- [ ] Health check: all services validated (Integration)
- [ ] Cost tracking: per-video calculation, budget alert (Unit)

**Total**: 14 scenario groups (35 individual tests)

### P2/P3 Tests (<60 min)

**Purpose**: Full regression coverage

- [ ] Discord alerts, email digest, incident logging (Unit)
- [ ] Buffer management: create, deploy, depletion alert (Integration)
- [ ] Pronunciation CRUD, human review queue (Unit + Integration)
- [ ] Topic skip/re-queue, Twitter posting (Unit + Integration)
- [ ] Operator CLI: all 8 commands (Integration)
- [ ] Audio mixer: ducking, music selection, quality gate (Unit + Integration)
- [ ] Epic 6 components: BrowserFrame, dynamic duration (Unit)
- [ ] Performance benchmarks (E2E, staging only)

**Total**: 8 scenario groups (48 individual tests)

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| -------- | ----- | ---------- | ----------- | ----- |
| P0 | 22 | 2.0 | 44 | Complex setup, security, integration |
| P1 | 35 | 1.0 | 35 | Standard feature coverage |
| P2 | 34 | 0.5 | 17 | Simple scenarios, existing patterns |
| P3 | 14 | ~0.1 | 1.5 | Benchmark setup, execution varies |
| **Total** | **105** | **-** | **97.5** | **~12.2 days** |

### Prerequisites

**Test Data:**

- Pipeline state fixtures (Firestore documents for each pipeline stage)
- Audio fixture files (short WAV clips for TTS stitching tests)
- Script fixtures (1200w, 1800w, and out-of-range samples)
- Pronunciation dictionary seed (200 terms from production seed.json)
- Scene timeline JSON fixtures (valid and malformed)

**Tooling:**

- Vitest (unit/integration test runner) - already configured across 20 workspaces
- Firestore Emulator (pipeline state, pronunciation, incidents, buffer)
- Cloud Storage Emulator (artifact storage: audio, video, thumbnails)
- Docker Compose (local emulator orchestration)
- GitHub Actions (CI pipeline)

**Environment:**

- Local: Docker Compose with GCP emulators, mock providers
- CI: GitHub Actions with Vitest workspace parallel execution
- Staging: GCP project with real Cloud Run for render benchmarks
- Production: Post-deploy smoke test (orchestrator health endpoint)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (core package)**: >=80%
- **Security scenarios**: 100%
- **Business logic (scoring, validation, gates)**: >=70%
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Performance targets validated in staging (PERF category)
- [ ] CI pipeline includes type-check, lint, test, coverage gates

---

## Mitigation Plans

### R-001: YouTube OAuth Token Exposure (Score: 6)

**Mitigation Strategy:** Create integration test that validates: (1) OAuth tokens retrieved from Secret Manager only, (2) token refresh succeeds when expired, (3) invalid tokens trigger CRITICAL error (not silent failure), (4) no tokens appear in structured log output.
**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Integration test passes; grep codebase for hardcoded credentials returns zero results.

### R-002: Remotion Render SLA Violation (Score: 6)

**Mitigation Strategy:** (1) CI runs lightweight 480p/10s render validation (composition correctness), (2) Weekly staging benchmark on Cloud Run 4CPU/8GB validates <45min for standard 8-min video, (3) Scene timeline JSON validated at unit level for composition structure.
**Owner:** QA
**Timeline:** Sprint 1 (benchmark after initial production deployment)
**Status:** Planned
**Verification:** CI render test passes; staging benchmark consistently under 45 minutes.

### R-003: Firestore State Corruption (Score: 6)

**Mitigation Strategy:** (1) Integration tests with Firestore emulator covering partial write scenarios, (2) Test pipeline IDs use `test-{uuid}` format to avoid date collisions, (3) State recovery test: simulate CRITICAL error mid-pipeline, verify state is consistent and next run starts clean.
**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Integration tests pass; parallel test runs do not produce flaky failures.

### R-004: Provider Fallback Quality Loss (Score: 6)

**Mitigation Strategy:** (1) Integration test per provider type (LLM, TTS, Image) validating: primary fails -> fallback returns result with `tier: 'fallback'` -> `StageOutput.qualityContext.fallbacksUsed` includes provider name -> quality gate receives degraded signal -> correct AUTO_PUBLISH_WITH_WARNING or HUMAN_REVIEW decision. (2) Unit test that `withFallback` preserves provider metadata through the chain.
**Owner:** Dev
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** All 3 provider fallback chains tested end-to-end; quality gate makes correct decision based on degradation context.

### R-005: CI/CD Zero Quality Gates (Score: 6)

**Mitigation Strategy:** (1) Create `cloudbuild-pr.yaml` with 6 gates: install -> type-check -> lint -> test -> coverage -> Docker build. (2) Block PR merges on gate failure. (3) Set coverage thresholds: 80% for `packages/core`, 60% for all others. (4) Commit all 15+ untracked vitest.config.ts files.
**Owner:** Ops
**Timeline:** Sprint 0 (before any production deployment)
**Status:** Planned
**Verification:** PR with failing test is blocked from merging; coverage report generated and enforced.

---

## Assumptions and Dependencies

### Assumptions

1. GCP emulators (Firestore, Cloud Storage) are available and function identically to production for integration testing
2. External API mocks (Gemini, YouTube, Twitter, Discord) accurately simulate real API behavior including error responses
3. Vitest workspace configuration (20 files) will be committed and stable before test development begins
4. Audio fixture files can be generated deterministically for TTS stitching tests (no dependency on external audio)
5. Staging GCP project will be provisioned for render benchmarking by Sprint 1

### Dependencies

1. CI/CD pipeline (R-005 mitigation) - Required before Sprint 0 test execution
2. Firestore emulator Docker configuration - Required for integration tests
3. vitest.config.ts files committed - Required for workspace-aware test discovery
4. Audio fixture generation script - Required for TTS integration tests
5. Staging GCP project - Required for performance benchmark tests (P3)

### Risks to Plan

- **Risk**: GCP emulators may not perfectly replicate production Firestore behavior
  - **Impact**: Integration tests may pass locally but fail against real Firestore
  - **Contingency**: Add smoke tests against staging Firestore after deploy

- **Risk**: External API mocking may not cover all error scenarios
  - **Impact**: Edge case failures in production not caught by tests
  - **Contingency**: Monitor production error logs; add test cases for each new error pattern

---

## Epic-Specific Coverage Summary

### Epic 1: Core Platform Foundation (10 stories, all done)
**Test Files:** 46 (packages/core)
**Coverage Status:** Strong unit coverage. Core utilities (withRetry, withFallback, executeStage) fully tested.
**Gaps:** Firestore/Cloud Storage recently modified; review integration tests.

### Epic 2: Content Intelligence Pipeline (13 stories, all done)
**Test Files:** 23 (news-sourcing: 7, research: 2, script-gen: 5, pronunciation: 9)
**Coverage Status:** Good coverage for scoring, SSML, and pronunciation. Research package has minimal tests.
**Gaps:** Freshness scoring edge cases; multi-agent script pipeline integration.

### Epic 3: Media Production Pipeline (8 stories, all done)
**Test Files:** 19 (tts: 5, visual-gen: 6, thumbnail: 1, video-studio: 11 - includes Epic 6 additions, render-service: 2)
**Coverage Status:** TTS and visual-gen have decent coverage. Thumbnail and render-service critically under-tested.
**Gaps:** Thumbnail generation (1 test for FR22 requiring 3 variants); render-service integration.

### Epic 4: Distribution & Publishing (5 stories, all done)
**Test Files:** 11 (youtube: 9, twitter: 2)
**Coverage Status:** YouTube package well-tested (upload, metadata, quota, scheduler). Twitter minimal.
**Gaps:** Twitter posting integration; YouTube OAuth refresh integration.

### Epic 5: Operations & Autonomous Running (12 stories, all done)
**Test Files:** 34 (orchestrator: 19, operator-cli: 10, notifications: 5)
**Coverage Status:** Orchestrator is the best-tested app. Operator CLI has comprehensive command tests.
**Gaps:** Buffer depletion E2E flow; incident logging with real pipeline state.

### Epic 6: Broadcast Quality Video Enhancement (34 stories, all done)
**Test Files:** 31 (timestamp-extraction: 8, audio-mixer: 7, broll-engine: 2, visual-gen Epic 6 additions: 3, video-studio Epic 6 additions: 7, script-gen Epic 6 additions: 4)
**Coverage Status:** Timestamp extraction well-tested. Audio mixer has good unit coverage.
**Gaps:** Broll engine (2 tests for browser demo templates); dynamic duration composition integration.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation gaps are addressed.
- Run `*testarch-ci` to scaffold CI quality pipeline per R-005 mitigation.
- Run `*testarch-framework` to standardize vitest workspace configs.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: __________ Date: __________
- [ ] Tech Lead: __________ Date: __________
- [ ] QA Lead: __________ Date: __________

**Comments:**

---

---

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework (6 categories, scoring matrix, gate decisions)
- `probability-impact.md` - Risk scoring methodology (probability x impact, automated classification)
- `test-levels-framework.md` - Test level selection (unit/integration/E2E decision matrix)
- `test-priorities-matrix.md` - P0-P3 prioritization (automated priority calculation, risk mapping)

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- System-Level Test Design: `_bmad-output/test-design-system.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
