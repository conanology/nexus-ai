---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/product-brief-youtube-automation-2026-01-07.md"
  - "_bmad-output/analysis/brainstorming-session-2026-01-07.md"
workflowType: 'architecture'
lastStep: 8
workflowComplete: true
completedAt: '2026-01-07'
project_name: 'youtube-automation'
user_name: 'Conan'
date: '2026-01-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (46 total):**

| Category | FR Range | Count | Purpose |
|----------|----------|-------|---------|
| News Intelligence | FR1-5 | 5 | Multi-source fetching, freshness scoring, topic selection |
| Content Generation | FR6-10 | 5 | Research briefs, multi-agent scripts, validation |
| Pronunciation & Voice | FR11-17 | 7 | IPA dictionary, SSML markup, TTS synthesis |
| Visual Production | FR18-23 | 6 | Remotion templates, AI thumbnails, rendering |
| YouTube Publishing | FR24-29 | 6 | Upload, metadata, scheduling, verification |
| Monitoring & Alerting | FR30-35 | 6 | Health checks, Discord/email alerts, cost tracking |
| Operator Management | FR36-41 | 6 | Manual overrides, buffer videos, review queues |
| Error Recovery | FR42-46 | 5 | Retries, fallbacks, skip logic, queue management |

**Non-Functional Requirements (25 total):**

| Category | NFR Range | Key Targets |
|----------|-----------|-------------|
| Reliability | NFR1-5 | 100% daily publish, 5hr buffer, auto-fallback |
| Performance | NFR6-9 | <4hr pipeline, <45min render, <1min alerts |
| Cost Efficiency | NFR10-13 | <$0.50/video (credit), <$1.50 (post-credit) |
| Integration Resilience | NFR14-17 | 3 retries, configurable timeouts, 80% quota |
| Quality Assurance | NFR18-22 | 98% pronunciation, 100% original visuals |
| Security | NFR23-25 | Encrypted secrets, credential rotation, audit logs |

**Scale & Complexity:**

- Primary domain: Backend Automation Pipeline
- Complexity level: Medium-High
- Estimated architectural components: 12-15 services/modules
- Integration points: 8+ external APIs
- Deployment target: GCP (Cloud Run + Cloud Functions + Firestore)

### Technical Constraints & Dependencies

**Infrastructure:**
- GCP ecosystem required (Cloud Run, Functions, Firestore, Secret Manager)
- $300 GCP credit budget (90-day runway)
- Target: <$50/month operating cost

**External APIs:**

| Service | Purpose | Fallback |
|---------|---------|----------|
| Gemini 3 Pro | Script generation, research | Gemini 2.5 Pro |
| Gemini 3 Pro Image | Thumbnail generation | Template thumbnails |
| Gemini 2.5 Pro TTS | Voice synthesis (primary) | Chirp 3 HD → WaveNet |
| YouTube Data API | Upload, scheduling | Manual queue |
| Twitter/X API | Social promotion | Skip (non-critical) |

**TTS Strategy (Quality Priority):**
- **Primary:** `gemini-2.5-pro-tts` - Best quality Google TTS (GA Sept 2025)
  - 30 speakers, 80+ locales
  - Natural language control for style, accent, pace, emotion
  - Multi-speaker synthesis support
  - Regions: global, us, eu
- **Fallback 1:** Chirp 3 HD voices (quota issues)
- **Fallback 2:** WaveNet (last resort)
- **Rationale:** Voice quality directly impacts viewer retention - every second of audio matters

**Tech Stack (from PRD):**
- Video: Remotion 4.x (React-based composition)
- Runtime: Node.js / TypeScript (implied by Remotion)
- Storage: Firestore for state, Cloud Storage for assets

### Cross-Cutting Concerns Identified

1. **Fault Tolerance**: Every stage needs retry → fallback → skip → alert chain
2. **Cost Observability**: Track API costs per-stage, per-video, aggregate
3. **Audit Trail**: Log all decisions, failures, human interventions
4. **API Abstraction**: LLM and TTS providers must be swappable
5. **Human Checkpoints**: Queue system for flagged content requiring review
6. **State Management**: Pipeline state persistence for recovery/restart

## Starter Template Evaluation

### Primary Technology Domain

Backend Automation Pipeline - A 10-stage autonomous video production system requiring multi-service architecture with shared code foundations.

### Starter Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| Remotion CLI (`npm create video@latest`) | Scaffolds video-only project | Too narrow - only handles Stage 6-8 |
| Single Cloud Run TypeScript | One service, src/dist structure | Doesn't scale for 10+ deployable stages |
| **Turborepo + pnpm Monorepo** | Multi-package workspace | ✅ Best fit - shared code, independent deploys |

### Selected Starter: Turborepo Monorepo

**Rationale for Selection:**
- Pipeline stages need shared types (PipelineState, TopicData, ScriptOutput, etc.)
- Each stage can deploy independently as Cloud Function
- Remotion requires isolated build environment
- Shared utilities prevent code duplication (retry logic, cost tracking, API clients)
- Turborepo caching accelerates development iterations

**Initialization Command:**

```bash
pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm
```

**Architectural Decisions Provided by Starter:**

| Category | Decision |
|----------|----------|
| **Package Manager** | pnpm (workspace-aware, fast, disk-efficient) |
| **Build Orchestration** | Turborepo (parallel builds, caching, task pipeline) |
| **Language** | TypeScript (strict mode, shared tsconfig) |
| **Linting** | ESLint + Prettier (shared config package) |
| **Testing** | Vitest (fast, TypeScript-native) |

**Project Structure:**

```
nexus-ai/
├── apps/
│   ├── orchestrator/      # Cloud Run - daily pipeline controller
│   └── video-studio/      # Remotion 4.x video generation
├── packages/
│   ├── core/              # Shared types, logging, errors
│   ├── stages/            # Pipeline stage implementations
│   │   ├── news-sourcing/
│   │   ├── research/
│   │   ├── script-gen/
│   │   ├── pronunciation/
│   │   ├── tts/
│   │   ├── visual-gen/
│   │   ├── thumbnail/
│   │   ├── youtube/
│   │   └── notifications/
│   └── config/            # Shared tsconfig, eslint
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Note:** After initialization, add Remotion to `apps/video-studio/` with `npm create video@latest`.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Pipeline Orchestration Pattern - Central Orchestrator
2. Stage Deployment Model - Hybrid (Cloud Run + Functions)
3. State & Data Persistence - Firestore + Cloud Storage
4. External API Client Pattern - Provider Abstraction with fallbacks
5. Error Handling Strategy - Quality-aware with DEGRADED level
6. Monitoring & Alerting - GCP-native stack

**Deferred Decisions (Post-MVP):**
- Custom Grafana dashboard (Month 3)
- ElevenLabs TTS integration (Month 3)
- Multi-platform expansion (Month 4+)

### 1. Pipeline Orchestration: Central Orchestrator

**Decision:** Single Cloud Run orchestrator service coordinates all pipeline stages sequentially.

**Rationale:**
- Pipeline is inherently sequential (no parallelism benefit from Pub/Sub)
- Single video/day doesn't need event-driven scale
- One place to see state, logs, failures for debugging
- Orchestrator holds pipeline state in memory, persists to Firestore at checkpoints

**Architecture:**
- Cloud Run "orchestrator" triggered daily at 6 AM UTC via Cloud Scheduler
- Imports each stage package, calls sequentially
- Each stage returns result or throws typed error
- Handles retry logic, fallback chains, state persistence
- On failure: log → retry → fallback → skip → alert → continue or abort

**Future Migration:** If scaling to 5+ videos/day, consider Cloud Workflows or Pub/Sub.

### 2. Stage Deployment Model: Hybrid

**Decision:** Right-size resources per stage for quality optimization.

| Stage | Deploy To | Resources | Reason |
|-------|-----------|-----------|--------|
| Orchestrator | Cloud Run | 1 CPU, 1GB | Coordination, state |
| News Sourcing | Cloud Function | Default | Light API calls |
| Research | Cloud Function | Default | Gemini API call |
| Script Generation | Cloud Function | Default | API calls |
| Pronunciation Check | Cloud Function | Default | Dictionary lookup |
| TTS Synthesis | Cloud Run | 2 CPU, 4GB | Quality, no timeout |
| Visual Generation | Cloud Run | 2 CPU, 4GB | Scene composition |
| Video Render | Cloud Run | 4 CPU, 8GB | Remotion needs power |
| Thumbnail | Cloud Function | Default | Gemini Image API |
| YouTube Upload | Cloud Function | Default | API call |
| Twitter Post | Cloud Function | Default | API call |
| Notifications | Cloud Function | Default | Webhook calls |

**Rationale:** Quality > simplicity. Audio/video quality directly impacts viewer retention.

### 3. State & Data Persistence

**Decision:** Firestore for state/metadata, Cloud Storage for artifacts.

**Firestore Structure:**
```
pipelines/{YYYY-MM-DD}/
├── state: {stage, status, startTime, topic, errors[]}
├── artifacts: {researchUrl, scriptUrl, audioUrl, videoUrl...}
├── costs: {gemini, tts, render, total}
├── quality: {pronunciationFlags, scriptWordCount, audioLengthSec,
│             videoDurationSec, thumbnailVariants, ttsModel, ttsVoice}
└── youtube: {videoId, publishedAt, thumbnailSelected, day1Views, day7Views}

pronunciation/{term}/
└── {ipa, ssml, verified, source, usageCount, lastUsed, addedDate}

topics/{YYYY-MM-DD}/
└── {selected, candidates[], selectionTime}

buffer-videos/{id}/
└── {videoId, topic, createdDate, used}

incidents/{id}/
└── {date, stage, error, resolution, duration}
```

**Cloud Storage Structure:**
```
nexus-ai-artifacts/
├── {date}/
│   ├── research.md
│   ├── script.md
│   ├── script-drafts/{v1-writer, v2-critic, v3-optimizer}.md
│   ├── audio.wav
│   ├── audio-segments/
│   ├── scenes.json
│   ├── thumbnails/{1,2,3}.png
│   └── video.mp4
└── templates/{backgrounds, fonts, animations}/
```

### 4. External API Client Pattern: Provider Abstraction

**Decision:** Interface-based abstraction with fallback chains and quality tracking.

**Core Interfaces:**
```typescript
interface TTSProvider {
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  getVoices(): Promise<Voice[]>;
  estimateCost(text: string): number;
}

interface LLMProvider {
  generate(prompt: string, options: LLMOptions): Promise<LLMResult>;
}

// Results include quality tracking
interface TTSResult {
  audioUrl: string;
  durationSec: number;
  cost: number;
  model: string;
  quality: 'primary' | 'fallback';
}
```

**Provider Registry:**
```typescript
const providers = {
  llm: {
    primary: GeminiProvider('gemini-3-pro-preview'),
    fallbacks: [GeminiProvider('gemini-2.5-pro')]
  },
  tts: {
    primary: GeminiTTSProvider('gemini-2.5-pro-tts'),
    fallbacks: [ChirpProvider('chirp3-hd'), WaveNetProvider()]
  },
  image: {
    primary: GeminiImageProvider('gemini-3-pro-image-preview'),
    fallbacks: [TemplateThumbnailer()]
  }
};
```

**Benefits:** Centralized fallback logic, cost tracking hooks, easy Month 3 provider additions.

### 5. Error Handling: Quality-Aware Strategy

**Decision:** Four-tier error severity with quality gate before publish.

**Error Severity Levels:**
```typescript
enum ErrorSeverity {
  RETRYABLE,    // Transient: timeout, rate limit, 503
  FALLBACK,     // Provider issue: use next in chain
  DEGRADED,     // Can continue but quality compromised
  RECOVERABLE,  // Stage failed, pipeline continues
  CRITICAL      // Must abort: no recovery possible
}
```

**Stage Criticality:**

| Stage | Criticality | Rationale |
|-------|-------------|-----------|
| news-sourcing | CRITICAL | No topic = no video |
| research | CRITICAL | Foundation for script |
| script-gen | CRITICAL | Core content |
| pronunciation | DEGRADED | Quality issue if skipped |
| tts | CRITICAL | No audio = no video |
| visual-gen | DEGRADED | Simple fallback available |
| thumbnail | DEGRADED | Template OK but hurts CTR |
| render | CRITICAL | No video = no video |
| upload | CRITICAL | Must publish |
| twitter | RECOVERABLE | Nice to have |
| notify | RECOVERABLE | Nice to have |

**Quality Gate (Pre-Publish):**
```typescript
function qualityGateCheck(run: PipelineRun): QualityDecision {
  // AUTO_PUBLISH: No issues
  // AUTO_PUBLISH_WITH_WARNING: Minor issues (≤2, no TTS fallback)
  // HUMAN_REVIEW: Major quality compromises
}
```

**Core Principle:** NEVER publish low-quality content. Skip day > bad video.

### 6. Monitoring & Alerting: GCP-Native Stack

**Decision:** Cloud Logging + Cloud Monitoring + Discord/Email alerts.

**Metrics Tracked:**
- Pipeline: duration, success/failure counts, stage timing
- Cost: per-video, by-service breakdown, daily total
- Quality: pronunciation flags, fallbacks used, degraded runs
- YouTube: day-1 views, CTR, retention (pulled daily)
- Health: buffer count, API quota remaining

**Alert Rules:**

| Trigger | Severity | Channels |
|---------|----------|----------|
| Pipeline failed, no buffer | CRITICAL | Discord + Email |
| Buffer deployed | WARNING | Discord |
| Quality degraded | WARNING | Discord |
| Buffer < 2 | WARNING | Discord + Email |
| Cost > $0.75/video | WARNING | Discord |
| Cost > $1.00/video | CRITICAL | Email |
| YouTube CTR < 3% | WARNING | Discord |
| Milestone achieved | SUCCESS | Discord |

**Daily Digest (Email):**
- Video: title, URL, topic, source
- Pipeline: duration, cost, quality status
- Performance: day-1 views, CTR, thumbnail variant
- Health: buffers, budget remaining, days left
- Alerts: any issues from today

**Milestone Tracking:** Subscribers (100→100K), videos (10→365), revenue ($1→$3K), views (1K→1M).

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo setup (Turborepo + pnpm)
2. Core package (types, providers, errors, logging)
3. Firestore/GCS infrastructure
4. Individual stage packages
5. Orchestrator service
6. Remotion video-studio app
7. Cloud deployment (Run + Functions)
8. Alerting/monitoring setup

**Cross-Component Dependencies:**
- All stages depend on `packages/core` for providers, errors, types
- Orchestrator imports all stage packages
- Stages share Firestore client and GCS bucket references
- Provider abstraction enables Month 3 TTS upgrade with zero stage changes

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Addressed

20+ areas where AI agents could make different choices, now standardized.

### Naming Patterns

**TypeScript Naming:**

| Element | Convention | Example |
|---------|------------|---------|
| Interfaces | PascalCase, no prefix | `UserData`, `StageOutput` |
| Types | PascalCase, no suffix | `User`, `Pipeline` |
| Enums | PascalCase | `ErrorSeverity` |
| Functions | camelCase | `getUserData`, `withRetry` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `user-data.ts`, `with-fallback.ts` |

**Firestore Naming:**

| Element | Convention | Example |
|---------|------------|---------|
| Collections | lowercase plural | `pipelines`, `pronunciations` |
| Document fields | camelCase | `startTime`, `videoUrl` |

**Package Naming:**

| Element | Convention | Example |
|---------|------------|---------|
| Scope | `@nexus-ai/` | `@nexus-ai/core` |
| Package names | kebab-case | `news-sourcing`, `script-gen` |

**Infrastructure Naming:**

| Element | Convention | Example |
|---------|------------|---------|
| Environment vars | `NEXUS_` + SCREAMING_SNAKE | `NEXUS_GEMINI_API_KEY` |
| GCS buckets | `nexus-ai-{purpose}` | `nexus-ai-artifacts` |
| GCS paths | `{date}/{stage}/{file}` | `2026-01-08/tts/audio.wav` |
| Secrets | `nexus-{service}-{purpose}` | `nexus-youtube-oauth` |
| Logger names | `nexus.{package}.{module}` | `nexus.tts.synthesis` |
| Error classes | `{Domain}Error` | `RenderError` |
| Error codes | `NEXUS_{DOMAIN}_{TYPE}` | `NEXUS_TTS_TIMEOUT` |

### Structure Patterns

**Test Organization:**
- Unit tests: Co-located (`src/tts.test.ts`)
- Integration tests: Separate (`tests/integration.test.ts`)

**Stage Package Structure:**
```
packages/{stage}/
├── src/
│   ├── index.ts           # Public exports
│   ├── types.ts           # Stage-specific types
│   ├── {stage}.ts         # Main logic
│   ├── {stage}.test.ts    # Co-located unit test
│   └── utils/             # Stage utilities
├── tests/
│   └── integration.test.ts
└── package.json
```

**Core Package Structure:**
```
packages/core/src/
├── types/                 # Shared types
│   ├── pipeline.ts        # PipelineState, StageInput/Output
│   ├── providers.ts       # Provider interfaces
│   ├── quality.ts         # QualityMetrics, QualityGate
│   └── errors.ts          # Error types
├── providers/             # Provider implementations
│   ├── llm/               # Gemini LLM providers
│   ├── tts/               # TTS providers (Gemini, Chirp, WaveNet)
│   └── image/             # Image generation providers
├── errors/                # Error classes
├── observability/         # Metrics, alerts, cost tracking
├── storage/               # Firestore + Cloud Storage clients
├── quality/               # Quality gates per stage
└── utils/                 # Retry, SSML, dates
```

**Apps Structure:**
```
apps/
├── orchestrator/          # Cloud Run - pipeline coordination
├── video-studio/          # Remotion project
└── render-service/        # Cloud Run - dedicated rendering
```

### Format Patterns

**Stage Input/Output:**
```typescript
interface StageInput<T> {
  pipelineId: string;        // YYYY-MM-DD
  previousStage: string | null;
  data: T;
  config: StageConfig;
  qualityContext?: {         // Track degradation history
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
}

interface StageOutput<T> {
  success: boolean;
  data: T;
  artifacts?: ArtifactRef[];
  quality: QualityMetrics;
  cost: CostBreakdown;
  durationMs: number;
  provider: {
    name: string;
    tier: 'primary' | 'fallback';
    attempts: number;
  };
  warnings?: string[];
}
```

**Error Format:**
```typescript
class NexusError extends Error {
  code: string;              // NEXUS_TTS_TIMEOUT
  severity: ErrorSeverity;
  stage?: string;
  retryable: boolean;
  context?: Record<string, unknown>;

  // Factory methods
  static retryable(code, message, stage, context?);
  static critical(code, message, stage, context?);
  static degraded(code, message, stage, context?);
}
```

**Date/Time:**
- Pipeline IDs: `YYYY-MM-DD` (e.g., `2026-01-08`)
- Timestamps: ISO 8601 UTC (e.g., `2026-01-08T06:00:00.000Z`)
- Publish time: Always 14:00 UTC

### Process Patterns

**Retry Pattern:**
- Exponential backoff with configurable base/max delay
- Quality-aware retries (retry if output quality poor)
- Per-service retry configuration
- Track attempts and quality retries separately

**Stage Execution Pattern:**
```typescript
async function executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: {
    validateOutput?: (output: TOut) => ValidationResult;
    qualityGate?: (output: TOut) => QualityGateResult;
  }
): Promise<StageOutput<TOut>>;
```

Every stage: validate input → execute with retry → validate output → quality gate → return.

**Fallback Pattern:**
- Try providers in order
- Log fallback usage
- Track which provider succeeded
- Mark output as `tier: 'fallback'`

**Quality Gates (Per-Stage):**

| Stage | Quality Checks |
|-------|----------------|
| script-gen | Word count 1200-1800 |
| tts | Silence <5%, no clipping |
| render | Zero frame drops, audio sync <100ms |
| thumbnail | 3 variants generated |

**Logging Pattern:**
- `onStageStart`: Log pipeline ID, stage, input size
- `onStageComplete`: Log duration, cost, provider, quality tier
- `onQualityDegraded`: Warn with issues list
- `onError`: Error with full context
- `onMilestone`: Celebrate achievements

### Enforcement Guidelines

**All AI Agents MUST:**
1. Use `@nexus-ai/core` types for all stage inputs/outputs
2. Follow naming conventions exactly (no exceptions)
3. Implement quality gates for their stage
4. Use `withRetry` wrapper for all external API calls
5. Log stage start/complete using `loggingPattern`
6. Track costs via `CostTracker`
7. Return `provider.tier` indicating primary/fallback

**Pattern Verification:**
- TypeScript strict mode catches type mismatches
- ESLint rules enforce naming conventions
- Integration tests verify stage contracts
- Quality gates catch degraded outputs

### Pattern Examples

**Good: Stage Implementation**
```typescript
export async function executeTTS(
  input: StageInput<TTSInput>
): Promise<StageOutput<TTSOutput>> {
  return executeStage(input, 'tts', async (data, config) => {
    const { result, provider, tier } = await withFallback(
      [geminiTTS, chirpHD, wavenet],
      (p) => p.synthesize(data.script, data.options),
      { stage: 'tts' }
    );
    return result;
  }, {
    qualityGate: QUALITY_GATES['tts']
  });
}
```

**Anti-Patterns:**
- ❌ Direct API calls without `withRetry`
- ❌ Missing `provider.tier` in output
- ❌ Not tracking costs
- ❌ snake_case in TypeScript (except constants)
- ❌ Skipping quality gate checks
- ❌ Not logging stage start/complete

## Project Structure & Boundaries

### Complete Project Directory Structure

```
nexus-ai/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json
├── Makefile
├── docker-compose.yml
├── .env.example
├── .env.local.example
├── .gitignore
├── .nvmrc
│
├── .github/workflows/
│   ├── ci.yml
│   ├── deploy-orchestrator.yml
│   ├── deploy-functions.yml
│   └── deploy-render.yml
│
├── scripts/
│   ├── setup-gcp.sh
│   ├── deploy.sh
│   ├── seed-pronunciation.ts
│   └── create-buffer-video.ts
│
├── apps/
│   ├── orchestrator/              # Cloud Run - pipeline controller
│   │   └── src/
│   │       ├── index.ts
│   │       ├── pipeline.ts
│   │       ├── stages.ts
│   │       ├── quality-gate.ts
│   │       ├── state.ts
│   │       └── handlers/{scheduled,manual,health}.ts
│   │
│   ├── video-studio/              # Remotion project
│   │   └── src/
│   │       ├── Root.tsx
│   │       ├── compositions/TechExplainer.tsx
│   │       ├── components/{AnimatedText,CodeBlock,NeuralNetwork,...}.tsx
│   │       └── hooks/
│   │
│   ├── render-service/            # Cloud Run - rendering
│   │   └── src/{index,render}.ts
│   │
│   └── operator-cli/              # CLI for operations
│       └── src/commands/{trigger,status,retry,buffer,pronunciation,costs}.ts
│
├── packages/
│   ├── core/                      # Shared infrastructure
│   │   └── src/
│   │       ├── types/{pipeline,providers,quality,errors}.ts
│   │       ├── providers/{llm,tts,image}/
│   │       ├── errors/base.ts
│   │       ├── observability/{logger,metrics,alerts,cost-tracker}.ts
│   │       ├── storage/{firestore,cloud-storage}.ts
│   │       ├── quality/gates.ts
│   │       └── utils/{retry,execute-stage,ssml,dates}.ts
│   │
│   ├── news-sourcing/             # Stage 1
│   │   └── src/{news-sourcing,sources/*,scoring}.ts
│   │
│   ├── research/                  # Stage 2
│   │   └── src/{research}.ts
│   │
│   ├── script-gen/                # Stage 3
│   │   └── src/{script-gen,agents/*,validation}.ts
│   │
│   ├── pronunciation/             # Stage 4
│   │   └── src/{pronunciation,dictionary,extractor,ssml-tagger}.ts
│   │
│   ├── tts/                       # Stage 5
│   │   └── src/{tts,audio-quality,chunker}.ts
│   │
│   ├── visual-gen/                # Stage 6
│   │   └── src/{visual-gen,scene-mapper,timeline}.ts
│   │
│   ├── thumbnail/                 # Stage 7
│   │   └── src/{thumbnail,template-fallback}.ts
│   │
│   ├── youtube/                   # Stage 9
│   │   └── src/{youtube,uploader,metadata,scheduler}.ts
│   │
│   ├── twitter/                   # Stage 10a
│   │   └── src/{twitter}.ts
│   │
│   ├── notifications/             # Stage 10b
│   │   └── src/{notifications,discord,email,digest}.ts
│   │
│   ├── buffer/                    # Buffer management
│   │   └── src/{buffer,selector}.ts
│   │
│   └── config/                    # Shared config
│       ├── tsconfig/{base,node,react}.json
│       └── eslint/index.js
│
├── infrastructure/
│   ├── terraform/{main,variables,outputs}.tf
│   └── cloud-scheduler/daily-pipeline.json
│
├── data/
│   ├── pronunciation/seed.json
│   ├── templates/{backgrounds,transitions,lower-thirds}/
│   └── prompts/{research,writer,critic,optimizer,thumbnail}.md
│
└── docs/
    ├── architecture.md
    ├── deployment.md
    ├── operations.md
    ├── troubleshooting.md
    └── runbooks/{pipeline-failure,budget-exceeded,quality-degradation}.md
```

### Architectural Boundaries

**Service Boundaries:**

| Service | Deployment | Resources | Responsibility |
|---------|------------|-----------|----------------|
| Orchestrator | Cloud Run | 1 CPU, 1GB | Pipeline coordination, state |
| Render Service | Cloud Run | 4 CPU, 8GB | Video rendering |
| TTS Service | Cloud Run | 2 CPU, 4GB | Audio synthesis |
| Visual Gen | Cloud Run | 2 CPU, 4GB | Scene composition |
| Stage Functions | Cloud Functions | Default | Light API operations |

**Package Boundaries:**

| Package | Exports | Depends On |
|---------|---------|------------|
| `@nexus-ai/core` | Types, providers, errors, utils | None (root) |
| `@nexus-ai/news-sourcing` | `executeNewsSourcing()` | `@nexus-ai/core` |
| `@nexus-ai/script-gen` | `executeScriptGen()` | `@nexus-ai/core` |
| All stage packages | `execute{Stage}()` | `@nexus-ai/core` only |

**Data Boundaries:**

| Store | Purpose | Access Pattern |
|-------|---------|----------------|
| Firestore | Pipeline state, pronunciation, incidents | Read/write from all stages |
| Cloud Storage | Artifacts (audio, video, thumbnails) | Write from stages, read from render |
| Secret Manager | API keys, OAuth tokens | Read-only from services |

### Requirements to Structure Mapping

| PRD Section | FR Range | Primary Package | Secondary |
|-------------|----------|-----------------|-----------|
| News Intelligence | FR1-5 | `news-sourcing` | `core/storage` |
| Content Generation | FR6-10 | `research`, `script-gen` | - |
| Pronunciation & Voice | FR11-17 | `pronunciation`, `tts` | - |
| Visual Production | FR18-23 | `visual-gen`, `thumbnail` | `video-studio` |
| YouTube Publishing | FR24-29 | `youtube` | `twitter` |
| Monitoring | FR30-35 | `core/observability` | `notifications` |
| Operator Management | FR36-41 | `orchestrator`, `operator-cli` | `buffer` |
| Error Recovery | FR42-46 | `core/errors`, `core/utils` | - |

### Integration Points

**External Integrations:**

| External Service | Package | Auth Method |
|------------------|---------|-------------|
| Gemini API | `core/providers/llm` | API Key (Secret Manager) |
| Gemini TTS | `core/providers/tts` | API Key |
| Gemini Image | `core/providers/image` | API Key |
| YouTube API | `youtube` | OAuth 2.0 |
| Twitter API | `twitter` | OAuth 2.0 |
| Discord | `notifications` | Webhook URL |

**Data Flow:**
```
Cloud Scheduler (6 AM UTC)
    ↓
Orchestrator → News → Research → Script → Pronunciation
    ↓
TTS → Visual Gen → Render → Thumbnail → YouTube → Twitter → Notify
    ↓
Firestore (state) + Cloud Storage (artifacts)
```

### Development Workflow

**Local Development:**
```bash
docker-compose up -d    # Start emulators
pnpm install && pnpm dev
```

**Operations:**
```bash
make trigger            # Manual pipeline
make status             # Check pipeline
make costs              # View costs
make add-term TERM="Mixtral" IPA="mɪkˈstrɑːl"
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices (Turborepo, pnpm, TypeScript, Remotion, GCP) are fully compatible with no conflicts.

**Pattern Consistency:** Naming conventions, structure patterns, format patterns, and process patterns are internally consistent and aligned with technology choices.

**Structure Alignment:** Project structure supports all architectural decisions with clear separation between apps, packages, and infrastructure.

### Requirements Coverage Validation ✅

**Functional Requirements:** 46/46 FRs fully covered by package structure and architectural decisions.

**Non-Functional Requirements:** 25/25 NFRs addressed through:
- Reliability: Buffer system, fallback chains, quality gates
- Performance: Hybrid deployment with right-sized resources
- Cost Efficiency: Per-stage cost tracking, budget alerts
- Integration Resilience: Provider abstraction, retry patterns
- Quality: Quality-aware retries, pre-publish gates
- Security: Secret Manager, service accounts

### Implementation Readiness Validation ✅

**Decision Completeness:** All critical decisions documented with specific technology versions and deployment configurations.

**Pattern Completeness:** 20+ potential conflict points addressed with naming conventions, execution patterns, and enforcement guidelines.

**Structure Completeness:** Full directory tree with FR→package mapping and integration point documentation.

### Gap Analysis Results

**Critical Gaps:** None

**Minor Gaps (Implementation Phase):**
- Remotion composition specifics
- Initial pronunciation dictionary seed data
- Cloud Scheduler cron configuration
- YouTube OAuth credential setup

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed (46 FRs, 25 NFRs)
- [x] Scale assessed (Medium-High, 10-stage pipeline)
- [x] Technical constraints identified ($300 GCP budget)
- [x] Cross-cutting concerns mapped (6 concerns)

**✅ Architectural Decisions**
- [x] 6 core decisions documented
- [x] Technology stack specified with versions
- [x] Integration patterns defined (provider abstraction)
- [x] Performance considerations addressed (hybrid deployment)

**✅ Implementation Patterns**
- [x] Naming conventions established (20+ rules)
- [x] Structure patterns defined (stage, core packages)
- [x] Communication patterns specified (StageInput/Output)
- [x] Process patterns documented (retry, fallback, quality gates)

**✅ Project Structure**
- [x] Complete directory structure (4 apps, 12 packages)
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
1. Quality-first design with gates at every stage
2. Provider abstraction enables Month 3 upgrades without code changes
3. Comprehensive error handling with DEGRADED severity for quality tracking
4. Cost observability built-in from Day 1
5. Buffer system ensures "never publish garbage" principle
6. Operator CLI enables manual intervention when needed

**Areas for Future Enhancement:**
1. Custom Grafana dashboard (Month 3)
2. ElevenLabs TTS integration (Month 3)
3. Multi-platform expansion (Month 4+)
4. Revenue optimization engine (Month 6)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use `@nexus-ai/core` types for all stage inputs/outputs
- Implement quality gates for each stage
- Use `withRetry` and `withFallback` wrappers for all external calls
- Track costs via `CostTracker`
- Log stage start/complete using `loggingPattern`

**First Implementation Priority:**
```bash
pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm
cd nexus-ai
# Add Remotion to apps/video-studio
npm create video@latest apps/video-studio
```

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-07
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 6 core architectural decisions made
- 20+ implementation patterns defined
- 16 architectural components specified (4 apps, 12 packages)
- 71 requirements fully supported (46 FRs + 25 NFRs)

**AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Development Sequence

1. Initialize project: `pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm`
2. Add Remotion: `npm create video@latest apps/video-studio`
3. Set up `packages/core` with types, providers, errors, utils
4. Implement stage packages following `StageInput/StageOutput` contract
5. Build orchestrator with pipeline coordination
6. Deploy to GCP (Cloud Run + Cloud Functions)
7. Configure Cloud Scheduler for daily 6 AM UTC trigger

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All 46 functional requirements are supported
- [x] All 25 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Create epics and stories, then begin implementation following this architecture.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

