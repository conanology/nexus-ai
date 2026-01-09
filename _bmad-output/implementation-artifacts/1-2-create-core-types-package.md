# Story 1.2: Create Core Types Package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want typed contracts for pipeline stages and providers,
So that all stages communicate with consistent, type-safe interfaces.

## Acceptance Criteria

**Given** the initialized monorepo from Story 1.1
**When** I create the `@nexus-ai/core` package with types
**Then** the following types are exported from `packages/core/src/types/`:

### Core Pipeline Types
- `StageInput<T>` with pipelineId, previousStage, data, config, qualityContext
- `StageOutput<T>` with success, data, artifacts, quality, cost, durationMs, provider, warnings
- `StageConfig` with timeout, retries, and stage-specific options
- `QualityMetrics` with stage-specific measurement fields
- `CostBreakdown` with service, tokens, cost, timestamp
- `ArtifactRef` with type, url, size, contentType
- `PipelineState` with stage, status, timestamps, errors

### Provider Interfaces
**And** `LLMProvider` interface with generate(), estimateCost() methods
**And** `TTSProvider` interface with synthesize(), getVoices(), estimateCost() methods
**And** `ImageProvider` interface with generate(), estimateCost() methods

### Validation
**And** all types compile with TypeScript strict mode
**And** package exports from `@nexus-ai/core` are properly configured

## Tasks / Subtasks

- [x] Set up @nexus-ai/core package structure (AC: Package configuration)
  - [x] Create packages/core directory
  - [x] Configure package.json with @nexus-ai/core scope
  - [x] Configure tsconfig.json with strict mode
  - [x] Set up proper exports in package.json

- [x] Implement core pipeline types (AC: Core Pipeline Types)
  - [x] Create types/pipeline.ts with StageInput<T>
  - [x] Create StageOutput<T> interface
  - [x] Create StageConfig interface
  - [x] Create PipelineState interface
  - [x] Create ArtifactRef interface

- [x] Implement provider interfaces (AC: Provider Interfaces)
  - [x] Create types/providers.ts with LLMProvider interface
  - [x] Create TTSProvider interface
  - [x] Create ImageProvider interface
  - [x] Create CostBreakdown type
  - [x] Define provider result types (LLMResult, TTSResult, ImageResult)

- [x] Implement quality types (AC: Quality tracking)
  - [x] Create types/quality.ts with QualityMetrics interface
  - [x] Define stage-specific quality metrics (Script, TTS, Render, Thumbnail)
  - [x] Create QualityGateResult interface

- [x] Configure package exports and validation (AC: Validation)
  - [x] Set up barrel exports in types/index.ts
  - [x] Verify TypeScript strict mode compilation
  - [x] Create basic unit tests for type validation
  - [x] Test package imports from other packages

## Dev Notes

### Relevant Architecture Patterns

**Package Structure Requirements:**
- Location: `packages/core/src/types/`
- Must use TypeScript strict mode
- All types must be exported via barrel pattern
- Package scope: `@nexus-ai/core`

**Type System Requirements:**
- Generic types must use proper constraints
- No `any` types allowed
- All enums should use const enum where applicable
- Provider interfaces must match future implementation patterns

**Stage I/O Contract Pattern:**
All 10 pipeline stages will use StageInput/StageOutput:
1. news-sourcing → topic selection
2. research → research brief
3. script-gen → script (1200-1800 words)
4. pronunciation → SSML-tagged script
5. tts → synthesized audio
6. visual-gen → scene timeline JSON
7. render → rendered video (via render-service)
8. thumbnail → 3 thumbnail variants
9. youtube → uploaded video
10. notifications → digest sent

### Technical Requirements (from Architecture)

**StageInput<T> Must Include:**
- `pipelineId`: YYYY-MM-DD format (e.g., "2026-01-08")
- `previousStage`: Name of prior stage (for continuity tracking)
- `data`: Generic type T for stage-specific input
- `config`: Stage configuration (timeout, retries)
- `qualityContext`: Optional tracking of degradations/fallbacks

**StageOutput<T> Must Include:**
- `success`: Boolean execution status
- `data`: Generic type T for stage-specific output
- `artifacts`: Array of ArtifactRef (GCS paths)
- `quality`: QualityMetrics from quality gate
- `cost`: CostBreakdown from CostTracker
- `durationMs`: Performance tracking
- `provider`: { name, tier, attempts } for fallback tracking
- `warnings`: Optional quality/operational warnings

**Provider Interface Requirements:**
- All providers must have `estimateCost()` for budget tracking
- LLM providers must track tokens (input/output)
- TTS providers must support SSML input (from pronunciation stage)
- Image providers must support batch generation (3 thumbnail variants)
- All methods return typed results with cost information

**Cost Tracking Requirements:**
- NFR10: <$0.50/video during credit period
- NFR11: <$1.50/video post-credit
- NFR13: Real-time tracking within $0.01 accuracy
- CostBreakdown must support 4 decimal precision (e.g., 0.0023)

**Quality Gate Integration:**
- Script: word count 1200-1800 (NFR21)
- TTS: silence <5%, no clipping
- Render: zero frame drops, audio sync <100ms (NFR7)
- Thumbnail: exactly 3 variants (NFR22)
- Pronunciation: >98% accuracy (NFR18)

### Project Structure Notes

**Type Module Organization:**
```
packages/core/src/
├── types/
│   ├── index.ts              # Barrel exports
│   ├── pipeline.ts           # StageInput, StageOutput, PipelineState
│   ├── providers.ts          # LLM, TTS, Image interfaces
│   ├── quality.ts            # QualityMetrics, QualityGateResult
│   └── errors.ts             # ErrorSeverity (stub for Story 1.3)
├── index.ts                  # Main package export
└── package.json
```

**Package.json Exports Configuration:**
```json
{
  "exports": {
    "./types": "./dist/types/index.js",
    "./providers": "./dist/providers/index.js"
  }
}
```

**Naming Conventions (from Architecture):**
- Interfaces: PascalCase (e.g., `StageOutput`, `TTSProvider`)
- Types: PascalCase (e.g., `CostBreakdown`)
- Enums: PascalCase (e.g., `ErrorSeverity`)
- Files: kebab-case (e.g., `stage-input.ts`)
- Functions: camelCase (e.g., `estimateCost`)
- Constants: SCREAMING_SNAKE (e.g., `MAX_RETRIES`)

### Learnings from Story 1.1

**Monorepo Setup Patterns:**
- Use pnpm workspaces for package management
- Packages use `@nexus-ai/` scope
- Shared tsconfig.base.json with strict mode
- Turborepo for build pipeline orchestration

**Build Configuration:**
- TypeScript target: ES2022
- Module: ESNext
- Strict mode: enabled
- All packages must compile before being usable

**Testing Approach:**
- Use Vitest for unit tests
- Test type compilation with actual imports
- Validate package exports work across workspace

### Provider Fallback Chains (Future Context)

**LLM Chain:**
1. Primary: gemini-3-pro-preview
2. Fallback: gemini-2.5-pro

**TTS Chain:**
1. Primary: gemini-2.5-pro-tts (30 speakers, natural control)
2. Fallback 1: chirp3-hd
3. Fallback 2: wavenet

**Image Chain:**
1. Primary: gemini-3-pro-image-preview
2. Fallback: Template thumbnails (Story 3.8)

All provider implementations will consume these interfaces (Story 1.5).

### References

- [Epic 1: Story 1.2 Acceptance Criteria](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/epics.md#story-12-create-core-types-package)
- [Architecture: Provider Abstraction Requirements](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#provider-abstraction-requirements)
- [Architecture: Stage Input/Output Contracts](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#pattern-enforcement-requirements)
- [Project Context: Stage Execution Template](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/project-context.md#stage-execution-template)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No debugging required - implementation completed without errors.

### Completion Notes List

✅ **Package Structure Created**
- Created `packages/core` directory with proper structure
- Configured `package.json` with @nexus-ai/core scope (v0.1.0)
- Updated exports to support both main entry and types subpath
- TypeScript strict mode enabled via inherited tsconfig.base.json

✅ **Core Pipeline Types Implemented** (packages/core/src/types/pipeline.ts)
- `StageInput<T>` - Generic input interface with pipelineId, previousStage, data, config, qualityContext
- `StageOutput<T>` - Generic output interface with success, data, artifacts, quality, cost, provider tracking
- `StageConfig` - Configuration interface with timeout, retries, maxConcurrency
- `ArtifactRef` - GCS artifact reference with type, url, size, contentType
- `PipelineState` - Firestore state tracking with status, timestamps, errors, qualityContext
- `QualityContext` - Degradation tracking through pipeline stages
- `ProviderInfo` - Provider execution metadata (name, tier, attempts)

✅ **Provider Interfaces Implemented** (packages/core/src/types/providers.ts)
- `LLMProvider` interface with generate() and estimateCost() methods
- `TTSProvider` interface with synthesize(), getVoices(), estimateCost() methods
- `ImageProvider` interface with generate() and estimateCost() methods
- `CostBreakdown` - 4 decimal precision cost tracking (e.g., $0.0023)
- Provider result types: LLMResult, TTSResult, ImageResult with cost and quality tier tracking
- Options interfaces: LLMOptions, TTSOptions, ImageOptions
- `Voice` interface for TTS voice metadata

✅ **Quality Types Implemented** (packages/core/src/types/quality.ts)
- `QualityMetrics` - Base quality metrics interface
- `QualityGateResult` - Gate validation result (PASS/WARN/FAIL)
- `ScriptQualityMetrics` - NFR21 word count validation (1200-1800)
- `TTSQualityMetrics` - Silence <5%, no clipping validation
- `RenderQualityMetrics` - NFR7 frame drops and audio sync validation
- `ThumbnailQualityMetrics` - NFR22 exactly 3 variants validation
- `PronunciationQualityMetrics` - NFR18 >98% accuracy validation
- `PrePublishQualityGate` - Auto-publish vs human review decision logic

✅ **Error Types Stub Created** (packages/core/src/types/errors.ts)
- `ErrorSeverity` enum with RETRYABLE, FALLBACK, DEGRADED, RECOVERABLE, CRITICAL levels
- Full error handling framework deferred to Story 1.3 as planned

✅ **Package Exports Configured**
- Barrel exports in types/index.ts re-export all types
- Main index.ts exports all types plus NEXUS_VERSION constant
- package.json exports configured for both "." and "./types" subpaths
- TypeScript declaration maps generated for debugging

✅ **Comprehensive Test Coverage**
- 55 unit tests across 5 test files (all passing)
- pipeline.test.ts: 14 tests validating StageInput/Output, PipelineState
- providers.test.ts: 16 tests validating LLM/TTS/Image provider interfaces
- quality.test.ts: 19 tests validating quality metrics and gate logic
- errors.test.ts: 3 tests validating ErrorSeverity enum
- package-exports.test.ts: 3 tests validating module exports and imports
- All tests validate TypeScript strict mode compliance
- Tests verify 4 decimal cost precision, NFR requirements, and type constraints

✅ **TypeScript Strict Mode Validation**
- All types compile with strict mode enabled
- No `any` types used anywhere in codebase
- Generic constraints properly applied
- Naming conventions followed (PascalCase interfaces, camelCase functions)

✅ **All Acceptance Criteria Met**
- Core Pipeline Types: StageInput<T>, StageOutput<T>, StageConfig, QualityMetrics, CostBreakdown, ArtifactRef, PipelineState ✓
- Provider Interfaces: LLMProvider, TTSProvider, ImageProvider with methods ✓
- Validation: TypeScript strict mode compilation ✓
- Package exports properly configured ✓

### File List

**Created:**
- packages/core/src/types/pipeline.ts
- packages/core/src/types/providers.ts
- packages/core/src/types/quality.ts
- packages/core/src/types/errors.ts
- packages/core/src/types/index.ts
- packages/core/src/types/__tests__/pipeline.test.ts
- packages/core/src/types/__tests__/providers.test.ts
- packages/core/src/types/__tests__/quality.test.ts
- packages/core/src/types/__tests__/errors.test.ts
- packages/core/src/__tests__/package-exports.test.ts

**Modified:**
- packages/core/package.json (updated exports, version, scripts)
- packages/core/src/index.ts (added type exports)

**Generated (dist/):**
- packages/core/dist/types/*.d.ts (TypeScript declarations)
- packages/core/dist/types/*.js (Compiled JavaScript)
- packages/core/dist/types/*.d.ts.map (Source maps)

---

## COMPREHENSIVE DEVELOPER CONTEXT

### 🎯 MISSION CRITICAL: Type System as Pipeline Foundation

This story creates the **type system foundation** that prevents developer mistakes across all 10 pipeline stages. Every stage (Epic 2-5) depends on these types. Getting this wrong cascades errors through the entire implementation.

### 🔬 EXHAUSTIVE TYPE REQUIREMENTS ANALYSIS

#### 1. StageInput<T> Interface

**Purpose:** Standardize how data flows INTO every pipeline stage

**Complete Type Definition:**
```typescript
interface StageInput<T> {
  pipelineId: string;           // Format: YYYY-MM-DD (e.g., "2026-01-08")
  previousStage: string | null;  // Stage name or null if first stage
  data: T;                        // Stage-specific input data (generic)
  config: StageConfig;            // Execution configuration
  qualityContext?: {              // Optional degradation tracking
    degradedStages: string[];     // Stages that degraded
    fallbacksUsed: string[];      // Which fallback providers were used
    flags: string[];              // Quality flags from prior stages
  };
}
```

**Critical Details:**
- `pipelineId` MUST be YYYY-MM-DD format (used in Firestore paths)
- `previousStage` enables stage chaining validation
- `qualityContext` accumulates degradation history across stages
- Generic `T` allows type-safe stage-specific data

**Usage Pattern Across Stages:**
```typescript
// Stage 1 (news-sourcing): No previous data
StageInput<{}>

// Stage 2 (research): Receives topic from stage 1
StageInput<{ topic: string; sources: Array<{url: string}> }>

// Stage 3 (script-gen): Receives research brief
StageInput<{ researchBrief: string; topic: string }>

// Stage 4 (pronunciation): Receives script
StageInput<{ script: string }>

// Stage 5 (tts): Receives SSML-tagged script
StageInput<{ ssmlScript: string }>

// ... and so on for all 10 stages
```

---

#### 2. StageOutput<T> Interface

**Purpose:** Standardize what EVERY stage returns (success, data, quality, cost, provider tier)

**Complete Type Definition:**
```typescript
interface StageOutput<T> {
  success: boolean;                           // Did stage succeed?
  data: T;                                    // Stage-specific output data
  artifacts?: ArtifactRef[];                  // References to files in GCS
  quality: QualityMetrics;                    // From quality gate
  cost: CostBreakdown;                        // From CostTracker
  durationMs: number;                         // Performance tracking
  provider: {
    name: string;                             // e.g., "gemini-3-pro-preview"
    tier: 'primary' | 'fallback';            // Critical for quality tracking
    attempts: number;                         // Retry count
  };
  warnings?: string[];                        // Non-fatal quality issues
}
```

**Critical Details:**
- `provider.tier` MUST be tracked (pre-publish quality gate uses this)
- `quality` field is mandatory (every stage calls quality gate)
- `cost` field is mandatory (NFR10/11: <$0.50 credit, <$1.50 post)
- `durationMs` enables NFR6 validation (pipeline <4hr total)

**Why This Matters:**
- Pre-publish quality gate checks `fallbacksUsed` count
- If TTS fallback used → HUMAN_REVIEW (not auto-publish)
- If thumbnail fallback + visual fallback → HUMAN_REVIEW
- Cost tracking enables budget alerts ($0.75 WARNING, $1.00 CRITICAL)

**Example Stage Outputs:**
```typescript
// TTS stage that used fallback provider
{
  success: true,
  data: { audioUrl: 'gs://...', durationSec: 487 },
  artifacts: [{ type: 'audio', url: 'gs://...', size: 1523456 }],
  quality: { stage: 'tts', measurements: { silencePct: 3.2, clippingDetected: false } },
  cost: { service: 'chirp3-hd', tokens: {}, cost: 0.0045 },
  durationMs: 12430,
  provider: {
    name: 'chirp3-hd',
    tier: 'fallback',  // ⚠️ Fallback used! Quality gate will flag this
    attempts: 2
  },
  warnings: ['Primary TTS provider failed, using fallback']
}
```

---

#### 3. StageConfig Interface

**Purpose:** Configure timeout, retries, and stage-specific options

**Complete Type Definition:**
```typescript
interface StageConfig {
  timeout: number;                // Stage timeout in milliseconds
  retries: number;                // Number of retry attempts (default: 3)
  maxConcurrency?: number;        // For parallelizable stages
  [key: string]: unknown;         // Stage-specific options
}
```

**Per-Stage Timeout Configuration (from Architecture):**
```typescript
const stageTimeouts = {
  'news-sourcing': { timeout: 30000, retries: 3 },        // 30s
  'research': { timeout: 60000, retries: 2 },             // 1min (LLM)
  'script-gen': { timeout: 60000, retries: 2 },           // 1min (LLM)
  'pronunciation': { timeout: 10000, retries: 1 },        // 10s (dictionary lookup)
  'tts': { timeout: 120000, retries: 2 },                 // 2min (synthesis)
  'visual-gen': { timeout: 30000, retries: 1 },           // 30s (mapping)
  'render': { timeout: 2700000, retries: 1 },             // 45min (NFR7)
  'thumbnail': { timeout: 60000, retries: 2 },            // 1min (AI generation)
  'youtube': { timeout: 300000, retries: 3 },             // 5min (resumable upload)
  'notifications': { timeout: 30000, retries: 1 }         // 30s (webhook)
};
```

**Stage-Specific Options Examples:**
```typescript
// TTS stage config
config: StageConfig & {
  voice: 'en-US-Neural2-F',
  speakingRate: 0.95,
  ssmlInput: true
}

// Render stage config
config: StageConfig & {
  resolution: '1920x1080',
  frameRate: 30,
  codec: 'h264'
}

// YouTube stage config
config: StageConfig & {
  publishTime: '14:00',
  categoryId: '28',  // Science & Technology
  madeForKids: false
}
```

---

#### 4. Provider Interface Specifications

**WHY PROVIDER ABSTRACTIONS MATTER:**
- Enables fallback chains without changing stage code
- Supports cost estimation before execution
- Tracks which provider tier was used (quality context)
- Allows swapping providers (e.g., switch TTS models)

**4a. LLMProvider Interface**

```typescript
interface LLMProvider {
  // Generate text from prompt
  generate(
    prompt: string,
    options?: LLMOptions
  ): Promise<LLMResult>;

  // Estimate cost before making call
  estimateCost(prompt: string): number;
}

interface LLMOptions {
  temperature?: number;           // 0-2, default 1
  maxTokens?: number;             // Output limit
  topP?: number;                  // Nucleus sampling
  topK?: number;                  // Top-k sampling
  systemPrompt?: string;          // System instructions
}

interface LLMResult {
  text: string;                   // Generated content
  tokens: {
    input: number;                // Tokens in prompt
    output: number;               // Tokens generated
  };
  cost: number;                   // Cost in USD (4 decimals)
  model: string;                  // Model identifier
  quality: 'primary' | 'fallback';// Tier used
}
```

**Usage in Stages:**
- Stage 2 (research): Generate 2000-word research brief
- Stage 3 (script-gen): Multi-agent (Writer → Critic → Optimizer)

**Primary vs Fallback:**
```typescript
// Stage uses this pattern (from withFallback in Story 1.4)
const llmProviders = [
  new GeminiLLMProvider('gemini-3-pro-preview'),  // Primary
  new GeminiLLMProvider('gemini-2.5-pro')         // Fallback
];
```

---

**4b. TTSProvider Interface**

```typescript
interface TTSProvider {
  // Synthesize text to audio
  synthesize(
    text: string,
    options: TTSOptions
  ): Promise<TTSResult>;

  // Get available voices for selection
  getVoices(): Promise<Voice[]>;

  // Estimate cost before synthesis
  estimateCost(text: string): number;
}

interface TTSOptions {
  voice?: string;                 // Voice ID (e.g., "en-US-Neural2-F")
  language?: string;              // BCP 47 code (e.g., "en-US")
  speakingRate?: number;          // 0.25-4.0, default 1.0
  pitch?: number;                 // -20 to 20, default 0
  style?: 'narrative' | 'formal' | 'casual';
  ssmlInput?: boolean;            // Is text SSML-tagged? (from pronunciation stage)
}

interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalness?: 'NATURAL' | 'STANDARD';
}

interface TTSResult {
  audioUrl: string;               // GCS path (e.g., gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav)
  durationSec: number;            // Audio length
  cost: number;                   // Cost in USD
  model: string;                  // e.g., "gemini-2.5-pro-tts"
  quality: 'primary' | 'fallback';
  codec: 'wav' | 'mp3';
  sampleRate: number;             // 44100 Hz standard
}
```

**Special Requirements:**
- MUST support SSML input (Stage 4 tags pronunciations)
- MUST handle chunking for scripts >5000 chars (FR17)
- MUST support multi-speaker synthesis (future enhancement)

**Fallback Chain (Critical for Quality):**
1. Primary: gemini-2.5-pro-tts → Best quality, natural control
2. Fallback 1: chirp3-hd → High quality fallback
3. Fallback 2: wavenet → Last resort

**Why TTS Fallback Triggers HUMAN_REVIEW:**
- Primary TTS has 30 speakers, natural language control
- Fallbacks have limited voice options, lower quality
- Using fallback = degraded pronunciation quality
- Pre-publish gate catches this → sends to human review queue

---

**4c. ImageProvider Interface**

```typescript
interface ImageProvider {
  // Generate images from text prompts
  generate(
    prompt: string,
    options: ImageOptions
  ): Promise<ImageResult>;

  // Estimate cost before generation
  estimateCost(prompt: string): number;
}

interface ImageOptions {
  width?: number;                 // 1280 (YouTube thumbnail standard)
  height?: number;                // 720 (YouTube thumbnail standard)
  count?: number;                 // Number of variants (NFR22: must be 3)
  style?: string;                 // Art style description
}

interface ImageResult {
  imageUrls: string[];            // Array of GCS paths (3 variants)
  cost: number;                   // Total cost for all variants
  model: string;                  // Model identifier
  quality: 'primary' | 'fallback';// Tier used
  generatedAt: string;            // ISO 8601 UTC
}
```

**NFR22 Requirement:**
- MUST generate exactly 3 A/B thumbnail variants
- Variant 1: Bold text focus
- Variant 2: Visual concept focus
- Variant 3: Mixed approach

**Fallback Strategy:**
```typescript
// Primary: AI generation
const result = await geminiImageProvider.generate(prompt, { count: 3 });

// Fallback: Template thumbnails (Story 3.8)
if (result.quality === 'fallback') {
  // Templates with text overlay
  // No AI cost, but lower CTR (clickthrough rate)
}
```

---

#### 5. Quality Types

**5a. QualityMetrics Interface (Base)**

```typescript
interface QualityMetrics {
  stage: string;                  // Stage name
  timestamp: string;              // ISO 8601 UTC
  measurements: Record<string, unknown>;  // Stage-specific metrics
}
```

**5b. Stage-Specific Quality Metrics**

**Script Generation Quality:**
```typescript
interface ScriptQualityMetrics extends QualityMetrics {
  measurements: {
    wordCount: number;            // MUST be 1200-1800 (NFR21)
    readingTimeSeconds: number;   // Estimated reading time
    sentenceCount: number;        // Pacing analysis
    technicalTermCount: number;   // For pronunciation check
    visualCueCount: number;       // [VISUAL: ...] tags
  };
}

// Quality Gate Logic:
// FAIL if wordCount < 1200 || wordCount > 1800
// WARN if wordCount < 1300 || wordCount > 1700 (edge of range)
```

**TTS Quality:**
```typescript
interface TTSQualityMetrics extends QualityMetrics {
  measurements: {
    silencePct: number;           // Percentage silence (MUST be <5%)
    clippingDetected: boolean;    // Audio distortion (MUST be false)
    averageLoudnessDb: number;    // LUFS (loudness units)
    durationSec: number;          // Total audio length
    codec: string;                // "wav"
    sampleRate: number;           // 44100 Hz
    segmentCount?: number;        // If chunked (FR17)
  };
}

// Quality Gate Logic:
// FAIL if clippingDetected === true
// WARN if silencePct > 5%
// WARN if loudness outside -16 to -14 LUFS (YouTube standard)
```

**Render Quality:**
```typescript
interface RenderQualityMetrics extends QualityMetrics {
  measurements: {
    frameDrops: number;           // MUST be 0 (NFR7)
    audioSyncMs: number;          // Audio/video sync offset, <100ms
    durationSec: number;          // Video duration (5-8 min target)
    resolution: string;           // "1920x1080"
    frameRate: number;            // 30 fps
    bitrate: number;              // Mbps
    fileSize: number;             // Bytes
  };
}

// Quality Gate Logic:
// FAIL if frameDrops > 0
// FAIL if audioSyncMs > 100
// WARN if durationSec < 300 || durationSec > 480 (5-8 min)
```

**Thumbnail Quality:**
```typescript
interface ThumbnailQualityMetrics extends QualityMetrics {
  measurements: {
    variantsGenerated: number;    // MUST be exactly 3 (NFR22)
    textLegibility: number;       // 0-100 readability score
    colorContrast: number;        // Contrast ratio (WCAG AA: >4.5:1)
    usingTemplates: boolean;      // Fallback indicator
  };
}

// Quality Gate Logic:
// FAIL if variantsGenerated !== 3
// WARN if usingTemplates === true (fallback)
// WARN if textLegibility < 70 || colorContrast < 4.5
```

**Pronunciation Quality:**
```typescript
interface PronunciationQualityMetrics extends QualityMetrics {
  measurements: {
    totalTerms: number;           // Terms found in script
    knownTerms: number;           // Terms in dictionary
    unknownTerms: number;         // Terms not in dictionary
    accuracyPct: number;          // MUST exceed 98% (NFR18)
    flaggedForReview: boolean;    // >3 unknown triggers review (FR13)
    termsAdded: number;           // New dictionary entries (FR14)
  };
}

// Quality Gate Logic:
// FAIL if accuracyPct < 98% AND flaggedForReview === true
// WARN if unknownTerms > 3 (add to review queue)
```

---

**5c. QualityGateResult Interface**

```typescript
interface QualityGateResult {
  status: 'PASS' | 'WARN' | 'FAIL';  // Gate outcome
  metrics: Record<string, unknown>;    // Stage measurements
  warnings: string[];                  // Warning messages
  reason?: string;                     // Failure reason if FAIL
  stage: string;                       // Which stage checked
}
```

**Usage Pattern:**
```typescript
// Every stage calls quality gate before returning
const gateResult = await qualityGate.check('tts', {
  silencePct: 3.2,
  clippingDetected: false,
  durationSec: 487
});

if (gateResult.status === 'FAIL') {
  throw NexusError.degraded(
    'NEXUS_QUALITY_GATE_FAIL',
    gateResult.reason,
    'tts'
  );
}
```

---

**5d. PrePublishQualityGate (Orchestrator)**

```typescript
interface PrePublishQualityGate {
  decision: 'AUTO_PUBLISH' | 'AUTO_PUBLISH_WITH_WARNING' | 'HUMAN_REVIEW';
  issues: Array<{
    stage: string;
    severity: 'warning' | 'error';
    message: string;
  }>;
  fallbacksUsed: string[];        // e.g., ['tts:chirp3-hd']
  degradedStages: string[];       // Stages that degraded
  recommendedAction?: string;     // Human review instructions
}
```

**Decision Logic (from Architecture):**
```typescript
// AUTO_PUBLISH: No issues
if (issues.length === 0 && fallbacksUsed.length === 0) {
  decision = 'AUTO_PUBLISH';
}

// AUTO_PUBLISH_WITH_WARNING: ≤2 minor issues, no TTS fallback
else if (issues.filter(i => i.severity === 'error').length === 0 &&
         issues.length <= 2 &&
         !fallbacksUsed.some(f => f.startsWith('tts:'))) {
  decision = 'AUTO_PUBLISH_WITH_WARNING';
}

// HUMAN_REVIEW: Major quality compromises
else {
  decision = 'HUMAN_REVIEW';
  // Pause before YouTube stage
  // Add to review queue
}
```

**Examples of HUMAN_REVIEW Triggers:**
- TTS fallback used (chirp3-hd or wavenet)
- >30% visual scenes using fallback (TextOnGradient)
- Word count outside 1200-1800 range
- >3 unknown pronunciation terms unresolved
- Thumbnail fallback + visual fallback (double degradation)
- Frame drops in render
- Audio sync >100ms

---

#### 6. Cost Tracking Types

**6a. CostBreakdown Interface**

```typescript
interface CostBreakdown {
  service: string;                // API service name (e.g., "gemini-3-pro")
  tokens: {
    input?: number;               // Input tokens (LLM only)
    output?: number;              // Output tokens (LLM only)
  };
  cost: number;                   // Cost in USD (4 decimal precision)
  timestamp: string;              // ISO 8601 UTC
  model?: string;                 // Model name if applicable
}
```

**Critical Requirements:**
- NFR10: Cost <$0.50/video during GCP credit period ($300 / 90 days)
- NFR11: Cost <$1.50/video post-credit
- NFR13: Real-time tracking accurate within $0.01
- 4 decimal precision required (e.g., 0.0023)

**Cost Breakdown by Stage (Estimated):**
```typescript
const stageCosts = {
  'news-sourcing': 0.0001,    // API calls only
  'research': 0.0150,         // LLM (2000 words)
  'script-gen': 0.0400,       // Multi-agent LLM (Writer + Critic + Optimizer)
  'pronunciation': 0.0000,    // Dictionary lookup (no API)
  'tts': 0.0250,              // TTS synthesis (primary)
  'visual-gen': 0.0050,       // LLM for cue mapping
  'render': 0.0200,           // Cloud Run compute (4 CPU, 45min)
  'thumbnail': 0.0800,        // AI image generation (3 variants)
  'youtube': 0.0005,          // API quota
  'notifications': 0.0001     // Email/Discord webhooks
};
// Total: ~$0.135/video (well under $0.50 target)
```

**Cost Alert Thresholds:**
```typescript
if (videoCost > 0.75) {
  await discordAlert('WARNING', `Video cost $${videoCost} exceeds $0.75`);
}
if (videoCost > 1.00) {
  await discordAlert('CRITICAL', `Video cost $${videoCost} exceeds $1.00`);
}
```

---

#### 7. Artifact Reference Types

**ArtifactRef Interface:**

```typescript
interface ArtifactRef {
  type: 'audio' | 'video' | 'image' | 'json' | 'text';
  url: string;                    // GCS path (e.g., gs://nexus-ai-artifacts/...)
  size: number;                   // File size in bytes
  contentType: string;            // MIME type (e.g., "audio/wav", "video/mp4")
  generatedAt: string;            // ISO 8601 UTC
  stage: string;                  // Stage that generated it
}
```

**Artifact Storage Paths (GCS):**
```typescript
const artifactPaths = {
  research: `gs://nexus-ai-artifacts/${date}/research/research.md`,
  scriptDrafts: `gs://nexus-ai-artifacts/${date}/script/drafts/v{1,2,3}-{writer,critic,optimizer}.md`,
  script: `gs://nexus-ai-artifacts/${date}/script/script.md`,
  audioSegments: `gs://nexus-ai-artifacts/${date}/tts/segments/${index}.wav`,
  audio: `gs://nexus-ai-artifacts/${date}/tts/audio.wav`,
  visualTimeline: `gs://nexus-ai-artifacts/${date}/visual/scenes.json`,
  thumbnails: `gs://nexus-ai-artifacts/${date}/thumbnails/${1,2,3}.png`,
  video: `gs://nexus-ai-artifacts/${date}/render/video.mp4`
};
```

**Example Usage:**
```typescript
// TTS stage returns audio artifact
artifacts: [{
  type: 'audio',
  url: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
  size: 1523456,
  contentType: 'audio/wav',
  generatedAt: '2026-01-08T08:23:45.123Z',
  stage: 'tts'
}]

// Render stage references audio + timeline artifacts
artifacts: [
  { type: 'audio', url: '...', ... },  // From TTS stage
  { type: 'json', url: '...', ... },   // Visual timeline
  { type: 'video', url: '...', ... }   // Rendered video
]
```

---

#### 8. Pipeline State Types

**PipelineState Interface (Firestore):**

```typescript
interface PipelineState {
  pipelineId: string;             // YYYY-MM-DD format
  stage: string;                  // Current stage name
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime: string;              // ISO 8601 UTC
  endTime?: string;               // ISO 8601 UTC (when complete)
  topic?: string;                 // Selected topic title
  errors: Array<{                 // Error history
    code: string;
    message: string;
    stage: string;
    timestamp: string;
    severity: ErrorSeverity;
  }>;
  qualityContext?: {              // Accumulated quality issues
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
}
```

**Firestore Document Locations:**
```typescript
const firestorePaths = {
  state: `pipelines/${pipelineId}/state`,
  artifacts: `pipelines/${pipelineId}/artifacts`,
  costs: `pipelines/${pipelineId}/costs`,
  quality: `pipelines/${pipelineId}/quality`,
  youtube: `pipelines/${pipelineId}/youtube`
};
```

**State Transitions:**
```
pending → running → success (happy path)
pending → running → failed (stage failure)
pending → running → skipped (health check failure or exhausted retries)
```

---

### 🚨 COMMON MISTAKES TO PREVENT

**1. Generic Type Errors:**
```typescript
// WRONG: Using any
interface StageInput {
  data: any;
}

// CORRECT: Using generic
interface StageInput<T> {
  data: T;
}
```

**2. Missing Provider Tier Tracking:**
```typescript
// WRONG: Not tracking which provider was used
{
  success: true,
  data: result
}

// CORRECT: Always include provider info
{
  success: true,
  data: result,
  provider: {
    name: 'chirp3-hd',
    tier: 'fallback',  // Critical for quality gate
    attempts: 2
  }
}
```

**3. Inconsistent Naming:**
```typescript
// WRONG: Mixed naming conventions
interface stage_output { ... }
class ttsProvider { ... }

// CORRECT: Follow conventions
interface StageOutput { ... }  // PascalCase
class TTSProvider { ... }      // PascalCase
```

**4. Missing Cost Precision:**
```typescript
// WRONG: Insufficient precision
cost: 0.12  // Only 2 decimals

// CORRECT: 4 decimal precision
cost: 0.1234  // Supports micro-costs like $0.0023
```

**5. Incomplete Quality Metrics:**
```typescript
// WRONG: Generic measurements
quality: {
  stage: 'tts',
  measurements: { ok: true }
}

// CORRECT: Stage-specific metrics
quality: {
  stage: 'tts',
  measurements: {
    silencePct: 3.2,
    clippingDetected: false,
    durationSec: 487
  }
}
```

---

### 🎯 VALIDATION CHECKLIST

Before marking story complete, verify:

**Type Completeness:**
- [ ] All StageInput/StageOutput fields defined
- [ ] All provider interfaces complete (LLM, TTS, Image)
- [ ] All quality metric structures defined
- [ ] Cost breakdown supports 4 decimal precision
- [ ] Artifact ref includes all required fields

**TypeScript Strict Mode:**
- [ ] No `any` types used
- [ ] Generic constraints applied where needed
- [ ] All interfaces/types use PascalCase
- [ ] All files use kebab-case naming

**Package Configuration:**
- [ ] package.json exports configured correctly
- [ ] Barrel exports in types/index.ts
- [ ] Can import from @nexus-ai/core in other packages
- [ ] TypeScript compilation succeeds

**Testing:**
- [ ] Type compilation tests pass
- [ ] Can instantiate types with valid data
- [ ] Generic types enforce constraints
- [ ] Package imports work across workspace

**Documentation:**
- [ ] All interfaces have JSDoc comments
- [ ] Complex types have usage examples
- [ ] Provider interfaces document expected behavior
- [ ] Quality gate logic documented

---

### 📦 EXPECTED FILE STRUCTURE

```
packages/core/
├── src/
│   ├── types/
│   │   ├── index.ts              # Barrel exports
│   │   ├── pipeline.ts           # StageInput, StageOutput, PipelineState, ArtifactRef
│   │   ├── providers.ts          # LLMProvider, TTSProvider, ImageProvider, CostBreakdown
│   │   ├── quality.ts            # QualityMetrics, QualityGateResult, stage-specific metrics
│   │   └── errors.ts             # ErrorSeverity enum (stub for Story 1.3)
│   ├── index.ts                  # Main package export
│   └── package.json
├── tsconfig.json                 # TypeScript config with strict mode
├── package.json                  # @nexus-ai/core package config
└── README.md                     # Package documentation
```

**Barrel Export Pattern (types/index.ts):**
```typescript
// Re-export all types
export * from './pipeline';
export * from './providers';
export * from './quality';
export * from './errors';
```

**Main Package Export (src/index.ts):**
```typescript
// Primary export point
export * from './types';
```

**Package.json Exports:**
```json
{
  "name": "@nexus-ai/core",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
```

---

### 🔗 INTEGRATION WITH FUTURE STORIES

**Story 1.3 (Error Handling Framework):**
- Will expand ErrorSeverity enum
- Will create NexusError class
- Types defined here enable error context tracking

**Story 1.4 (Retry/Fallback Utilities):**
- Uses provider interfaces defined here
- Returns { result, provider, tier } matching StageOutput
- Integrates with StageConfig for retry counts

**Story 1.5 (Provider Abstraction):**
- Implements LLMProvider, TTSProvider, ImageProvider interfaces
- Returns typed results (LLMResult, TTSResult, ImageResult)
- Uses CostBreakdown for cost tracking

**Story 1.6 (GCP Infrastructure):**
- Uses PipelineState for Firestore documents
- Uses ArtifactRef for Cloud Storage references
- Stores costs using CostBreakdown structure

**Story 1.8 (Cost Tracking):**
- Uses CostBreakdown type
- Integrates with StageOutput.cost field
- Validates against NFR10/11 thresholds

**Story 1.9 (Quality Gate Framework):**
- Implements QualityGateResult interface
- Creates stage-specific quality checks
- Integrates with StageOutput.quality field

**Story 1.10 (Execute Stage Wrapper):**
- Uses StageInput<T> and StageOutput<T> as function signature
- Automatically populates quality, cost, provider fields
- Enforces type contracts across all stages

**Epic 2-5 (All Pipeline Stages):**
- Every stage uses StageInput/StageOutput contracts
- Every stage implements provider interfaces
- Every stage validates against quality metrics
- Every stage tracks costs via CostBreakdown

---

### 💡 IMPLEMENTATION GUIDANCE

**Start Here:**
1. Create package structure (packages/core)
2. Configure package.json with @nexus-ai/core scope
3. Set up tsconfig.json with strict mode

**Then Implement Types in Order:**
1. **pipeline.ts first** (foundation):
   - StageInput<T>
   - StageOutput<T>
   - StageConfig
   - ArtifactRef
   - PipelineState

2. **providers.ts second** (interfaces):
   - CostBreakdown (used by all providers)
   - LLMProvider + LLMResult
   - TTSProvider + TTSResult
   - ImageProvider + ImageResult

3. **quality.ts third** (metrics):
   - QualityMetrics (base)
   - QualityGateResult
   - Stage-specific metrics (Script, TTS, Render, Thumbnail)

4. **errors.ts last** (stub):
   - ErrorSeverity enum only
   - NexusError class comes in Story 1.3

**Testing Strategy:**
1. Type compilation tests (verify TypeScript accepts valid data)
2. Package import tests (can import from @nexus-ai/core)
3. Generic type tests (constraints work correctly)
4. Strict mode validation (no any, proper typing)

**Review Criteria:**
- All types compile with strict mode
- No `any` types used anywhere
- All naming conventions followed
- Package exports work correctly
- Types match architecture specifications
- Quality metric structures complete
- Provider interfaces comprehensive

---

## 🎓 KEY LEARNINGS FOR DEV AGENT

**1. Type System as Guardrails:**
This isn't just documentation - these types prevent mistakes in all 10 stages. Get them wrong, and every stage breaks.

**2. Provider Tier Tracking is Critical:**
The pre-publish quality gate depends on knowing which providers used fallbacks. Missing `provider.tier` = broken quality gate.

**3. Cost Precision Matters:**
4 decimal precision ($0.0023) enables accurate micro-cost tracking. NFR13 requires ±$0.01 accuracy.

**4. Quality Metrics Enable Automation:**
Stage-specific metrics (word count, silence%, frame drops) drive the quality gate decision logic. Vague metrics = manual review every video.

**5. Naming Conventions Prevent Confusion:**
PascalCase interfaces, camelCase functions, kebab-case files. Consistency across 10+ packages in monorepo.

**6. Generic Types Enable Type Safety:**
`StageInput<T>` means script-gen can't accidentally receive audio data. TypeScript prevents runtime errors.

**7. This is the Foundation:**
Stories 1.3-1.10 and Epics 2-5 all depend on these types. Take time to get this right.

---

**Developer:** Read this entire context before writing a single line of code. The types you create here will be used hundreds of times across all pipeline stages. Precision and completeness are paramount.

---

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (adversarial code review)
**Date:** 2026-01-09
**Outcome:** ✅ APPROVED (after fixes applied)

### Issues Found and Fixed

| Severity | Issue | Location | Resolution |
|----------|-------|----------|------------|
| HIGH | `StageOutput.quality` used `Record<string, unknown>` instead of `QualityMetrics` | `pipeline.ts:91` | ✅ Fixed - now uses proper typed interface |
| HIGH | `StageOutput.cost` used `Record<string, unknown>` instead of `CostBreakdown` | `pipeline.ts:93` | ✅ Fixed - now uses proper typed interface |
| MEDIUM | `PipelineState.errors[].severity` used `string` instead of `ErrorSeverity` enum | `pipeline.ts:124` | ✅ Fixed - now uses `ErrorSeverity` enum |
| MEDIUM | Circular dependency risk for imports | `pipeline.ts` | ✅ Fixed - added imports from providers.ts, quality.ts, errors.ts |
| LOW | `ImageProvider.estimateCost()` missing options parameter | `providers.ts:210` | ✅ Fixed - added optional `ImageOptions` parameter |
| LOW | Test files using weak types that should be strongly typed | `pipeline.test.ts`, `package-exports.test.ts` | ✅ Fixed - updated tests to use proper type structures |

### Verification Results

- **TypeScript Strict Mode:** ✅ PASS (`pnpm type-check` passes)
- **Unit Tests:** ✅ PASS (55/55 tests passing)
- **Build:** ✅ PASS (`pnpm build` succeeds)
- **Architecture Compliance:** ✅ PASS (types now match architecture.md and project-context.md specifications)

### Files Modified During Review

- `packages/core/src/types/pipeline.ts` - Added imports, fixed type definitions
- `packages/core/src/types/providers.ts` - Added options parameter to `ImageProvider.estimateCost()`
- `packages/core/src/types/__tests__/pipeline.test.ts` - Updated test data to use proper types
- `packages/core/src/__tests__/package-exports.test.ts` - Updated test data to use proper types

### Key Improvements

1. **Type Safety Restored:** `StageOutput` now enforces proper `QualityMetrics` and `CostBreakdown` structures at compile time, catching errors before runtime.

2. **Enum Usage:** `PipelineState.errors[].severity` now uses the `ErrorSeverity` enum, preventing invalid severity values.

3. **Better API Design:** `ImageProvider.estimateCost()` now accepts `ImageOptions` to properly estimate batch generation costs (NFR22: 3 variants).

4. **Test Quality:** Tests now demonstrate proper usage of typed interfaces, serving as documentation for future developers.

### Recommendation

Story is **ready for merge**. All acceptance criteria met, all issues resolved, types now fully comply with architecture specifications.

