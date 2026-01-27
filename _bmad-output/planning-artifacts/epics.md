---
stepsCompleted: [1, 2, 3, 4]
requirementsConfirmed: true
epicsApproved: true
storiesGenerated: true
validationComplete: true
workflowComplete: true
completedAt: "2026-01-07"
totalStories: 82
totalEpics: 6
frCoverage: "46/46 (100%)"
nfrCoverage: "25/25 (100%)"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/product-brief-youtube-automation-2026-01-07.md"
  - "_bmad-output/analysis/brainstorming-session-2026-01-07.md"
  - "_bmad-output/project-context.md"
---

# youtube-automation - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for NEXUS-AI (youtube-automation), decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**News Intelligence (FR1-5)**
- FR1: System can fetch trending content from GitHub Trending, HuggingFace Papers, Hacker News, r/MachineLearning, and arXiv RSS
- FR2: System can score news items by freshness formula `(virality × authority / hours_since_break)`
- FR3: System can rank and select top topic(s) for daily coverage
- FR4: System can detect when viable topics are insufficient (<3) and trigger fallback
- FR5: System can store topic selection with source URLs and metadata

**Content Generation (FR6-10)**
- FR6: System can generate research briefs from selected topics using AI models
- FR7: System can generate scripts following Writer → Critic → Optimizer pipeline
- FR8: System can validate script length is within 1,200-1,800 word range
- FR9: System can regenerate scripts that fail validation with adjusted parameters
- FR10: System can embed visual cues and pronunciation hints in scripts

**Pronunciation & Voice (FR11-17)**
- FR11: System can maintain a pronunciation dictionary with IPA phonemes
- FR12: System can extract technical terms from scripts and check against dictionary
- FR13: System can flag unknown terms for human review when threshold exceeded (>3)
- FR14: System can auto-add flagged terms to dictionary after resolution
- FR15: System can generate SSML-tagged scripts with pronunciation markup
- FR16: System can synthesize speech audio from SSML scripts via TTS
- FR17: System can chunk long scripts (>5000 chars) and stitch audio segments

**Visual Production (FR18-23)**
- FR18: System can match script visual cues to Remotion component templates
- FR19: System can generate scene timeline JSON and custom graphics assets
- FR20: System can render video from audio + visual timeline + assets (1080p @ 30fps)
- FR21: System can use fallback visuals ("text on gradient") when primary templates unavailable
- FR22: System can generate 3 A/B thumbnail variants per video via AI image generation
- FR23: System can use template thumbnails when AI generation fails

**YouTube Publishing (FR24-29)**
- FR24: System can upload videos via YouTube Data API with resumable upload
- FR25: System can set video metadata (title, description, tags, affiliate links)
- FR26: System can set thumbnails for uploaded videos
- FR27: System can schedule video publication for specified time (2 PM UTC)
- FR28: System can verify upload success via API confirmation
- FR29: System can post video links to Twitter/X on publish

**Monitoring & Alerting (FR30-35)**
- FR30: System can perform daily health check before pipeline execution (6 AM UTC)
- FR31: System can send critical alerts via Discord webhook
- FR32: System can send daily digest email with pipeline results, metrics, and flags
- FR33: System can track and report cost per video
- FR34: System can log incidents with timestamps, duration, root cause, and resolution
- FR35: Operator can view pipeline status and health metrics via dashboard

**Operator Management (FR36-41)**
- FR36: Operator can trigger manual override to publish buffer video
- FR37: System can maintain buffer video queue for emergency use
- FR38: Operator can view and manage pronunciation dictionary entries
- FR39: Operator can view cost tracking dashboard
- FR40: Operator can access human review queue for flagged items
- FR41: Operator can mark topics for skip or re-queue to next day

**Error Recovery (FR42-46)**
- FR42: System can retry failed operations with configurable retry count (default: 3)
- FR43: System can fallback to alternate AI models when primary fails
- FR44: System can skip day and alert operator when all fallbacks exhausted
- FR45: System can continue NOTIFY stage even when earlier stages have failures
- FR46: System can queue failed topics for next day processing

### NonFunctional Requirements

**Reliability (NFR1-5)**
- NFR1: System must publish video daily with 100% success rate (30/30 days MVP target)
- NFR2: Pipeline must complete with 5+ hours buffer before scheduled publish
- NFR3: System must recover from single-stage failures via auto-fallback or skip
- NFR4: Notification stage must execute regardless of prior stage failures
- NFR5: System must maintain minimum 1 buffer video for emergency deployment

**Performance (NFR6-9)**
- NFR6: Total pipeline duration must be <4 hours (6:00 AM → 10:00 AM UTC)
- NFR7: Video render time must be <45 minutes for 8-minute video
- NFR8: API retry latency must be <30 seconds between attempts
- NFR9: Alert delivery time must be <1 minute from trigger event

**Cost Efficiency (NFR10-13)**
- NFR10: Cost per video must be <$0.50 during GCP credit period
- NFR11: Cost per video must be <$1.50 post-credit period
- NFR12: Monthly operating cost must be <$50 (Month 1-2)
- NFR13: Cost tracking must be real-time accurate within $0.01

**Integration Resilience (NFR14-17)**
- NFR14: API timeout handling must be configurable per external service
- NFR15: System must attempt 3 retries before triggering fallback
- NFR16: YouTube API quota usage must stay below 80% of daily quota
- NFR17: External API availability must be verified via health check before pipeline run

**Quality Assurance (NFR18-22)**
- NFR18: Pronunciation accuracy must exceed 98% correct terms per video
- NFR19: Visual content must be 100% programmatic (zero stock footage)
- NFR20: News freshness must be <24 hours (hard limit), <12 hours (target)
- NFR21: Script word count must be validated within 1,200-1,800 word range
- NFR22: Thumbnail generation must produce 3 A/B variants per video

**Security (NFR23-25)**
- NFR23: API credentials must be encrypted at rest via GCP Secret Manager
- NFR24: Credential rotation must be supported without code changes
- NFR25: All API calls must be audit logged with timestamps

### Additional Requirements

**From Architecture Document:**

**Starter Template Requirement:**
- Project must be initialized with Turborepo monorepo using: `pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm`
- Remotion video-studio must be added with: `npm create video@latest apps/video-studio`

**Infrastructure Requirements:**
- GCP ecosystem: Cloud Run, Cloud Functions, Firestore, Cloud Storage, Secret Manager
- Hybrid deployment model: Cloud Run for heavy workloads (orchestrator, TTS, render), Cloud Functions for light API operations
- Budget constraint: $300 GCP credit / 90-day runway, target <$50/month

**Provider Abstraction Requirements:**
- All external APIs must use interface-based abstraction with fallback chains
- TTS: Primary `gemini-2.5-pro-tts` → Fallback1 `chirp3-hd` → Fallback2 `wavenet`
- LLM: Primary `gemini-3-pro-preview` → Fallback `gemini-2.5-pro`
- Image: Primary `gemini-3-pro-image-preview` → Fallback template thumbnails

**State Persistence Requirements:**
- Firestore structure: `pipelines/{YYYY-MM-DD}/*`, `pronunciation/{term}`, `topics/{YYYY-MM-DD}`, `buffer-videos/{id}`, `incidents/{id}`
- Cloud Storage structure: `nexus-ai-artifacts/{date}/{stage}/{file}`

**Quality Gate Requirements:**
- Pre-publish quality gate with three outcomes: AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, HUMAN_REVIEW
- Stage-specific quality gates: script-gen (word count), tts (silence/clipping), render (frame drops, audio sync), thumbnail (3 variants)

**Pattern Enforcement Requirements:**
- All stages must use `StageInput<T>` / `StageOutput<T>` typed contracts
- All external API calls must use `withRetry` + `withFallback` wrappers
- All stages must track costs via `CostTracker`
- All stages must use structured logger (no console.log)
- All stages must call quality gate before returning
- All secrets must come from Secret Manager (no hardcoded credentials)

**Naming Convention Requirements:**
- TypeScript: PascalCase interfaces, camelCase functions, SCREAMING_SNAKE constants, kebab-case files
- Packages: `@nexus-ai/{name}` scope
- Error codes: `NEXUS_{DOMAIN}_{TYPE}`
- Logger names: `nexus.{package}.{module}`
- Environment variables: `NEXUS_` prefix
- Secrets: `nexus-{service}-{purpose}`

**From Product Brief & Brainstorming:**

**Persona-Driven Requirements:**
- Target personas: Dev Marcus (morning 7:30 AM), Founder Priya (6 AM workout), Enthusiast Jordan (9 PM evening)
- Core promise: 5-8 minute daily videos covering 3-5 AI developments

**Monetization Requirements:**
- Affiliate links from Day 1 (AI tools)
- AdSense eligible by Month 3 (1,000 subs + 4,000 watch hours)
- Sponsor integration by Month 4 (after 10K subscribers)

**Content Quality Requirements:**
- Pronunciation dictionary seeded with 200 initial terms
- Living IPA dictionary for proper nouns, acronyms, technical terms
- Visual component library: 5-7 Remotion templates initially (neural networks, data flows, comparisons, metrics, product mockups, transitions, lower-thirds)

**Operational Requirements:**
- Daily digest email at 8 AM for human oversight
- Human-in-the-loop checkpoints: controversial topics, unknown pronunciations, quality gate failures
- 3-day content buffer before going fully autonomous

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Fetch trending content from 5 sources |
| FR2 | Epic 2 | Score news by freshness formula |
| FR3 | Epic 2 | Rank and select top topics |
| FR4 | Epic 2 | Detect insufficient topics, trigger fallback |
| FR5 | Epic 2 | Store topic selection with metadata |
| FR6 | Epic 2 | Generate research briefs via AI |
| FR7 | Epic 2 | Multi-agent script generation |
| FR8 | Epic 2 | Validate script word count |
| FR9 | Epic 2 | Regenerate failed scripts |
| FR10 | Epic 2 | Embed visual cues and pronunciation hints |
| FR11 | Epic 2 | Maintain pronunciation dictionary |
| FR12 | Epic 2 | Extract and check technical terms |
| FR13 | Epic 2 | Flag unknown terms for review |
| FR14 | Epic 2 | Auto-add terms to dictionary |
| FR15 | Epic 2 | Generate SSML-tagged scripts |
| FR16 | Epic 3 | Synthesize speech via TTS |
| FR17 | Epic 3 | Chunk and stitch audio segments |
| FR18 | Epic 3 | Match visual cues to templates |
| FR19 | Epic 3 | Generate scene timeline JSON |
| FR20 | Epic 3 | Render video 1080p @ 30fps |
| FR21 | Epic 3 | Fallback visuals when needed |
| FR22 | Epic 3 | Generate 3 A/B thumbnail variants |
| FR23 | Epic 3 | Template thumbnail fallback |
| FR24 | Epic 4 | YouTube resumable upload |
| FR25 | Epic 4 | Set video metadata |
| FR26 | Epic 4 | Set thumbnails |
| FR27 | Epic 4 | Schedule publication (2 PM UTC) |
| FR28 | Epic 4 | Verify upload success |
| FR29 | Epic 4 | Twitter/X auto-posting |
| FR30 | Epic 5 | Daily health check (6 AM UTC) |
| FR31 | Epic 5 | Discord webhook alerts |
| FR32 | Epic 5 | Daily digest email |
| FR33 | Epic 5 | Cost per video tracking |
| FR34 | Epic 5 | Incident logging |
| FR35 | Epic 5 | Pipeline status dashboard |
| FR36 | Epic 5 | Manual override for buffer video |
| FR37 | Epic 5 | Buffer video queue |
| FR38 | Epic 5 | Pronunciation dictionary management |
| FR39 | Epic 5 | Cost tracking dashboard |
| FR40 | Epic 5 | Human review queue |
| FR41 | Epic 5 | Topic skip/re-queue |
| FR42 | Epic 5 | Retry with configurable count |
| FR43 | Epic 5 | Fallback to alternate AI models |
| FR44 | Epic 5 | Skip day and alert on exhaustion |
| FR45 | Epic 5 | NOTIFY continues on failures |
| FR46 | Epic 5 | Queue failed topics for next day |

**Coverage: 46/46 FRs (100%)**

## Epic List

### Epic 1: Core Platform Foundation
**Goal:** Establish the development platform with enforced patterns so all subsequent stages can be built correctly.

**User Outcome:** Developer can build pipeline stages with consistent patterns, fallback chains, quality gates, and cost tracking automatically enforced.

**Scope:**
- Turborepo monorepo + pnpm workspace initialization
- `@nexus-ai/core` package (types, providers, errors, utils)
- GCP infrastructure setup (Firestore, Cloud Storage, Secret Manager)
- Provider abstractions (LLM, TTS, Image) with fallback chains
- Utility patterns (`withRetry`, `withFallback`, `executeStage`)
- Quality gate framework
- Cost tracking (`CostTracker`)
- Structured logging infrastructure

**NFRs Addressed:** NFR14-17 (Integration Resilience), NFR23-25 (Security)

**Sprint:** Week 1

---

### Epic 2: Content Intelligence Pipeline
**Goal:** Automatically curate trending AI news and produce high-quality, pronunciation-ready scripts.

**User Outcome:** System autonomously fetches news, ranks by freshness, generates research, produces scripts via multi-agent pipeline, and tags pronunciation for TTS.

**FRs Covered:** FR1-15
- News sourcing from 5 sources (GitHub, HuggingFace, HN, Reddit, arXiv)
- Freshness scoring algorithm
- Topic selection and fallback logic
- Research brief generation
- Multi-agent script generation (Writer → Critic → Optimizer)
- Script validation (word count, quality)
- Pronunciation dictionary and SSML tagging

**NFRs Addressed:** NFR18 (98% pronunciation accuracy), NFR20 (news freshness <24hr), NFR21 (word count validation)

**Sprint:** Week 2

---

### Epic 3: Media Production Pipeline
**Goal:** Transform scripts into professional video content with proper audio and original visuals.

**User Outcome:** Scripts become publish-ready videos with synthesized audio, animated visuals, and A/B thumbnail variants.

**FRs Covered:** FR16-23
- TTS synthesis with fallback chain (Gemini → Chirp → WaveNet)
- Audio chunking and stitching for long scripts
- Visual component matching and scene generation
- Remotion video composition and templates
- Video rendering (1080p @ 30fps)
- AI thumbnail generation (3 A/B variants)
- Template fallbacks for visuals and thumbnails

**NFRs Addressed:** NFR7 (render <45min), NFR19 (100% programmatic visuals), NFR22 (3 thumbnail variants)

**Sprint:** Week 3

---

### Epic 4: Distribution & Publishing
**Goal:** Automatically publish videos to YouTube and promote on social media.

**User Outcome:** Videos are uploaded, scheduled, verified, and announced without manual intervention.

**FRs Covered:** FR24-29
- YouTube Data API resumable upload
- Video metadata (title, description, tags, affiliate links)
- Thumbnail selection and upload
- Scheduled publishing (2 PM UTC)
- Upload verification via API
- Twitter/X auto-posting on publish

**NFRs Addressed:** NFR16 (YouTube quota <80%)

**Sprint:** Week 3

---

### Epic 5: Operations & Autonomous Running
**Goal:** Enable hands-off daily operation with full observability, intervention capability, and graceful failure recovery.

**User Outcome:** Pipeline runs autonomously daily. Operator receives digest emails, can intervene when needed, and system recovers from failures without publishing garbage.

**FRs Covered:** FR30-46
- Pipeline orchestration (Cloud Run + Cloud Scheduler)
- Daily health checks (6 AM UTC)
- Discord/Email alerting
- Daily digest email
- Cost tracking and dashboard
- Incident logging
- Buffer video system
- Human review queue
- Manual override capabilities
- Pronunciation dictionary management CLI
- Error recovery (retry → fallback → skip → alert)
- Failed topic queuing

**NFRs Addressed:** NFR1-5 (Reliability), NFR6-9 (Performance), NFR10-13 (Cost Efficiency)

**Sprint:** Week 4

---

## Epic 1: Core Platform Foundation

**Goal:** Establish the development platform with enforced patterns so all subsequent stages can be built correctly.

### Story 1.1: Initialize Monorepo

As a developer,
I want a properly configured Turborepo monorepo with pnpm workspaces,
So that I can build pipeline stages with shared code and independent deployments.

**Acceptance Criteria:**

**Given** no existing project structure
**When** I run the Turborepo initialization command
**Then** a monorepo is created with the following structure:
- `apps/` directory for deployable applications
- `packages/` directory for shared libraries
- `pnpm-workspace.yaml` configured for workspace packages
- `turbo.json` with build, test, and lint pipelines
- Root `package.json` with workspace scripts
- Shared `tsconfig.base.json` with strict mode enabled
**And** running `pnpm install` succeeds without errors
**And** running `pnpm build` executes Turborepo pipeline
**And** `.nvmrc` specifies Node.js 20.x LTS
**And** `.gitignore` excludes node_modules, dist, .env files

---

### Story 1.2: Create Core Types Package

As a developer,
I want typed contracts for pipeline stages and providers,
So that all stages communicate with consistent, type-safe interfaces.

**Acceptance Criteria:**

**Given** the initialized monorepo from Story 1.1
**When** I create the `@nexus-ai/core` package with types
**Then** the following types are exported from `packages/core/src/types/`:
- `StageInput<T>` with pipelineId, previousStage, data, config, qualityContext
- `StageOutput<T>` with success, data, artifacts, quality, cost, durationMs, provider, warnings
- `StageConfig` with timeout, retries, and stage-specific options
- `QualityMetrics` with stage-specific measurement fields
- `CostBreakdown` with service, tokens, cost, timestamp
- `ArtifactRef` with type, url, size, contentType
- `PipelineState` with stage, status, timestamps, errors
**And** `LLMProvider` interface with generate(), estimateCost() methods
**And** `TTSProvider` interface with synthesize(), getVoices(), estimateCost() methods
**And** `ImageProvider` interface with generate(), estimateCost() methods
**And** all types compile with TypeScript strict mode
**And** package exports from `@nexus-ai/core` are properly configured

---

### Story 1.3: Implement Error Handling Framework

As a developer,
I want a consistent error handling system with severity levels,
So that errors are handled appropriately based on their impact on the pipeline.

**Acceptance Criteria:**

**Given** the core types package from Story 1.2
**When** I implement the error handling framework
**Then** `ErrorSeverity` enum is defined with: RETRYABLE, FALLBACK, DEGRADED, RECOVERABLE, CRITICAL
**And** `NexusError` class extends Error with:
- `code`: string in format `NEXUS_{DOMAIN}_{TYPE}`
- `severity`: ErrorSeverity
- `stage`: optional string
- `retryable`: boolean
- `context`: optional Record<string, unknown>
**And** static factory methods exist:
- `NexusError.retryable(code, message, stage, context?)`
- `NexusError.fallback(code, message, stage, context?)`
- `NexusError.degraded(code, message, stage, context?)`
- `NexusError.recoverable(code, message, stage, context?)`
- `NexusError.critical(code, message, stage, context?)`
- `NexusError.fromError(error, stage)` to wrap unknown errors
**And** error codes follow naming convention (e.g., `NEXUS_TTS_TIMEOUT`, `NEXUS_LLM_RATE_LIMIT`)
**And** unit tests verify all severity levels and factory methods

---

### Story 1.4: Implement Retry and Fallback Utilities

As a developer,
I want retry and fallback utilities for external API calls,
So that transient failures are handled automatically without manual intervention.

**Acceptance Criteria:**

**Given** the error handling framework from Story 1.3
**When** I implement `withRetry` utility
**Then** it accepts an async function and options (maxRetries, baseDelay, maxDelay, stage)
**And** it retries on RETRYABLE errors up to maxRetries times
**And** it uses exponential backoff with jitter between retries
**And** it throws after exhausting retries with attempt count in error context
**And** it logs each retry attempt with delay duration

**Given** the error handling framework from Story 1.3
**When** I implement `withFallback` utility
**Then** it accepts an array of providers and an executor function
**And** it tries providers in order until one succeeds
**And** it returns `{ result, provider, tier, attempts }` on success
**And** `tier` is 'primary' for first provider, 'fallback' for others
**And** it throws CRITICAL error if all providers fail
**And** it logs each fallback attempt with provider name

**And** both utilities are composable: `withRetry(() => withFallback(...))`
**And** unit tests cover success, retry, fallback, and exhaustion scenarios

---

### Story 1.5: Implement Provider Abstraction

As a developer,
I want abstracted provider implementations for LLM, TTS, and Image generation,
So that I can swap providers without changing stage code.

**Acceptance Criteria:**

**Given** retry/fallback utilities from Story 1.4
**When** I implement the provider abstraction layer
**Then** `GeminiLLMProvider` class implements `LLMProvider` interface:
- Constructor accepts model name (e.g., 'gemini-3-pro-preview')
- `generate(prompt, options)` returns `LLMResult` with text, tokens, cost
- `estimateCost(prompt)` returns estimated cost in dollars
- Uses `withRetry` internally for API calls
**And** `GeminiTTSProvider` class implements `TTSProvider` interface:
- Constructor accepts model name (e.g., 'gemini-2.5-pro-tts')
- `synthesize(text, options)` returns `TTSResult` with audioUrl, durationSec, cost
- `getVoices()` returns available voice options
- `estimateCost(text)` returns estimated cost
**And** `GeminiImageProvider` class implements `ImageProvider` interface:
- Constructor accepts model name (e.g., 'gemini-3-pro-image-preview')
- `generate(prompt, options)` returns `ImageResult` with imageUrl, cost
- `estimateCost(prompt)` returns estimated cost
**And** provider registry is defined with primary and fallback chains:
```typescript
providers.llm.primary = GeminiLLMProvider('gemini-3-pro-preview')
providers.llm.fallbacks = [GeminiLLMProvider('gemini-2.5-pro')]
providers.tts.primary = GeminiTTSProvider('gemini-2.5-pro-tts')
providers.tts.fallbacks = [ChirpProvider(), WaveNetProvider()]
```
**And** providers retrieve API keys via `getSecret()` (to be implemented in 1.6)

---

### Story 1.6: Set Up GCP Infrastructure

As a developer,
I want GCP storage and secrets infrastructure configured,
So that pipeline state persists and credentials are securely managed.

**Acceptance Criteria:**

**Given** provider abstraction from Story 1.5
**When** I implement GCP infrastructure clients
**Then** `FirestoreClient` class provides:
- `getDocument(collection, docId)` returns typed document
- `setDocument(collection, docId, data)` creates/updates document
- `updateDocument(collection, docId, updates)` partial update
- `queryDocuments(collection, filters)` returns matching documents
- Connection uses `NEXUS_PROJECT_ID` environment variable
**And** `CloudStorageClient` class provides:
- `uploadFile(bucket, path, content, contentType)` returns public URL
- `downloadFile(bucket, path)` returns file content
- `getSignedUrl(bucket, path, expiration)` returns temporary access URL
- `deleteFile(bucket, path)` removes file
- Default bucket from `NEXUS_BUCKET_NAME` environment variable
**And** `getSecret(secretName)` function:
- Retrieves secret from GCP Secret Manager
- Caches secrets in memory for duration of process
- Secret names follow `nexus-{service}-{purpose}` convention
- Falls back to environment variable `NEXUS_{SECRET_NAME}` for local dev
**And** Firestore document paths follow architecture:
- `pipelines/{YYYY-MM-DD}/state`
- `pronunciation/{term}`
- `topics/{YYYY-MM-DD}`
- `buffer-videos/{id}`
- `incidents/{id}`
**And** Cloud Storage paths follow: `gs://nexus-ai-artifacts/{date}/{stage}/{file}`
**And** integration tests verify connectivity (can be skipped in CI without credentials)

---

### Story 1.7: Implement Structured Logging

As a developer,
I want structured logging with pipeline and stage context,
So that I can debug and monitor pipeline execution effectively.

**Acceptance Criteria:**

**Given** GCP infrastructure from Story 1.6
**When** I implement the structured logger
**Then** `logger` object provides methods: debug, info, warn, error
**And** each log entry includes:
- `timestamp`: ISO 8601 format
- `level`: debug/info/warn/error
- `message`: human-readable message
- `pipelineId`: when in pipeline context (YYYY-MM-DD)
- `stage`: when in stage context
- Additional structured fields passed as second argument
**And** logger name follows convention: `nexus.{package}.{module}`
**And** `logger.child({ pipelineId, stage })` creates scoped logger
**And** logs output as JSON in production, pretty-printed in development
**And** `console.log` is banned via ESLint rule (error on direct usage)
**And** log levels are configurable via `NEXUS_LOG_LEVEL` environment variable

---

### Story 1.8: Implement Cost Tracking

As a developer,
I want to track API costs per stage and per video,
So that I can monitor spending and stay within budget.

**Acceptance Criteria:**

**Given** structured logging from Story 1.7
**When** I implement `CostTracker` class
**Then** constructor accepts `pipelineId` and `stageName`
**And** `recordApiCall(service, tokens, cost)` adds cost entry with timestamp
**And** `getSummary()` returns `CostBreakdown` with:
- Total cost for the stage
- Breakdown by service
- Token counts where applicable
**And** `persist()` saves costs to Firestore at `pipelines/{pipelineId}/costs`
**And** costs are tracked in dollars with 4 decimal precision
**And** static method `CostTracker.getVideoCost(pipelineId)` retrieves total video cost
**And** static method `CostTracker.getDailyCosts(date)` retrieves all costs for date
**And** cost tracking integrates with provider abstraction (providers call tracker)
**And** NFR10 (<$0.50/video) and NFR11 (<$1.50/video) can be verified via costs

---

### Story 1.9: Implement Quality Gate Framework

As a developer,
I want quality gates that validate stage outputs,
So that low-quality content is caught before publishing.

**Acceptance Criteria:**

**Given** cost tracking from Story 1.8
**When** I implement the quality gate framework
**Then** `QualityGate` interface defines:
- `check(stageName, output)` returns `QualityGateResult`
**And** `QualityGateResult` includes:
- `status`: 'PASS' | 'WARN' | 'FAIL'
- `metrics`: stage-specific quality measurements
- `warnings`: array of warning messages
- `reason`: failure reason if status is FAIL
**And** stage-specific gates are defined per architecture:
- `script-gen`: word count 1200-1800
- `tts`: silence <5%, no clipping detection
- `render`: zero frame drops, audio sync <100ms
- `thumbnail`: 3 variants generated
**And** `qualityGate.check(stage, output)` dispatches to correct gate
**And** gates log quality metrics via structured logger
**And** pre-publish gate `qualityGateCheck(pipelineRun)` returns:
- `AUTO_PUBLISH`: no issues
- `AUTO_PUBLISH_WITH_WARNING`: minor issues (≤2, no TTS fallback)
- `HUMAN_REVIEW`: major quality compromises
**And** unit tests verify each gate with passing and failing inputs

---

### Story 1.10: Create Execute Stage Wrapper

As a developer,
I want a unified stage execution wrapper,
So that all stages automatically apply logging, cost tracking, quality gates, and error handling.

**Acceptance Criteria:**

**Given** quality gate framework from Story 1.9
**When** I implement `executeStage` wrapper
**Then** function signature is:
```typescript
executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: { qualityGate?: QualityGateName }
): Promise<StageOutput<TOut>>
```
**And** wrapper automatically:
- Logs stage start with pipelineId and stageName
- Creates CostTracker for the stage
- Wraps execute function with try/catch
- Calls quality gate if specified
- Logs stage complete with duration, provider, cost
- Returns properly formatted `StageOutput<TOut>`
**And** on error, wrapper:
- Logs error with full context
- Wraps error in `NexusError.fromError()` if not already NexusError
- Includes stage name in error
**And** integration test demonstrates wrapper with mock stage:
```typescript
const output = await executeStage(input, 'test-stage', async (data) => {
  return { processed: data.value * 2 };
}, { qualityGate: 'test' });
```
**And** output includes all required fields: success, data, quality, cost, durationMs, provider

---

**Epic 1 Summary:**
- **Stories:** 10
- **NFRs Addressed:** NFR14-17 (Integration Resilience), NFR23-25 (Security)
- **Outcome:** Complete foundation for building pipeline stages with enforced patterns

---

## Epic 2: Content Intelligence Pipeline

**Goal:** Automatically curate trending AI news and produce high-quality, pronunciation-ready scripts.

**FRs Covered:** FR1-15

### Story 2.1: Create News Sourcing Package

As a developer,
I want a news sourcing package with source interfaces,
So that I can add new news sources consistently.

**Acceptance Criteria:**

**Given** the core package from Epic 1
**When** I create the `@nexus-ai/news-sourcing` package
**Then** package structure follows architecture:
- `src/index.ts` exports public API
- `src/types.ts` defines source-specific types
- `src/sources/` directory for individual source implementations
- `src/scoring.ts` for freshness algorithm
- `src/news-sourcing.ts` for main stage logic
**And** `NewsSource` interface is defined with:
- `name`: string identifier
- `fetch()`: returns `NewsItem[]`
- `authorityWeight`: number (source credibility factor)
**And** `NewsItem` type includes:
- `title`: string
- `url`: string
- `source`: string (source name)
- `publishedAt`: Date
- `viralityScore`: number (upvotes, stars, etc.)
- `metadata`: Record<string, unknown>
**And** package compiles and exports from `@nexus-ai/news-sourcing`

---

### Story 2.2: Implement GitHub Trending Source

As a developer,
I want to fetch trending AI/ML repositories from GitHub,
So that new tools and projects are included in news coverage.

**Acceptance Criteria:**

**Given** the news sourcing package from Story 2.1
**When** I implement `GitHubTrendingSource`
**Then** it implements `NewsSource` interface
**And** it fetches trending repositories filtered by:
- Language: Python, TypeScript, Rust (AI-relevant)
- Topics: machine-learning, artificial-intelligence, llm, deep-learning
- Time range: daily trending
**And** it extracts `viralityScore` from star count and today's stars
**And** it sets `authorityWeight` to 0.8 (high credibility)
**And** it handles GitHub API rate limiting with retry logic
**And** it returns maximum 10 items per fetch
**And** unit tests mock GitHub API responses

---

### Story 2.3: Implement HuggingFace Papers Source

As a developer,
I want to fetch daily papers from HuggingFace,
So that new research is included in news coverage.

**Acceptance Criteria:**

**Given** the news sourcing package from Story 2.1
**When** I implement `HuggingFacePapersSource`
**Then** it implements `NewsSource` interface
**And** it fetches from HuggingFace Daily Papers API/page
**And** it extracts `viralityScore` from upvotes and comments
**And** it sets `authorityWeight` to 0.9 (research credibility)
**And** it includes paper abstract in metadata
**And** it links to both HuggingFace page and arXiv source
**And** it returns maximum 10 items per fetch
**And** unit tests mock HuggingFace responses

---

### Story 2.4: Implement Hacker News Source

As a developer,
I want to fetch AI/ML stories from Hacker News front page,
So that trending discussions are included in news coverage.

**Acceptance Criteria:**

**Given** the news sourcing package from Story 2.1
**When** I implement `HackerNewsSource`
**Then** it implements `NewsSource` interface
**And** it fetches from HN API (top stories endpoint)
**And** it filters stories by AI/ML keywords in title or domain
**And** it extracts `viralityScore` from points and comment count
**And** it sets `authorityWeight` to 0.7 (community signal)
**And** it includes comment count and HN discussion URL in metadata
**And** it returns maximum 10 AI/ML relevant items per fetch
**And** unit tests mock HN API responses

---

### Story 2.5: Implement Reddit Source

As a developer,
I want to fetch hot posts from r/MachineLearning,
So that community discussions are included in news coverage.

**Acceptance Criteria:**

**Given** the news sourcing package from Story 2.1
**When** I implement `RedditSource`
**Then** it implements `NewsSource` interface
**And** it fetches from Reddit API for r/MachineLearning hot posts
**And** it filters by flair: [Research], [Project], [News]
**And** it extracts `viralityScore` from upvotes and upvote ratio
**And** it sets `authorityWeight` to 0.6 (community discussion)
**And** it includes flair, comment count, and crosspost info in metadata
**And** it handles Reddit API authentication
**And** it returns maximum 10 items per fetch
**And** unit tests mock Reddit API responses

---

### Story 2.6: Implement arXiv RSS Source

As a developer,
I want to fetch papers from arXiv cs.AI and cs.LG RSS feeds,
So that latest research papers are included in news coverage.

**Acceptance Criteria:**

**Given** the news sourcing package from Story 2.1
**When** I implement `ArxivRSSSource`
**Then** it implements `NewsSource` interface
**And** it fetches from arXiv RSS feeds for cs.AI and cs.LG categories
**And** it parses RSS XML to extract paper metadata
**And** it extracts `viralityScore` based on:
- Twitter/X mentions (via academic API or scraping)
- Citation velocity if available
- Default score based on category popularity
**And** it sets `authorityWeight` to 0.95 (academic source)
**And** it includes abstract, authors, and categories in metadata
**And** it returns maximum 15 items per fetch (higher volume source)
**And** unit tests mock RSS feed responses

---

### Story 2.7: Implement Freshness Scoring

As a developer,
I want to score news items by freshness algorithm,
So that the most relevant and timely news is prioritized.

**Acceptance Criteria:**

**Given** news items from all sources (Stories 2.2-2.6)
**When** I implement the freshness scoring algorithm
**Then** score is calculated as: `(viralityScore × authorityWeight) / hoursSincePublish`
**And** `hoursSincePublish` is clamped to minimum 1 hour (avoid division issues)
**And** items older than 24 hours receive a 0.5x penalty multiplier (NFR20)
**And** items older than 48 hours receive a 0.1x penalty (deep-dive only)
**And** scoring function is: `calculateFreshnessScore(item: NewsItem): number`
**And** items are sorted by freshness score descending
**And** unit tests verify scoring with various age/virality combinations
**And** edge cases handled: missing publishedAt, zero virality

---

### Story 2.8: Implement Topic Selection

As a developer,
I want to select the best topic for daily video,
So that the most newsworthy content is covered.

**Acceptance Criteria:**

**Given** scored news items from Story 2.7
**When** I implement topic selection logic
**Then** `selectTopic(items: NewsItem[])` returns the top-scored item
**And** selection validates minimum viable topics (≥3 candidates) per FR4
**And** if <3 viable topics, fallback to "deep dive" on 48hr topic is triggered
**And** fallback logs warning and selects highest-scored 48hr+ item
**And** selected topic is stored to Firestore at `topics/{YYYY-MM-DD}` per FR5:
- `selected`: the chosen NewsItem
- `candidates`: top 10 candidates with scores
- `selectionTime`: timestamp
- `fallbackUsed`: boolean
**And** `executeNewsSourcing()` stage function orchestrates:
1. Fetch from all sources
2. Score all items
3. Select topic
4. Store selection
5. Return `StageOutput` with selected topic
**And** stage uses `executeStage` wrapper from Epic 1

---

### Story 2.9: Create Research Stage

As a developer,
I want to generate research briefs from selected topics,
So that scripts have comprehensive source material.

**Acceptance Criteria:**

**Given** selected topic from Story 2.8
**When** I implement the research stage
**Then** `@nexus-ai/research` package is created
**And** `executeResearch()` stage function:
- Takes topic URL and metadata as input
- Calls LLM provider with research prompt
- Generates 2,000-word research brief per FR6
- Includes facts, context, implications, key quotes
- Stores brief to Cloud Storage at `{date}/research/research.md`
**And** research prompt includes:
- Topic title and URL
- Source metadata
- Instructions for comprehensive coverage
- Format requirements (sections, bullet points)
**And** stage uses `executeStage` wrapper
**And** stage tracks costs via `CostTracker`
**And** output includes artifact reference to stored brief

---

### Story 2.10: Create Script Generation Stage

As a developer,
I want to generate video scripts via multi-agent pipeline,
So that scripts are high-quality and optimized for video.

**Acceptance Criteria:**

**Given** research brief from Story 2.9
**When** I implement the script generation stage
**Then** `@nexus-ai/script-gen` package is created
**And** multi-agent pipeline executes per FR7:
1. **Writer Agent**: Creates initial 1,200-1,800 word script
2. **Critic Agent**: Reviews for clarity, accuracy, engagement
3. **Optimizer Agent**: Refines based on critique
**And** each agent uses LLM provider with role-specific prompts
**And** script validation checks word count per FR8:
- 1,200-1,800 words required
- If outside range, regenerate with adjusted prompt per FR9
- Maximum 3 regeneration attempts
**And** script includes embedded visual cues per FR10:
- `[VISUAL: neural network animation]`
- `[VISUAL: comparison chart]`
- `[VISUAL: product mockup]`
**And** script includes pronunciation hints per FR10:
- `[PRONOUNCE: Mixtral = "mix-trahl"]`
**And** all script drafts stored to Cloud Storage:
- `{date}/script-drafts/v1-writer.md`
- `{date}/script-drafts/v2-critic.md`
- `{date}/script-drafts/v3-optimizer.md`
- `{date}/script.md` (final)
**And** stage uses `executeStage` wrapper with `script-gen` quality gate
**And** quality gate checks word count (1,200-1,800) per NFR21

---

### Story 2.11: Create Pronunciation Dictionary

As a developer,
I want a pronunciation dictionary with IPA phonemes,
So that technical terms are pronounced correctly.

**Acceptance Criteria:**

**Given** core infrastructure from Epic 1
**When** I implement the pronunciation dictionary
**Then** `@nexus-ai/pronunciation` package is created
**And** dictionary is stored in Firestore at `pronunciation/{term}` per FR11:
- `term`: the word/phrase
- `ipa`: IPA phonetic transcription
- `ssml`: SSML phoneme markup
- `verified`: boolean (human-verified)
- `source`: how term was added (seed, auto, manual)
- `usageCount`: number of times used
- `lastUsed`: timestamp
- `addedDate`: timestamp
**And** seed script populates 200 initial terms including:
- AI researchers: "Yann LeCun", "Geoffrey Hinton", "Fei-Fei Li"
- Model names: "Mixtral", "LLaMA", "GPT", "DALL-E"
- Companies: "Anthropic", "OpenAI", "Hugging Face"
- Technical terms: "transformer", "diffusion", "RLHF"
**And** `getDictionary()` loads all terms into memory cache
**And** `lookupTerm(term)` returns pronunciation or null
**And** `addTerm(term, ipa, ssml)` adds to dictionary per FR14
**And** seed data stored in `data/pronunciation/seed.json`

---

### Story 2.12: Implement Term Extraction and Flagging

As a developer,
I want to extract technical terms and flag unknowns,
So that pronunciation issues are caught before TTS.

**Acceptance Criteria:**

**Given** pronunciation dictionary from Story 2.11
**When** I implement term extraction and flagging
**Then** `extractTerms(script: string)` identifies potential technical terms per FR12:
- Capitalized words not at sentence start
- Known tech patterns (camelCase, acronyms, version numbers)
- Names (proper nouns)
- Model names and product names
**And** `checkPronunciations(terms: string[])` validates against dictionary:
- Returns `{ known: Term[], unknown: string[] }`
**And** flagging logic per FR13:
- If unknown.length > 3, flag for human review
- Create review item in Firestore at `review-queue/{id}`
- Include script context for each unknown term
**And** auto-resolution per FR14:
- After human provides pronunciation, auto-add to dictionary
- Update `source: 'manual'` and `verified: true`
**And** logging tracks extraction stats (terms found, known, unknown)

---

### Story 2.13: Implement SSML Tagging

As a developer,
I want to generate SSML-tagged scripts,
So that TTS pronounces all terms correctly.

**Acceptance Criteria:**

**Given** term extraction from Story 2.12
**When** I implement SSML tagging
**Then** `tagScript(script: string)` returns SSML-marked script per FR15
**And** known terms are wrapped with SSML phoneme tags:
```xml
<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme>
```
**And** pronunciation hints from script `[PRONOUNCE: X = "Y"]` are processed
**And** output preserves script structure (paragraphs, visual cues)
**And** `executePronunciation()` stage function:
1. Extract terms from script
2. Check pronunciations
3. Flag unknowns if threshold exceeded
4. Tag script with SSML
5. Return tagged script and quality metrics
**And** stage uses `executeStage` wrapper
**And** quality metrics include:
- Total terms checked
- Known vs unknown count
- Pronunciation accuracy percentage (NFR18: >98%)
**And** if accuracy <98%, stage returns with DEGRADED quality status

---

**Epic 2 Summary:**
- **Stories:** 13
- **FRs Covered:** FR1-15 (100%)
- **NFRs Addressed:** NFR18 (pronunciation), NFR20 (freshness), NFR21 (word count)
- **Outcome:** Complete content intelligence pipeline from news sourcing to pronunciation-ready scripts

---

## Epic 3: Media Production Pipeline

**Goal:** Transform scripts into professional video content with proper audio and original visuals.

**FRs Covered:** FR16-23

### Story 3.1: Create TTS Package

As a developer,
I want a TTS synthesis stage,
So that scripts are converted to high-quality audio.

**Acceptance Criteria:**

**Given** SSML-tagged script from Epic 2
**When** I create the `@nexus-ai/tts` package
**Then** package structure follows architecture:
- `src/index.ts` exports public API
- `src/types.ts` defines TTS-specific types
- `src/tts.ts` for main stage logic
- `src/audio-quality.ts` for quality checks
- `src/chunker.ts` for script chunking
**And** `executeTTS()` stage function per FR16:
- Takes SSML-tagged script as input
- Uses TTS provider with fallback chain (Gemini → Chirp → WaveNet)
- Synthesizes audio at 44.1kHz WAV format
- Stores audio to Cloud Storage at `{date}/tts/audio.wav`
- Returns `StageOutput` with audio artifact reference
**And** TTS options include:
- Voice selection (configurable)
- Speaking rate (0.9-1.1x normal)
- Pitch adjustment
**And** stage uses `executeStage` wrapper
**And** stage tracks costs via `CostTracker`
**And** provider tier is tracked in output (primary vs fallback)

---

### Story 3.2: Implement Audio Chunking and Stitching

As a developer,
I want to handle long scripts via chunking,
So that TTS API limits don't cause failures.

**Acceptance Criteria:**

**Given** TTS package from Story 3.1
**When** I implement audio chunking and stitching per FR17
**Then** `chunkScript(script: string, maxChars: number)` splits scripts:
- Default maxChars = 5000 (API limit)
- Chunks at sentence boundaries (never mid-sentence)
- Preserves SSML tags across chunks
- Returns array of chunk strings with indices
**And** each chunk is synthesized independently
**And** `stitchAudio(segments: AudioSegment[])` combines:
- Concatenates WAV segments in order
- Adds configurable silence between segments (default: 200ms)
- Normalizes audio levels across segments
- Outputs single WAV file
**And** individual segments stored at `{date}/tts/audio-segments/{index}.wav`
**And** final stitched audio at `{date}/tts/audio.wav`
**And** quality checks per TTS quality gate:
- Silence detection: <5% of total duration
- Clipping detection: no samples at max amplitude
- Duration validation: matches expected from word count
**And** if quality check fails, stage returns DEGRADED status

---

### Story 3.3: Create Visual Generation Package

As a developer,
I want a visual generation package with scene mapping,
So that scripts are converted to visual timelines.

**Acceptance Criteria:**

**Given** script with visual cues from Epic 2
**When** I create the `@nexus-ai/visual-gen` package
**Then** package structure follows architecture:
- `src/index.ts` exports public API
- `src/types.ts` defines visual-specific types
- `src/visual-gen.ts` for main stage logic
- `src/scene-mapper.ts` for cue-to-template mapping
- `src/timeline.ts` for timeline generation
**And** `SceneMapper` class per FR18:
- Parses `[VISUAL: description]` cues from script
- Maps descriptions to Remotion component names
- Uses keyword matching and LLM fallback for ambiguous cues
- Returns `SceneMapping[]` with component, props, duration
**And** visual cue types supported:
- `neural network` → NeuralNetworkAnimation
- `data flow` → DataFlowDiagram
- `comparison` → ComparisonChart
- `metrics` → MetricsCounter
- `product mockup` → ProductMockup
- `code block` → CodeHighlight
- `transition` → BrandedTransition
**And** `generateTimeline()` per FR19:
- Creates scene timeline JSON with timing
- Aligns scenes to audio duration
- Ensures scene change every ~30 seconds (NFR visual coverage)
- Outputs timeline to `{date}/visual-gen/scenes.json`

---

### Story 3.4: Implement Remotion Video Studio

As a developer,
I want a Remotion video composition app,
So that videos are rendered from timelines and audio.

**Acceptance Criteria:**

**Given** visual generation package from Story 3.3
**When** I implement the Remotion video studio
**Then** `apps/video-studio/` is created via `npm create video@latest`
**And** Remotion project structure includes:
- `src/Root.tsx` with composition registration
- `src/compositions/TechExplainer.tsx` main video composition
- `src/components/` with 5-7 visual components per FR18-20
- `src/hooks/` for animation utilities
**And** visual components implemented:
1. `NeuralNetworkAnimation` - animated NN diagram
2. `DataFlowDiagram` - pipeline/flow visualization
3. `ComparisonChart` - side-by-side comparison
4. `MetricsCounter` - animated stat counters
5. `ProductMockup` - generic UI frame
6. `CodeHighlight` - syntax-highlighted code
7. `BrandedTransition` - NEXUS-AI branded wipes
**And** `LowerThird` component for source citations
**And** all components follow NEXUS visual language:
- Consistent color palette (defined in theme)
- Smooth animations (60fps capable)
- Responsive to props (duration, data)
**And** `TechExplainer` composition:
- Accepts timeline JSON and audio URL
- Renders scenes in sequence
- Syncs visuals to audio duration
- Outputs 1920x1080 @ 30fps per FR20
**And** local preview works via `pnpm dev` in video-studio

---

### Story 3.5: Implement Visual Fallbacks

As a developer,
I want fallback visuals when templates are unavailable,
So that videos always render successfully.

**Acceptance Criteria:**

**Given** Remotion components from Story 3.4
**When** I implement visual fallbacks per FR21
**Then** `TextOnGradient` fallback component is created:
- Displays key text from visual cue
- Uses NEXUS brand gradient background
- Animates text entrance/exit
- Works for any visual cue type
**And** scene mapper fallback logic:
- If no template matches cue, use `TextOnGradient`
- Log warning with unmapped cue for future template creation
- Include cue text as component prop
**And** fallback tracking in quality metrics:
- Count of scenes using fallback
- Percentage of fallback usage
- If >30% fallback, flag as DEGRADED quality
**And** `executeVisualGen()` stage function:
1. Parse visual cues from script
2. Map to components (with fallbacks)
3. Generate timeline JSON
4. Store timeline and track quality
5. Return `StageOutput` with timeline artifact

---

### Story 3.6: Create Render Service

As a developer,
I want a dedicated render service,
So that videos are rendered with sufficient resources.

**Acceptance Criteria:**

**Given** Remotion video studio from Story 3.4
**When** I create the render service
**Then** `apps/render-service/` Cloud Run app is created
**And** service configuration per architecture:
- 4 CPU, 8GB RAM allocation
- Timeout: 45 minutes (NFR7)
- Concurrency: 1 (one render at a time)
- Min instances: 0 (scale to zero)
**And** render endpoint `/render` accepts:
- `pipelineId`: string (YYYY-MM-DD)
- `timelineUrl`: Cloud Storage URL to scenes.json
- `audioUrl`: Cloud Storage URL to audio.wav
**And** render process:
1. Download timeline and audio from Cloud Storage
2. Execute Remotion render with timeline data
3. Output MP4 1920x1080 @ 30fps
4. Upload to `{date}/render/video.mp4`
5. Return video URL and duration
**And** render quality gate checks per FR20:
- Zero frame drops
- Audio sync within 100ms
- File size reasonable for duration
**And** render logs progress percentage
**And** health endpoint `/health` for monitoring
**And** Dockerfile configured for Remotion rendering

---

### Story 3.7: Create Thumbnail Package

As a developer,
I want AI-generated thumbnails,
So that videos have engaging click-worthy previews.

**Acceptance Criteria:**

**Given** script and topic from Epic 2
**When** I create the `@nexus-ai/thumbnail` package
**Then** package structure includes:
- `src/index.ts` exports public API
- `src/thumbnail.ts` for main stage logic
- `src/template-fallback.ts` for fallback generation
**And** `executeThumbnail()` stage function per FR22:
- Takes topic title and key visual concept as input
- Uses Image provider (Gemini 3 Pro Image)
- Generates 3 A/B thumbnail variants
- Each variant: 1280x720 PNG
- Stores to `{date}/thumbnails/{1,2,3}.png`
**And** thumbnail prompts include:
- Topic title as text overlay area
- Key visual concept from script
- NEXUS-AI brand elements
- High contrast, YouTube-optimized
**And** thumbnail variations:
- Variant 1: Bold text focus
- Variant 2: Visual concept focus
- Variant 3: Mixed approach
**And** stage tracks costs via `CostTracker`
**And** quality gate verifies 3 variants generated (NFR22)
**And** output includes artifact references to all 3 thumbnails

---

### Story 3.8: Implement Thumbnail Fallbacks

As a developer,
I want template-based thumbnail fallbacks,
So that thumbnails are always generated.

**Acceptance Criteria:**

**Given** thumbnail package from Story 3.7
**When** I implement thumbnail fallbacks per FR23
**Then** `generateTemplateThumbnail(title: string, variant: number)` function:
- Uses pre-designed template images
- Overlays topic title text
- Applies NEXUS-AI branding
- Outputs 1280x720 PNG
**And** template assets stored in `data/templates/thumbnails/`:
- `template-1.png` - Bold text template
- `template-2.png` - Visual focus template
- `template-3.png` - Mixed template
**And** fallback trigger conditions:
- Image provider returns error after retries
- Generated image fails quality check (too dark, wrong size)
- Cost budget exceeded for thumbnails
**And** fallback tracking:
- Log warning when fallback used
- Track in quality metrics as `thumbnailFallback: true`
- If fallback used, flag as DEGRADED (hurts CTR)
**And** `executeThumbnail()` integrates fallback:
1. Try AI generation with retry
2. On failure, generate template thumbnails
3. Always produce 3 variants
4. Return with appropriate quality status

---

**Epic 3 Summary:**
- **Stories:** 8
- **FRs Covered:** FR16-23 (100%)
- **NFRs Addressed:** NFR7 (render time), NFR19 (programmatic visuals), NFR22 (3 thumbnails)
- **Outcome:** Complete media production pipeline from scripts to rendered videos with thumbnails

---

## Epic 4: Distribution & Publishing

**Goal:** Automatically publish videos to YouTube and promote on social media.

**FRs Covered:** FR24-29

### Story 4.1: Create YouTube Package

As a developer,
I want a YouTube upload package with resumable uploads,
So that large video files are uploaded reliably.

**Acceptance Criteria:**

**Given** rendered video from Epic 3
**When** I create the `@nexus-ai/youtube` package
**Then** package structure includes:
- `src/index.ts` exports public API
- `src/types.ts` defines YouTube-specific types
- `src/youtube.ts` for main stage logic
- `src/uploader.ts` for resumable upload implementation
- `src/metadata.ts` for metadata generation
- `src/scheduler.ts` for publish scheduling
**And** YouTube API client is configured:
- Uses OAuth 2.0 credentials from Secret Manager (`nexus-youtube-oauth`)
- Handles token refresh automatically
- Implements quota tracking per NFR16
**And** `uploadVideo()` function per FR24:
- Uses YouTube Data API resumable upload protocol
- Handles upload interruptions with resume capability
- Supports files up to 128GB (YouTube limit)
- Returns upload progress callbacks
- Stores upload session ID for recovery
**And** quota usage is tracked:
- Each upload costs ~1600 quota units
- Daily quota: 10,000 units
- Alert if usage >80% of daily quota (NFR16)
**And** stage uses `executeStage` wrapper
**And** upload errors trigger retry with resume from last byte

---

### Story 4.2: Implement Video Metadata

As a developer,
I want to set video metadata automatically,
So that videos are properly titled and discoverable.

**Acceptance Criteria:**

**Given** YouTube package from Story 4.1
**When** I implement video metadata generation per FR25
**Then** `generateMetadata(topic, script)` returns:
- `title`: Engaging title from topic (max 100 chars)
- `description`: Structured description with sections
- `tags`: Relevant keywords (max 500 chars total)
- `categoryId`: "28" (Science & Technology)
- `defaultLanguage`: "en"
- `madeForKids`: false
**And** description template includes:
```
{hook_summary}

📰 Today's Topics:
{topic_list}

🔗 Links Mentioned:
{source_urls}

💼 Affiliate Links (support the channel):
{affiliate_links}

⏰ Timestamps:
{chapter_markers}

#AI #MachineLearning #TechNews #NEXUSAI
```
**And** affiliate links are loaded from config:
- Tool-specific affiliate URLs
- UTM parameters for tracking
- Disclosure text ("Some links are affiliate links")
**And** chapter markers generated from script sections
**And** metadata stored to Firestore at `pipelines/{date}/youtube`

---

### Story 4.3: Implement Thumbnail Upload

As a developer,
I want to set thumbnails on uploaded videos,
So that videos have custom preview images.

**Acceptance Criteria:**

**Given** YouTube package from Story 4.1 and thumbnails from Epic 3
**When** I implement thumbnail upload per FR26
**Then** `setThumbnail(videoId, thumbnailUrl)` function:
- Downloads thumbnail from Cloud Storage
- Uploads to YouTube via Thumbnails API
- Verifies thumbnail was set successfully
**And** thumbnail selection logic:
- Default: Use variant 1 (bold text)
- A/B testing: Rotate variants across videos
- Track which variant was used in Firestore
**And** thumbnail requirements validated:
- Format: PNG or JPG
- Size: exactly 1280x720
- File size: <2MB
**And** if thumbnail upload fails:
- Retry up to 3 times
- Log warning but don't fail video upload
- YouTube will use auto-generated thumbnail
**And** thumbnail variant tracked in `pipelines/{date}/youtube`:
- `thumbnailVariant`: 1, 2, or 3
- `thumbnailUrl`: Cloud Storage URL used

---

### Story 4.4: Implement Scheduled Publishing

As a developer,
I want to schedule videos for 2 PM UTC publication,
So that videos publish at optimal viewer times.

**Acceptance Criteria:**

**Given** YouTube package with upload and metadata
**When** I implement scheduled publishing per FR27-28
**Then** `scheduleVideo(videoId, publishTime)` function:
- Sets video status to "private" initially
- Schedules publish for specified time
- Default: 14:00 UTC (2 PM UTC)
**And** publish time is configurable:
- Default from config: 14:00 UTC
- Can be overridden per video
- Validates time is in future
**And** upload verification per FR28:
- `verifyUpload(videoId)` checks video status
- Confirms video is in scheduled state
- Verifies metadata was applied correctly
- Verifies thumbnail was set
- Returns verification result
**And** `executeYouTube()` stage function orchestrates:
1. Upload video with resumable upload
2. Set metadata (title, description, tags)
3. Upload thumbnail
4. Schedule publication
5. Verify upload success
6. Return `StageOutput` with videoId, scheduledTime
**And** verification failure triggers alert but doesn't retry upload
**And** YouTube video URL stored: `https://youtube.com/watch?v={videoId}`

---

### Story 4.5: Create Twitter Package

As a developer,
I want to auto-post video links to Twitter/X,
So that videos reach additional audience on social media.

**Acceptance Criteria:**

**Given** published YouTube video from Story 4.4
**When** I create the `@nexus-ai/twitter` package
**Then** package structure includes:
- `src/index.ts` exports public API
- `src/twitter.ts` for main stage logic
**And** Twitter API client is configured:
- Uses OAuth 2.0 credentials from Secret Manager (`nexus-twitter-oauth`)
- Handles rate limiting with backoff
**And** `postTweet(videoUrl, title)` function per FR29:
- Posts tweet with video link and title
- Format: "{title} 🎬\n\nWatch now: {videoUrl}\n\n#AI #MachineLearning"
- Max 280 characters (truncate title if needed)
**And** `executeTwitter()` stage function:
- Takes YouTube video URL and title as input
- Posts tweet on video publish
- Returns tweet URL on success
- Stores tweet URL in Firestore
**And** error handling:
- Twitter failures are RECOVERABLE (not critical)
- Log warning but don't fail pipeline
- Mark as skipped in pipeline state
**And** stage tracks in quality metrics:
- `twitterPosted`: boolean
- `tweetUrl`: URL if successful

---

**Epic 4 Summary:**
- **Stories:** 5
- **FRs Covered:** FR24-29 (100%)
- **NFRs Addressed:** NFR16 (YouTube quota <80%)
- **Outcome:** Complete distribution pipeline from rendered videos to published YouTube content with social promotion

---

## Epic 5: Operations & Autonomous Running

**Goal:** Enable hands-off daily operation with full observability, intervention capability, and graceful failure recovery.

**FRs Covered:** FR30-46

### Story 5.1: Create Orchestrator Service

As a developer,
I want a central orchestrator service,
So that the pipeline runs as a coordinated daily workflow.

**Acceptance Criteria:**

**Given** all stage packages from Epics 1-4
**When** I create the orchestrator service
**Then** `apps/orchestrator/` Cloud Run app is created
**And** service configuration per architecture:
- 1 CPU, 1GB RAM allocation
- Timeout: 4 hours (NFR6 pipeline duration)
- Concurrency: 1 (one pipeline at a time)
- Min instances: 0 (scale to zero)
**And** orchestrator structure includes:
- `src/index.ts` - HTTP server entry point
- `src/pipeline.ts` - pipeline execution logic
- `src/stages.ts` - stage imports and configuration
- `src/state.ts` - pipeline state management
- `src/quality-gate.ts` - pre-publish quality check
- `src/handlers/scheduled.ts` - Cloud Scheduler trigger
- `src/handlers/manual.ts` - manual trigger endpoint
- `src/handlers/health.ts` - health check endpoint
**And** orchestrator imports all stage packages:
- `@nexus-ai/news-sourcing`
- `@nexus-ai/research`
- `@nexus-ai/script-gen`
- `@nexus-ai/pronunciation`
- `@nexus-ai/tts`
- `@nexus-ai/visual-gen`
- `@nexus-ai/thumbnail`
- `@nexus-ai/youtube`
- `@nexus-ai/twitter`
- `@nexus-ai/notifications`
**And** health endpoint `/health` returns service status
**And** Dockerfile configured for Node.js runtime

---

### Story 5.2: Implement Pipeline Execution

As a developer,
I want sequential stage execution with retry and fallback,
So that the pipeline runs reliably with error recovery.

**Acceptance Criteria:**

**Given** orchestrator service from Story 5.1
**When** I implement pipeline execution per FR42-43
**Then** `executePipeline(pipelineId: string)` function:
- Creates pipeline state in Firestore
- Executes stages sequentially in order
- Passes output from each stage to next stage input
- Updates state after each stage completion
**And** stage execution order:
1. news-sourcing → topic
2. research → research brief
3. script-gen → script
4. pronunciation → SSML script
5. tts → audio
6. visual-gen → timeline
7. render (via render-service) → video
8. thumbnail → thumbnails
9. youtube → video ID
10. twitter → tweet (recoverable)
11. notifications → digest sent
**And** retry logic per FR42:
- Each stage retried up to 3 times on RETRYABLE errors
- Exponential backoff between retries
- Retry count tracked in state
**And** fallback logic per FR43:
- Stages use provider fallback chains
- Fallback usage tracked in qualityContext
- Pipeline continues with degraded quality
**And** pipeline state persisted to Firestore:
- `pipelines/{pipelineId}/state`
- Includes: currentStage, status, startTime, stageResults
**And** pipeline can be resumed from last successful stage

---

### Story 5.3: Implement Daily Health Check

As a developer,
I want pre-pipeline health verification,
So that we don't start a pipeline that will fail.

**Acceptance Criteria:**

**Given** orchestrator from Story 5.1
**When** I implement daily health check per FR30, NFR17
**Then** `performHealthCheck()` function runs at 6 AM UTC before pipeline:
- Checks all external API availability
- Verifies GCP services are accessible
- Checks remaining API quotas
- Validates credentials are valid
**And** health checks include:
- Gemini API: test generation call
- YouTube API: quota check
- Twitter API: connection test
- Firestore: read/write test
- Cloud Storage: access test
- Secret Manager: secret retrieval
**And** health check results stored:
- `pipelines/{date}/health`
- Includes: timestamp, checks[], allPassed
**And** if critical service is down:
- Log error with service name
- Send Discord alert (CRITICAL)
- Skip pipeline for the day
- Use buffer video if available
**And** health check completes within 2 minutes
**And** individual check timeouts: 30 seconds per service

---

### Story 5.4: Create Notifications Package

As a developer,
I want Discord and email notifications,
So that the operator stays informed of pipeline status.

**Acceptance Criteria:**

**Given** pipeline execution from Story 5.2
**When** I create the `@nexus-ai/notifications` package
**Then** package structure includes:
- `src/index.ts` exports public API
- `src/discord.ts` for webhook alerts
- `src/email.ts` for digest emails
- `src/digest.ts` for digest generation
**And** Discord alerts per FR31:
- Uses webhook URL from Secret Manager (`nexus-discord-webhook`)
- Alert levels: CRITICAL (red), WARNING (yellow), SUCCESS (green)
- Format: embed with title, description, fields, timestamp
- Sent for: pipeline failures, buffer deployed, quality degraded, milestones
**And** daily digest email per FR32:
- Sent after pipeline completion (success or failure)
- Recipient from config (operator email)
- Uses SendGrid or similar email service
**And** digest content includes:
- Video: title, URL, topic, source
- Pipeline: duration, cost, quality status
- Performance: day-1 views (if available), CTR, thumbnail variant
- Health: buffers remaining, budget remaining, days left in credit
- Alerts: any issues from today's pipeline
- Tomorrow: queued topic preview (if available)
**And** `executeNotifications()` stage function:
- Always runs, even after pipeline failures (NFR4, FR45)
- Sends Discord summary
- Sends digest email
- Returns notification status

---

### Story 5.5: Implement Cost Dashboard

As a developer,
I want cost tracking visibility,
So that the operator can monitor spending.

**Acceptance Criteria:**

**Given** cost tracking from Epic 1
**When** I implement cost dashboard per FR33, FR39
**Then** cost data is queryable:
- `getCostsByDate(date)` returns daily breakdown
- `getCostsByVideo(pipelineId)` returns per-video costs
- `getCostsThisMonth()` returns month-to-date
- `getCostTrend(days)` returns cost trend data
**And** cost breakdown shows:
- Total cost per video
- Cost by stage (news, research, script, tts, render, thumbnail)
- Cost by service (Gemini, TTS, Image)
- Comparison to budget targets (<$0.50 credit, <$1.50 post)
**And** cost alerts triggered:
- WARNING: cost >$0.75/video
- CRITICAL: cost >$1.00/video
- Sent via Discord
**And** budget tracking shows:
- GCP credit remaining (from $300)
- Days of runway remaining
- Projected monthly cost
**And** cost data exposed via operator CLI (Story 5.10)
**And** costs persisted in Firestore at `pipelines/{date}/costs`

---

### Story 5.6: Implement Incident Logging

As a developer,
I want incident capture and storage,
So that failures are documented for analysis.

**Acceptance Criteria:**

**Given** pipeline execution from Story 5.2
**When** I implement incident logging per FR34
**Then** `logIncident(incident: Incident)` function:
- Creates incident record in Firestore
- Assigns unique incident ID
- Timestamps all events
**And** incident record includes:
- `id`: unique identifier
- `date`: pipeline date
- `stage`: which stage failed
- `error`: error message and code
- `severity`: CRITICAL, WARNING, RECOVERABLE
- `startTime`: when incident started
- `endTime`: when resolved (if applicable)
- `duration`: time to resolution
- `resolution`: how it was resolved (retry, fallback, skip, manual)
- `rootCause`: identified cause (API outage, rate limit, etc.)
- `context`: relevant state at time of failure
**And** incidents stored at `incidents/{id}`
**And** incident summary included in daily digest
**And** incident query functions:
- `getIncidentsByDate(date)`
- `getIncidentsByStage(stage)`
- `getOpenIncidents()`
**And** post-mortem template auto-generated for CRITICAL incidents

---

### Story 5.7: Create Buffer Video System

As a developer,
I want emergency buffer videos,
So that we always have content to publish.

**Acceptance Criteria:**

**Given** orchestrator from Story 5.1
**When** I implement buffer video system per FR36-37
**Then** buffer videos stored in Firestore at `buffer-videos/{id}`:
- `id`: unique identifier
- `videoId`: YouTube video ID
- `topic`: evergreen topic covered
- `title`: video title
- `createdDate`: when buffer was created
- `used`: boolean (has it been deployed)
- `usedDate`: when it was deployed (if used)
**And** buffer management functions:
- `createBuffer(topic)` - generates evergreen content
- `getAvailableBuffers()` - returns unused buffers
- `deployBuffer()` - publishes buffer video
- `getBufferCount()` - returns count of available buffers
**And** buffer deployment per FR36:
- Operator can trigger via CLI or API
- Buffer video is scheduled for publication
- Original failed topic queued for next day
- Incident logged for buffer deployment
**And** buffer requirements per NFR5:
- Minimum 1 buffer video maintained
- Alert when buffer count < 2
- Evergreen topics: "Top 5 AI Papers", "AI Tool Roundup", etc.
**And** buffer creation script in `scripts/create-buffer-video.ts`

---

### Story 5.8: Implement Skip and Recovery

As a developer,
I want skip day and queue recovery logic,
So that failures don't cascade to future days.

**Acceptance Criteria:**

**Given** pipeline execution from Story 5.2
**When** I implement skip and recovery per FR44-46
**Then** skip day logic per FR44:
- Triggered when all fallbacks exhausted
- Logs CRITICAL incident
- Sends alert to operator
- Does NOT publish anything (never publish garbage)
- Updates pipeline state to SKIPPED
**And** notify continues per FR45:
- NOTIFY stage always executes
- Even after earlier stage failures
- Sends failure digest with incident details
- Includes what went wrong and what was skipped
**And** queue recovery per FR46:
- Failed topic saved to `queued-topics/{date}`
- Includes original topic, failure reason, retry count
- Next day pipeline checks queue first
- Queued topics get priority over fresh sourcing
- Maximum 2 retry attempts per topic
**And** recovery query functions:
- `getQueuedTopics()` returns pending topics
- `clearQueuedTopic(id)` removes from queue
- `requeueTopic(id)` adds back to queue
**And** operator can manually clear queue via CLI

---

### Story 5.9: Create Human Review Queue

As a developer,
I want a human review queue for flagged items,
So that quality issues get operator attention.

**Acceptance Criteria:**

**Given** flagging from pronunciation and quality gates
**When** I implement human review queue per FR40-41
**Then** review items stored in Firestore at `review-queue/{id}`:
- `id`: unique identifier
- `type`: pronunciation, quality, controversial, other
- `pipelineId`: associated pipeline
- `stage`: which stage flagged it
- `item`: the flagged content (term, script section, etc.)
- `context`: surrounding context
- `createdAt`: timestamp
- `status`: pending, resolved, dismissed
- `resolution`: how it was resolved
- `resolvedAt`: timestamp
- `resolvedBy`: operator identifier
**And** review queue functions:
- `addToReviewQueue(item)` adds flagged item
- `getReviewQueue()` returns pending items
- `resolveReviewItem(id, resolution)` marks resolved
- `dismissReviewItem(id, reason)` dismisses without action
**And** review triggers:
- >3 unknown pronunciation terms
- Script quality gate FAIL
- Controversial topic detection (keyword matching)
- Thumbnail quality issues
**And** topic management per FR41:
- Operator can skip topic (don't cover)
- Operator can re-queue topic for tomorrow
- Operator can approve topic with modifications
**And** review queue exposed via operator CLI

---

### Story 5.10: Create Operator CLI

As a developer,
I want a command-line interface for operations,
So that the operator can manage the pipeline efficiently.

**Acceptance Criteria:**

**Given** all operational functions from previous stories
**When** I create the operator CLI
**Then** `apps/operator-cli/` is created with commands:
**And** `trigger` command:
- `nexus trigger` - manually trigger pipeline
- `nexus trigger --date 2026-01-08` - trigger for specific date
- Shows progress and result
**And** `status` command per FR35:
- `nexus status` - show current pipeline status
- `nexus status --date 2026-01-08` - show specific date
- Displays: stage, progress, duration, quality
**And** `costs` command per FR39:
- `nexus costs` - show today's costs
- `nexus costs --month` - show month-to-date
- `nexus costs --trend 30` - show 30-day trend
**And** `buffer` command:
- `nexus buffer list` - show available buffers
- `nexus buffer deploy` - deploy buffer video
- `nexus buffer create "Topic"` - create new buffer
**And** `pronunciation` command per FR38:
- `nexus pronunciation list` - show dictionary
- `nexus pronunciation add "term" "IPA" "SSML"` - add term
- `nexus pronunciation search "term"` - search dictionary
**And** `review` command:
- `nexus review list` - show pending reviews
- `nexus review resolve {id}` - resolve item
- `nexus review dismiss {id}` - dismiss item
**And** `retry` command:
- `nexus retry {pipelineId}` - retry failed pipeline
- `nexus retry {pipelineId} --from {stage}` - retry from stage
**And** CLI uses structured output (JSON option for scripting)
**And** CLI authenticates via GCP credentials

---

### Story 5.11: Implement Pre-Publish Quality Gate

As a developer,
I want a final quality decision before publishing,
So that we never publish low-quality content.

**Acceptance Criteria:**

**Given** pipeline with all stages complete
**When** I implement pre-publish quality gate per NFR1-5
**Then** `qualityGateCheck(pipelineRun: PipelineRun)` evaluates:
- All stage quality metrics
- Fallback usage across stages
- Degradation flags
- Known issues and warnings
**And** decision outcomes:
- `AUTO_PUBLISH`: No issues, proceed to YouTube
- `AUTO_PUBLISH_WITH_WARNING`: Minor issues (≤2, no TTS fallback)
- `HUMAN_REVIEW`: Major quality compromises, add to review queue
**And** quality criteria:
- TTS fallback used → HUMAN_REVIEW
- >30% visual fallbacks → HUMAN_REVIEW
- Word count outside range → HUMAN_REVIEW
- >3 pronunciation unknowns unresolved → HUMAN_REVIEW
- Thumbnail fallback + visual fallback → HUMAN_REVIEW
- Single minor issue → AUTO_PUBLISH_WITH_WARNING
**And** decision logged:
- `pipelines/{date}/quality-decision`
- Includes: decision, reasons, metrics, timestamp
**And** HUMAN_REVIEW triggers:
- Pipeline pauses before YouTube stage
- Review item created with video preview
- Operator can approve or reject
- Rejection uses buffer video instead

---

### Story 5.12: Configure Cloud Scheduler

As a developer,
I want automatic daily pipeline triggers,
So that videos are produced without manual intervention.

**Acceptance Criteria:**

**Given** orchestrator service deployed
**When** I configure Cloud Scheduler
**Then** scheduler job is created:
- Name: `nexus-daily-pipeline`
- Schedule: `0 6 * * *` (6:00 AM UTC daily)
- Target: orchestrator Cloud Run `/trigger` endpoint
- Timezone: UTC
**And** scheduler configuration in `infrastructure/cloud-scheduler/`:
- `daily-pipeline.json` with job definition
- Terraform config for job creation
**And** scheduler authenticates to Cloud Run:
- Uses service account with invoker role
- OIDC token authentication
**And** scheduler monitoring:
- Job execution logged
- Failure alerts sent to Discord
- Retry policy: 3 attempts with backoff
**And** scheduler can be paused:
- Via GCP Console
- Via `gcloud` CLI
- For maintenance or investigation
**And** manual trigger still works independently of scheduler

---

**Epic 5 Summary:**
- **Stories:** 12
- **FRs Covered:** FR30-46 (100%)
- **NFRs Addressed:** NFR1-5 (Reliability), NFR6-9 (Performance), NFR10-13 (Cost)
- **Outcome:** Complete autonomous operation with monitoring, alerting, recovery, and operator control

---

## Epic 6: Broadcast Quality Video Enhancement

**Goal:** Transform the NEXUS-AI pipeline from static 30-second text slides into cinematic 5-8 minute broadcast-quality videos with kinetic typography, professional audio mixing, and dynamic B-Roll - comparable to Fireship, Vox, and Two Minute Papers.

**User Outcome:** After this epic, videos will have:
- Word-level animation sync (kinetic typography)
- Background music with VAD-based auto-ducking
- Sound effects triggered by content cues
- Code snippets with typing animations
- Browser demo simulations
- Dynamic video duration (5-8 minutes vs fixed 30 seconds)

**Source Document:** `_bmad-output/implementation-artifacts/tech-spec-nexus-video-enhancement-system.md`

**FRs Covered:** FR-E6-1 through FR-E6-19 (Video Enhancement Requirements)

### FR Coverage Map (Epic 6)

| FR | Phase | Description |
|----|-------|-------------|
| FR-E6-1 | Phase 1 | Dual file output (script.md + direction.json) |
| FR-E6-2 | Phase 1 | DirectionDocument schema validation |
| FR-E6-3 | Phase 1 | TTS reads narration only (no stage directions) |
| FR-E6-4 | Phase 2 | Word-level timestamp extraction via Google Cloud STT |
| FR-E6-5 | Phase 2 | Timestamp accuracy <150ms (target 100ms) |
| FR-E6-6 | Phase 2 | Estimated timing fallback on STT failure |
| FR-E6-7 | Phase 2 | Processing time <60s for 5-minute audio |
| FR-E6-8 | Phase 3 | Motion props on all 8 Remotion components |
| FR-E6-9 | Phase 3 | Backward compatibility without motion props |
| FR-E6-10 | Phase 3 | KineticText word-sync animation |
| FR-E6-11 | Phase 3 | Motion presets (subtle/standard/dramatic) |
| FR-E6-12 | Phase 4 | Music ducking (-20dB speech, -12dB silence) |
| FR-E6-13 | Phase 4 | SFX triggers from direction.json cues |
| FR-E6-14 | Phase 4 | Audio levels (voice -6dB peak, no clipping) |
| FR-E6-15 | Phase 5 | Code snippet typing animation + syntax highlighting |
| FR-E6-16 | Phase 5 | Browser demo templates (API, form, dashboard) |
| FR-E6-17 | Phase 5 | B-Roll overlay/fullscreen/PIP modes |
| FR-E6-18 | Phase 6 | Dynamic video duration (5-8 min target) |
| FR-E6-19 | Phase 6 | Scene duration calculated from word timings |

**Coverage: 19/19 FRs (100%)**

### NFRs Addressed (Epic 6)

| NFR | Description |
|-----|-------------|
| NFR-E6-1 | 95% of extracted word times within 100ms of actual |
| NFR-E6-2 | Components render correctly without motion props |
| NFR-E6-3 | Audio mix matches input duration within 1% |
| NFR-E6-4 | Timestamp extraction <60s processing time |

---

### Story 6.1: Define Direction Document Schema

As a developer,
I want a complete DirectionDocument schema separating content from visual direction,
So that TTS receives only narration text and visual layers receive rendering instructions.

**Acceptance Criteria:**

**Given** the existing ScriptGenOutput type
**When** I define the DirectionDocument schema in `packages/script-gen/src/types.ts`
**Then** the following types are exported:
- `DirectionDocument` with version, metadata, segments, globalAudio
- `DirectionSegment` with id, index, type, content, timing, visual, audio
- `SegmentType`: 'intro' | 'hook' | 'explanation' | 'code_demo' | 'comparison' | 'example' | 'transition' | 'recap' | 'outro'
- `MotionConfig` with entrance, emphasis, exit configurations
- `BRollSpec` with code, browser, diagram, animation, static types
- `WordTiming` with word, index, startTime, endTime, duration, segmentId, isEmphasis
- `SFXCue` with trigger, triggerValue, sound, volume
- `EmphasisWord` with word, effect, intensity
**And** `MOTION_PRESETS` constant defines subtle, standard, dramatic presets
**And** timing fields include both estimated (pre-TTS) and actual (post-extraction) values
**And** all types compile with TypeScript strict mode
**And** Zod schemas are created for runtime validation

---

### Story 6.2: Implement Backward Compatibility Layer

As a developer,
I want compatibility utilities for V1 → V2 script output migration,
So that existing pipeline stages continue working during transition.

**Acceptance Criteria:**

**Given** the DirectionDocument schema from Story 6.1
**When** I create `packages/script-gen/src/compatibility.ts`
**Then** the following utilities are exported:
- `isV2Output(output)` type guard returns true if output has version '2.0'
- `getScriptText(output)` returns plain narration text (strips brackets for V1)
- `getDirectionDocument(output, audioDurationSec)` returns DirectionDocument
- `parseLegacyVisualCues(script, audioDurationSec)` converts V1 brackets to DirectionDocument
**And** V1 output format continues working with automatic conversion
**And** downstream stages (pronunciation, tts) use `getScriptText()` for narration
**And** visual-gen stage uses `getDirectionDocument()` for rendering
**And** unit tests verify both V1 and V2 paths work correctly

---

### Story 6.3: Update Script Generation for Dual Output

As a developer,
I want script-gen to produce separate script.md and direction.json files,
So that content and visual direction are cleanly separated.

**Acceptance Criteria:**

**Given** the compatibility layer from Story 6.2
**When** I update `packages/script-gen/src/script-gen.ts`
**Then** multi-agent pipeline produces two outputs:
- `script.md`: Plain narration text (no brackets, no stage directions)
- `direction.json`: Visual/audio blueprint with segment timing
**And** `ScriptGenOutput` includes:
- `version: '2.0'`
- `scriptText`: string (plain narration)
- `scriptUrl`: GCS URL to script.md
- `directionDocument`: DirectionDocument object
- `directionUrl`: GCS URL to direction.json
**And** estimated timing is calculated: `estimatedDurationSec = wordCount / 2.5` (150 WPM)
**And** segment boundaries align with natural paragraph breaks
**And** visual cue extraction moves from inline brackets to direction.json
**And** both artifacts stored to Cloud Storage at `{date}/script-gen/`

---

### Story 6.4: Update TTS to Read Script Only

As a developer,
I want TTS to read only from script.md content,
So that no stage directions or visual cues are spoken aloud.

**Acceptance Criteria:**

**Given** dual output from Story 6.3
**When** I update `packages/tts/src/tts.ts` and `packages/pronunciation/src/pronunciation.ts`
**Then** both stages use `getScriptText(scriptGenOutput)` for input
**And** no bracket patterns `[VISUAL:...]` or `[PRONOUNCE:...]` appear in TTS input
**And** pronunciation stage processes only narration text
**And** SSML tagging applies to narration text only
**And** TTS output includes `audioDurationSec` for downstream timing
**And** existing tests updated to verify clean narration input
**And** integration test confirms no stage directions in synthesized audio

---

### Story 6.5: Create Timestamp Extraction Package

As a developer,
I want a new timestamp-extraction package structure,
So that word-level timing can be extracted from TTS audio.

**Acceptance Criteria:**

**Given** TTS audio output from Epic 3
**When** I create `packages/timestamp-extraction/`
**Then** package structure includes:
- `package.json` with `@nexus-ai/timestamp-extraction` name
- `tsconfig.json` extending base config
- `src/index.ts` exporting public API
- `src/types.ts` with input/output types
- `src/timestamp-extraction.ts` for main stage logic
- `src/fallback.ts` for estimated timing
- `src/quality-gate.ts` for validation
- `src/__tests__/` for unit tests
**And** `TimestampExtractionInput` includes:
- `audioUrl`: GCS URL to TTS audio
- `audioDurationSec`: total audio duration
- `directionDocument`: DirectionDocument with segments
**And** `TimestampExtractionOutput` includes:
- `directionDocument`: enriched with word timings
- `wordTimings`: flat array of all WordTiming objects
- `timingMetadata`: source, confidence, warnings
**And** package compiles and exports correctly

---

### Story 6.6: Implement Google Cloud STT Integration

As a developer,
I want to extract word-level timestamps via Google Cloud Speech-to-Text,
So that animations can sync precisely with spoken words.

**Acceptance Criteria:**

**Given** timestamp-extraction package from Story 6.5
**When** I implement STT integration in `packages/timestamp-extraction/src/timestamp-extraction.ts`
**Then** `executeTimestampExtraction()` stage function:
1. Downloads audio from GCS URL
2. Converts to LINEAR16 format if needed (via wavefile)
3. Calls Google Cloud STT with `enableWordTimeOffsets: true`
4. Parses response into `WordTiming[]` array
5. Maps words to segments by matching text
6. Populates `timing.wordTimings` in each segment
7. Sets `timing.actualStartSec/actualEndSec/actualDurationSec`
8. Sets `timing.timingSource = 'extracted'`
**And** STT configuration uses:
- `encoding: 'LINEAR16'`
- `sampleRateHertz: 24000` (match Gemini TTS)
- `languageCode: 'en-US'`
- `enableWordTimeOffsets: true`
**And** credentials retrieved via `getSecret('nexus-gcp-speech-credentials')`
**And** stage uses `withRetry` for API calls
**And** stage tracks costs via `CostTracker` (batch mode: $0.004/min)

---

### Story 6.7: Implement Estimated Timing Fallback

As a developer,
I want character-weighted timing estimation when STT fails,
So that the pipeline continues with degraded but functional timing.

**Acceptance Criteria:**

**Given** STT integration from Story 6.6
**When** I implement fallback in `packages/timestamp-extraction/src/fallback.ts`
**Then** `estimateWordTimings(segment, segmentStartSec, config)` function:
- Splits segment text into words
- Calculates duration per word proportional to character count
- Adds pauses after punctuation (300ms for `.!?`, 150ms for `,;:`)
- Clamps word duration to min 0.1s, max 1.0s
- Returns `WordTiming[]` with `timingSource: 'estimated'`
**And** fallback triggers when:
- Google Cloud STT API error (timeout, quota, auth)
- STT confidence < 80%
- Word count mismatch > 20%
**And** `applyEstimatedTimings(document, audioDurationSec)` applies to all segments
**And** `timingMetadata.source` set to `'estimated'`
**And** `timingMetadata.warningFlags` includes `['timing-estimated']`
**And** quality gate returns DEGRADED status with fallback flag

---

### Story 6.8: Create Reference Test Audio Files

As a developer,
I want reference audio files with manual word annotations,
So that STT accuracy can be validated against ground truth.

**Acceptance Criteria:**

**Given** timestamp-extraction package
**When** I create test fixtures in `packages/timestamp-extraction/src/__tests__/fixtures/`
**Then** 5 reference audio files are created:
- `test-audio-01.wav` - 30s, normal pace (150 WPM)
- `test-audio-02.wav` - 30s, fast pace (180 WPM)
- `test-audio-03.wav` - 30s, slow pace (120 WPM)
- `test-audio-04.wav` - 60s, mixed pace with pauses
- `test-audio-05.wav` - 60s, technical terms and numbers
**And** each file has corresponding `.annotations.json`:
```json
{
  "words": [
    { "word": "hello", "startMs": 0, "endMs": 450 },
    { "word": "world", "startMs": 500, "endMs": 920 }
  ]
}
```
**And** annotations manually verified for accuracy
**And** test validates 95% of STT extractions within 100ms of annotations

---

### Story 6.9: Implement Timestamp Quality Gate

As a developer,
I want quality validation for extracted timestamps,
So that timing issues are caught before visual rendering.

**Acceptance Criteria:**

**Given** timestamp extraction from Story 6.6
**When** I implement `packages/timestamp-extraction/src/quality-gate.ts`
**Then** quality gate validates:
- `wordCountMatch`: extracted words within 10% of expected (90% threshold)
- `noGaps`: no timing gaps > 500ms between words
- `monotonicTiming`: no overlapping word times (CRITICAL)
- `processingTime`: completes in < 60 seconds
**And** `validateTimestampExtraction(output)` returns:
- `status: 'PASS'` - all checks pass
- `status: 'DEGRADED'` - word count or gap issues
- `status: 'FAIL'` - monotonic timing violation
**And** quality metrics logged with structured logger
**And** DEGRADED status includes specific warning flags

---

### Story 6.10: Register Timestamp Stage in Orchestrator

As a developer,
I want timestamp-extraction registered in the pipeline,
So that it executes between TTS and visual-gen stages.

**Acceptance Criteria:**

**Given** timestamp-extraction package complete
**When** I update `apps/orchestrator/src/stages.ts`
**Then** `stageRegistry` includes `'timestamp-extraction': executeTimestampExtraction`
**And** `stageOrder` array places it after 'tts' and before 'visual-gen':
```typescript
['news-sourcing', 'research', 'script-gen', 'pronunciation', 'tts',
 'timestamp-extraction',  // NEW
 'visual-gen', 'thumbnail', 'youtube', 'twitter', 'notifications']
```
**And** `STAGE_RETRY_CONFIG` includes: `'timestamp-extraction': { maxRetries: 3, baseDelay: 2000 }`
**And** `STAGE_CRITICALITY` includes: `'timestamp-extraction': 'DEGRADED'`
**And** pipeline data flow passes:
- Input: `audioUrl`, `audioDurationSec`, `directionDocument` from TTS
- Output: enriched `directionDocument` with word timings to visual-gen

---

### Story 6.11: Update Pipeline Data Flow for Timestamps

As a developer,
I want the orchestrator to pass timing data through the pipeline,
So that visual-gen receives word-level timestamps.

**Acceptance Criteria:**

**Given** stage registration from Story 6.10
**When** I update `apps/orchestrator/src/pipeline.ts`
**Then** `buildStageInput()` for timestamp-extraction receives:
- `audioUrl` from TTS output
- `audioDurationSec` from TTS output
- `directionDocument` from script-gen output
**And** `buildStageInput()` for visual-gen receives:
- `audioUrl` (pass through)
- `audioDurationSec` (pass through)
- `directionDocument` with enriched word timings
**And** visual-gen uses `timing.actualStartSec` if available, falls back to `timing.estimatedStartSec`
**And** integration test verifies end-to-end data flow

---

### Story 6.12: Add Timestamp Extraction Tests

As a developer,
I want comprehensive tests for timestamp extraction,
So that the stage is reliable and edge cases are handled.

**Acceptance Criteria:**

**Given** timestamp-extraction implementation
**When** I create tests in `packages/timestamp-extraction/src/__tests__/`
**Then** unit tests cover:
- STT response parsing (mock responses)
- Word-to-segment mapping logic
- Estimated timing calculation
- Quality gate validation
- Error handling and fallback triggers
**And** integration tests cover (can be skipped without GCP credentials):
- Real STT API call with test audio
- Accuracy validation against annotations
- Processing time measurement
**And** test coverage > 80% for package
**And** tests run in CI pipeline

---

### Story 6.13: Define MotionConfig Interface

As a developer,
I want a standardized motion configuration interface,
So that all components animate consistently.

**Acceptance Criteria:**

**Given** DirectionDocument schema from Story 6.1
**When** I add motion types to `apps/video-studio/src/types.ts`
**Then** `MotionConfig` interface includes:
- `preset?`: 'subtle' | 'standard' | 'dramatic'
- `entrance`: type, direction, delay, duration, easing, springConfig
- `emphasis`: type, trigger, intensity, duration
- `exit`: type, direction, duration, startBeforeEnd
**And** entrance types: 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none'
**And** emphasis types: 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none'
**And** exit types: 'fade' | 'slide' | 'shrink' | 'blur' | 'none'
**And** `MOTION_PRESETS` constant provides default configs:
- `subtle`: gentle fade entrance, no emphasis, fade exit
- `standard`: slide-up with spring, pulse on word, fade exit
- `dramatic`: pop with bounce, glow on word, shrink exit
**And** types exported from video-studio package

---

### Story 6.14: Create useMotion Hook

As a developer,
I want a shared hook for motion calculations,
So that animation logic is consistent across components.

**Acceptance Criteria:**

**Given** MotionConfig interface from Story 6.13
**When** I create `apps/video-studio/src/hooks/useMotion.ts`
**Then** hook signature is:
```typescript
function useMotion(
  config: MotionConfig | undefined,
  segmentDurationFrames: number
): MotionStyles
```
**And** hook returns:
- `entranceStyle`: { opacity, transform } for entrance animation
- `emphasisStyle`: { filter, transform } for emphasis effect
- `exitStyle`: { opacity, transform } for exit animation
- `isEntering`: boolean (in entrance phase)
- `isExiting`: boolean (in exit phase)
**And** hook uses `useCurrentFrame()` and `useVideoConfig()` internally
**And** hook applies `MOTION_PRESETS` when `config.preset` is set
**And** hook returns neutral styles (opacity: 1, transform: 'none') when config is undefined
**And** entrance uses `spring()` or `interpolate()` based on easing config
**And** exit starts at `segmentDurationFrames - config.exit.startBeforeEnd`

---

### Story 6.15: Update Component Prop Interfaces

As a developer,
I want motion prop added to all component interfaces,
So that components can receive animation configuration.

**Acceptance Criteria:**

**Given** useMotion hook from Story 6.14
**When** I update `apps/video-studio/src/types.ts`
**Then** all 8 component interfaces include `motion?: MotionConfig`:
- `NeuralNetworkAnimationProps`
- `DataFlowDiagramProps`
- `ComparisonChartProps`
- `MetricsCounterProps`
- `ProductMockupProps`
- `CodeHighlightProps`
- `BrandedTransitionProps`
- `LowerThirdProps`
**And** motion prop is optional (backward compatible)
**And** `TextOnGradientProps` (fallback component) also includes motion
**And** types compile with strict mode

---

### Story 6.16: Refactor Components for Motion Support

As a developer,
I want all 8 Remotion components to support motion props,
So that components animate on entrance/exit with backward compatibility.

**Acceptance Criteria:**

**Given** updated interfaces from Story 6.15
**When** I refactor `apps/video-studio/src/components/*.tsx` (8 files)
**Then** each component:
1. Imports `useMotion` hook
2. Calls `useMotion(props.motion, durationInFrames)`
3. Applies `entranceStyle` to container element
4. Applies `emphasisStyle` to key content elements
5. Applies `exitStyle` at segment end
**And** backward compatibility requirements met:
- Component renders correctly when `motion` is undefined
- `useMotion(undefined, ...)` returns neutral styles
- No console warnings when motion prop omitted
- Visual output identical to current behavior without motion
**And** each component has snapshot tests:
- Without motion prop (baseline)
- With `motion: { preset: 'subtle' }`
- With `motion: { preset: 'dramatic' }`

---

### Story 6.17: Create KineticText Component

As a developer,
I want a word-by-word animated text component,
So that narration text animates in sync with speech.

**Acceptance Criteria:**

**Given** word timings from timestamp extraction
**When** I create `apps/video-studio/src/components/KineticText.tsx`
**Then** component props include:
- `text`: string (full text to display)
- `wordTimings`: WordTiming[] (timing for each word)
- `emphasis?`: EmphasisWord[] (words to highlight)
- `emphasisEffect?`: 'scale' | 'glow' | 'underline' | 'color'
- `style?`: TextStyle (font, color, size)
**And** each word:
- Appears at its `wordTiming.startTime` frame
- Uses spring animation for entrance
- Emphasized words get additional animation effect
- Remains visible until segment end
**And** component handles:
- Word wrapping and line breaks
- Variable word counts
- Missing word timings (graceful fallback)
**And** component registered in `COMPONENT_MAP` in TechExplainer
**And** visual tests verify word appearance timing

---

### Story 6.18: Update TechExplainer for Motion and Timing

As a developer,
I want TechExplainer to pass motion config and word timings to components,
So that the composition drives all animations from direction.json.

**Acceptance Criteria:**

**Given** motion-enabled components from Story 6.16
**When** I update `apps/video-studio/src/compositions/TechExplainer.tsx`
**Then** TechExplainerSchema accepts enhanced props:
- `directionDocument`: DirectionDocument (full direction)
- `audioUrl`: string (TTS audio)
**And** scene mapping extracts from direction document:
- `segment.visual.template` → component name
- `segment.visual.motion` → motion config
- `segment.visual.templateProps` → component-specific props
- `segment.timing.wordTimings` → word timing array
- `segment.content.emphasis` → emphasis words
**And** each `<Sequence>` receives:
- `from`: calculated from `timing.actualStartSec` or `timing.estimatedStartSec`
- `durationInFrames`: calculated from timing
**And** component receives all props:
```tsx
<SceneComponent
  {...segment.visual.templateProps}
  motion={segment.visual.motion}
  wordTimings={segment.timing.wordTimings}
  emphasis={segment.content.emphasis}
/>
```
**And** audio track synced via `<Audio src={audioUrl} />`

---

### Story 6.19: Create Audio Mixer Package

As a developer,
I want an audio-mixer package structure,
So that professional audio mixing can be applied to videos.

**Acceptance Criteria:**

**Given** TTS audio from Epic 3
**When** I create `packages/audio-mixer/`
**Then** package structure includes:
- `package.json` with `@nexus-ai/audio-mixer` name
- `tsconfig.json` extending base config
- `src/index.ts` exporting public API
- `src/types.ts` with input/output types
- `src/ducking.ts` for VAD and gain curves
- `src/music-selector.ts` for mood-based selection
- `src/sfx.ts` for sound effect triggers
- `src/quality-gate.ts` for audio validation
- `src/__tests__/` for unit tests
**And** types defined:
- `AudioMixerInput`: voiceTrackUrl, directionDocument, targetDurationSec
- `AudioMixerOutput`: mixedAudioUrl, originalAudioUrl, duckingApplied, metrics
- `MusicTrack`: id, mood, tempo, duration, gcsPath, license
- `SFXTrigger`: segmentId, frame, soundId, volume
**And** package dependencies: `avr-vad`, `ffmpeg-static`

---

### Story 6.20: Implement Voice Activity Detection

As a developer,
I want VAD-based speech detection,
So that music ducking triggers precisely during voice.

**Acceptance Criteria:**

**Given** audio-mixer package from Story 6.19
**When** I implement `packages/audio-mixer/src/ducking.ts`
**Then** `detectSpeechSegments(audioPath)` function:
- Uses `avr-vad` with Silero VAD v5 model
- Analyzes voice track for speech presence
- Returns array of `{ startSec, endSec }` segments
- Handles various audio formats via conversion
**And** `generateDuckingCurve(speechSegments, config)` function:
- Creates time-indexed gain values
- Music level: -20dB during speech, -12dB during silence
- Attack time: 50ms (quick duck)
- Release time: 300ms (gradual return)
- Curve shape: exponential attack, linear release
**And** `DuckingConfig` allows customization:
- `speechLevel`: dB for music during speech (default: -20)
- `silenceLevel`: dB for music during silence (default: -12)
- `attackMs`: attack time in ms (default: 50)
- `releaseMs`: release time in ms (default: 300)

---

### Story 6.21: Implement Music Selection

As a developer,
I want mood-based music track selection,
So that background music matches video tone.

**Acceptance Criteria:**

**Given** audio-mixer package from Story 6.19
**When** I implement `packages/audio-mixer/src/music-selector.ts`
**Then** `loadMusicLibrary()` function:
- Loads library index from `gs://nexus-ai-assets/music/library.json`
- Caches library in memory
- Returns `MusicLibrary` with track array
**And** `selectMusic(criteria, library)` function:
- Filters by mood (required match)
- Filters by duration (>= target or loopable)
- Excludes recently used track (variety)
- Scores candidates by duration fit, energy match, tag match
- Returns highest-scored track or null
**And** `prepareLoopedTrack(track, targetDurationSec)` function:
- Creates seamless loop if track shorter than target
- Uses track's `loopPoints` for clean loop
- Returns path to prepared audio file
**And** mood types: 'energetic' | 'contemplative' | 'urgent' | 'neutral'

---

### Story 6.22: Initialize Music Library

As a developer,
I want a seed music library with tracks per mood,
So that music selection has options from day one.

**Acceptance Criteria:**

**Given** music-selector implementation from Story 6.21
**When** I create music library at `gs://nexus-ai-assets/music/`
**Then** library structure includes:
- `library.json` index file
- `energetic/` folder with 3+ tracks
- `contemplative/` folder with 3+ tracks
- `urgent/` folder with 3+ tracks
- `neutral/` folder with 3+ tracks
**And** each track has metadata in library.json:
- id, filename, mood, energy, tempo (bpm, time signature)
- durationSec, hasLoop, loopPoints
- format, sampleRate, channels, peakDb
- license (type, attribution, restrictions)
- gcsPath, tags, usageCount
**And** all tracks are royalty-free or properly licensed
**And** tracks normalized to consistent levels
**And** upload script in `scripts/upload-music-library.ts`

---

### Story 6.23: Initialize SFX Library

As a developer,
I want a sound effects library organized by category,
So that SFX triggers have audio assets available.

**Acceptance Criteria:**

**Given** audio-mixer package from Story 6.19
**When** I create SFX library at `gs://nexus-ai-assets/sfx/`
**Then** library structure includes:
- `library.json` index file
- `transitions/` folder (whoosh, swoosh, slide)
- `ui/` folder (click, beep, notification)
- `emphasis/` folder (pop, ding, reveal)
- `ambient/` folder (subtle backgrounds)
**And** each SFX has metadata:
- id, filename, category, durationSec
- gcsPath, tags
**And** `loadSFXLibrary()` function loads index
**And** `getSFX(soundId)` returns SFX track path
**And** all SFX are royalty-free or properly licensed
**And** SFX normalized to consistent levels

---

### Story 6.24: Implement Audio Mix Pipeline

As a developer,
I want FFmpeg-based audio mixing with ducking,
So that voice, music, and SFX combine professionally.

**Acceptance Criteria:**

**Given** ducking and music selection from Stories 6.20-6.21
**When** I implement `packages/audio-mixer/src/index.ts`
**Then** `mixAudio(input)` function:
1. Downloads voice track from GCS
2. Selects music based on `directionDocument.globalAudio.defaultMood`
3. Prepares music track (loop if needed)
4. Detects speech segments via VAD
5. Generates ducking curve
6. Extracts SFX triggers from direction document
7. Calls FFmpeg to mix:
   - Voice track at original level
   - Music with ducking curve applied
   - SFX at trigger points
8. Normalizes output (voice peaks at -6dB)
9. Uploads mixed audio to GCS
10. Returns `AudioMixerOutput` with URLs and metrics
**And** FFmpeg called via `ffmpeg-static` with filter complex
**And** output format: WAV 44.1kHz stereo
**And** stage uses `executeStage` wrapper
**And** stage tracks costs via `CostTracker`

---

### Story 6.25: Implement Audio Mixer Quality Gate

As a developer,
I want quality validation for mixed audio,
So that audio issues are caught before rendering.

**Acceptance Criteria:**

**Given** audio mix pipeline from Story 6.24
**When** I implement `packages/audio-mixer/src/quality-gate.ts`
**Then** quality gate validates:
- `durationMatch`: output within 1% of input duration (CRITICAL)
- `noClipping`: peak < -0.5dB (headroom check)
- `voiceLevels`: voice peaks between -9dB and -3dB
- `musicDucking`: music < -18dB during speech
**And** `validateAudioMix(output, input)` returns:
- `status: 'PASS'` - all checks pass
- `status: 'DEGRADED'` - clipping or level issues
- `status: 'FAIL'` - duration mismatch
**And** metrics include:
- `peakDb`: overall peak level
- `voicePeakDb`: voice track peak
- `musicDuckLevel`: average music level during speech
- `durationDiffPercent`: duration difference percentage

---

### Story 6.26: Integrate Audio Mixer into Visual-Gen

As a developer,
I want audio mixing called before rendering,
So that videos use professionally mixed audio.

**Acceptance Criteria:**

**Given** audio-mixer package complete
**When** I update `packages/visual-gen/src/visual-gen.ts`
**Then** `executeVisualGen()` integrates audio mixing:
1. Check if mixing enabled (config flag)
2. If enabled, call `mixAudio()` with voice track and direction
3. Store `mixedAudioUrl` in output
4. Pass `finalAudioUrl` (mixed or original) to render service
**And** `VisualGenOutput` includes:
- `originalAudioUrl`: pass-through TTS audio
- `mixedAudioUrl`: mixed audio (if enabled)
- `finalAudioUrl`: the one used for render
**And** fallback logic: if mixing fails, use original TTS audio
**And** quality status reflects mixing outcome
**And** costs include audio mixing costs

---

### Story 6.27: Create B-Roll Engine Package

As a developer,
I want a broll-engine package structure,
So that synthetic B-Roll can be generated from direction.

**Acceptance Criteria:**

**Given** direction document with B-Roll specs
**When** I create `packages/broll-engine/`
**Then** package structure includes:
- `package.json` with `@nexus-ai/broll-engine` name
- `tsconfig.json` extending base config
- `src/index.ts` exporting public API
- `src/types.ts` with B-Roll types
- `src/code-renderer.ts` for code snippets
- `src/browser-demo.ts` for browser simulations
- `src/__tests__/` for unit tests
**And** types from DirectionDocument `BRollSpec` are used:
- `type`: 'code' | 'browser' | 'diagram' | 'animation' | 'static'
- Type-specific configs (code, browser, diagram, etc.)
- Common props: overlay, position, startOffset, duration

---

### Story 6.28: Implement Code Snippet Renderer

As a developer,
I want code snippets with typing animation,
So that code demos show character-by-character reveal.

**Acceptance Criteria:**

**Given** broll-engine package from Story 6.27
**When** I implement `packages/broll-engine/src/code-renderer.ts`
**Then** `generateCodeSnippetProps(config, durationFrames)` function:
- Takes `BRollSpec.code` configuration
- Calculates typing progress based on frame and speed
- Returns props for CodeHighlight component:
  - `code`: full code string
  - `language`: syntax highlighting language
  - `visibleChars`: characters to show at current frame
  - `highlightLines`: lines to emphasize
  - `showCursor`: boolean (blinking cursor)
  - `theme`: 'dark' | 'light'
**And** typing speed configurable (default: 30 chars/sec)
**And** line highlighting animates in sequence
**And** cursor blinks at end of visible text

---

### Story 6.29: Update CodeHighlight for Typing Effect

As a developer,
I want CodeHighlight component to support typing animation,
So that code appears progressively during narration.

**Acceptance Criteria:**

**Given** code renderer from Story 6.28
**When** I update `apps/video-studio/src/components/CodeHighlight.tsx`
**Then** component props include:
- `typingEffect?: boolean` (enable typing mode)
- `typingSpeed?: number` (chars per second)
- `visibleChars?: number` (override for manual control)
**And** when `typingEffect: true`:
- Component calculates visible chars from frame and speed
- Only visible portion of code is rendered
- Blinking cursor appears at end
- Syntax highlighting applies to visible code only
**And** when `typingEffect: false` (default):
- Full code displayed immediately (backward compatible)
**And** component tests verify both modes

---

### Story 6.30: Implement Browser Demo Templates

As a developer,
I want simulated browser interaction sequences,
So that UI demonstrations can be shown without real recordings.

**Acceptance Criteria:**

**Given** broll-engine package from Story 6.27
**When** I implement `packages/broll-engine/src/browser-demo.ts`
**Then** `generateBrowserDemoProps(config, durationFrames)` function:
- Takes `BRollSpec.browser` configuration
- Processes action sequence with timing
- Returns props for BrowserFrame component
**And** pre-defined templates available:
- `'api-request'`: Shows request/response cycle
- `'form-submit'`: Form fill and submit animation
- `'dashboard'`: Dashboard with updating metrics
- `'custom'`: User-defined actions
**And** `BrowserAction` types supported:
- `click`: cursor moves, click ripple
- `type`: text appears character by character
- `scroll`: content scrolls smoothly
- `highlight`: element gets highlight box
- `wait`: pause between actions

---

### Story 6.31: Create BrowserFrame Component

As a developer,
I want a browser simulation component,
So that B-Roll can show realistic browser interactions.

**Acceptance Criteria:**

**Given** browser demo templates from Story 6.30
**When** I create `apps/video-studio/src/components/BrowserFrame.tsx`
**Then** component props include:
- `url`: string (displayed in address bar)
- `content`: React.ReactNode (page content)
- `actions?: BrowserAction[]` (interaction sequence)
- `viewport?: { width, height }` (browser size)
- `style?`: BrowserStyle (chrome appearance)
**And** component renders:
- Chrome-style browser chrome (tabs, address bar, buttons)
- Content area with page content
- Animated cursor following actions
- Click ripples on click actions
- Scroll animation for scroll actions
**And** component registered in `COMPONENT_MAP`
**And** visual tests verify browser chrome appearance

---

### Story 6.32: Update TimelineJSON for Dynamic Duration

As a developer,
I want timeline to support variable video duration,
So that videos scale from 30 seconds to 5-8 minutes.

**Acceptance Criteria:**

**Given** visual-gen package from Epic 3
**When** I update `packages/visual-gen/src/types.ts`
**Then** `TimelineJSON` includes:
- `audioDurationSec`: actual TTS duration (drives total length)
- `totalDurationFrames`: calculated from audio at FPS
- `targetDuration?`: hint ('30s' | '1min' | '5min' | '8min' | 'auto')
**And** scene duration calculation updated:
- If word timings available: use `actualEndSec - actualStartSec`
- If estimated only: use `estimatedEndSec - estimatedStartSec`
- Add padding for entrance/exit animations
**And** total video duration = `audioDurationSec` (audio drives length)

---

### Story 6.33: Update Scene Duration Calculation

As a developer,
I want scene durations calculated from word timings,
So that visuals align precisely with narration.

**Acceptance Criteria:**

**Given** updated TimelineJSON from Story 6.32
**When** I update `packages/visual-gen/src/timeline.ts`
**Then** `generateTimeline(directionDocument)` function:
- Iterates through segments
- For each segment, calculates duration:
  - If `timing.wordTimings` exists: last word endTime - first word startTime
  - Else: `timing.actualDurationSec` or `timing.estimatedDurationSec`
- Adds entrance buffer (15 frames) before first word
- Adds exit buffer (15 frames) after last word
- Converts seconds to frames: `Math.round(seconds * fps)`
**And** scene overlap handling:
- Exit animation can overlap with next entrance
- Crossfade transitions between scenes
**And** timeline validation:
- Total scene durations ≈ audio duration (within 1 second)
- No gaps between scenes
- No excessive overlaps (max 30 frames)

---

### Story 6.34: Update Remotion Composition for Dynamic Duration

As a developer,
I want Remotion composition duration set from timeline,
So that video length matches audio content.

**Acceptance Criteria:**

**Given** scene duration calculation from Story 6.33
**When** I update `apps/video-studio/src/Root.tsx`
**Then** `TechExplainer` composition:
- `durationInFrames` calculated from `timeline.totalDurationFrames`
- Or calculated from `Math.ceil(audioDurationSec * fps)` if not in timeline
**And** composition registration uses calculated duration:
```typescript
<Composition
  id="TechExplainer"
  component={TechExplainer}
  durationInFrames={calculateDuration(props)}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={defaultProps}
  calculateMetadata={({ props }) => ({
    durationInFrames: Math.ceil(props.audioDurationSec * 30)
  })}
/>
```
**And** `calculateMetadata` enables dynamic duration per render
**And** local preview uses default 5-minute duration for development
**And** render service passes actual duration from timeline

---

**Epic 6 Summary:**
- **Stories:** 34
- **FRs Covered:** FR-E6-1 through FR-E6-19 (100%)
- **NFRs Addressed:** NFR-E6-1 through NFR-E6-4
- **Outcome:** Complete broadcast-quality video enhancement with kinetic typography, professional audio, and dynamic B-Roll

