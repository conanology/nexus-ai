# Story 5.2: Implement Pipeline Execution

Status: review

## Story

As a developer,
I want sequential stage execution with retry, fallback, and error recovery,
So that the pipeline runs reliably end-to-end with automatic quality-aware error handling, enabling the daily video production workflow to recover from transient failures while maintaining quality standards.

## Acceptance Criteria

1. **Given** the orchestrator service from Story 5.1
   **When** I implement the pipeline execution logic per FR42-43
   **Then** `executePipeline(pipelineId: string)` function:
   - Creates pipeline state in Firestore at `pipelines/{pipelineId}/state`
   - Executes all 10 stages sequentially in architectural order
   - Passes `StageOutput` from each stage to next stage's `StageInput.data`
   - Updates Firestore state after each stage completion/failure
   - Returns complete pipeline result with all stage outputs

2. **Given** the stage execution order from architecture
   **When** I execute the pipeline stages sequentially
   **Then** stages execute in this exact order:
   1. news-sourcing → topic selection
   2. research → research brief (2,000 words)
   3. script-gen → video script (1,200-1,800 words)
   4. pronunciation → SSML-tagged script
   5. tts → audio file (.wav)
   6. visual-gen → scene timeline JSON
   7. render (via render-service) → video file (.mp4)
   8. thumbnail → 3 thumbnail variants
   9. youtube → scheduled video upload
   10. twitter → social promotion (recoverable)
   11. notifications → digest sent (always runs)
   **And** each stage receives previous stage's output as input
   **And** `qualityContext` is accumulated and passed forward

3. **Given** retry logic requirements per FR42 and NFR15
   **When** a stage throws a RETRYABLE error
   **Then** the stage is retried up to 3 times (configurable per stage)
   **And** exponential backoff is applied between retries:
   - Attempt 1: immediate
   - Attempt 2: 2s base delay + jitter
   - Attempt 3: 4s base delay + jitter
   - Attempt 4: 8s base delay + jitter (max delay: 30s)
   **And** each retry attempt is logged with: pipelineId, stage, attemptNumber, delayMs
   **And** retry count is tracked in pipeline state under `stages[stageName].retryAttempts`

4. **Given** fallback logic requirements per FR43
   **When** a stage uses provider fallback chains (LLM, TTS, Image)
   **Then** providers are tried in order until one succeeds:
   - LLM: Gemini 3 Pro → Gemini 2.5 Pro
   - TTS: Gemini TTS → Chirp 3 HD → WaveNet
   - Image: Gemini Image → Template thumbnails
   **And** fallback usage is tracked in `StageOutput.provider`:
   ```typescript
   {
     name: 'chirp3-hd',
     tier: 'fallback',
     attempts: 2
   }
   ```
   **And** fallback usage adds stage to `qualityContext.fallbacksUsed[]`
   **And** stage is logged with warning: `Stage completed with fallback provider`

5. **Given** pipeline state persistence requirements from architecture
   **When** each stage completes (success or failure)
   **Then** Firestore state at `pipelines/{pipelineId}/state` is updated with:
   ```typescript
   stages[stageName]: {
     status: 'completed' | 'failed' | 'skipped',
     startTime: ISO8601,
     endTime: ISO8601,
     durationMs: number,
     provider: { name, tier, attempts },
     cost: CostBreakdown,
     error: { code, message, severity } // if failed
   }
   ```
   **And** `currentStage` field is updated to next stage name
   **And** `qualityContext` is persisted with accumulated degradation flags
   **And** all Firestore writes use try/catch to prevent data loss

6. **Given** error handling strategy from architecture (Decision 5)
   **When** errors occur during pipeline execution
   **Then** errors are handled based on severity:
   - **RETRYABLE**: Retry up to 3 times, then fail stage
   - **FALLBACK**: Use next provider in fallback chain
   - **DEGRADED**: Continue pipeline, mark quality degraded
   - **RECOVERABLE**: Skip stage, continue pipeline
   - **CRITICAL**: Abort pipeline, trigger skip day logic
   **And** critical stage failures (news, research, script, TTS, render, upload) abort pipeline
   **And** recoverable stage failures (twitter, visual-gen with fallback) continue pipeline
   **And** NOTIFY stage always runs regardless of prior failures (FR45, NFR4)

7. **Given** pipeline can be resumed from last successful stage
   **When** I implement pipeline resume logic
   **Then** `resumePipeline(pipelineId: string, fromStage?: string)` function:
   - Loads existing state from Firestore
   - Finds last successfully completed stage
   - Resumes execution from next stage after last success
   - Or resumes from explicit `fromStage` if provided
   - Skips already-completed stages
   - Continues until pipeline completion or failure
   **And** resume is logged: `Resuming pipeline from stage: {stageName}`

## Tasks / Subtasks

- [x] Task 1: Implement Core Pipeline Executor (AC: #1, #2)
  - [x] Create `executePipeline()` function in `src/pipeline.ts`
  - [x] Initialize pipeline state in Firestore
  - [x] Implement sequential stage execution loop
  - [x] Pass `StageOutput → StageInput` between stages
  - [x] Update state after each stage completion
  - [x] Return complete pipeline result

- [x] Task 2: Implement Retry Logic with Exponential Backoff (AC: #3)
  - [x] Enhance `withRetry` utility in `@nexus-ai/core` if needed
  - [x] Apply retry wrapper to each stage execution
  - [x] Implement exponential backoff with jitter
  - [x] Configure per-stage retry counts
  - [x] Log all retry attempts with context
  - [x] Track retry count in pipeline state

- [x] Task 3: Integrate Provider Fallback Chains (AC: #4)
  - [x] Verify `withFallback` utility exists in `@nexus-ai/core`
  - [x] Ensure stages use provider fallback chains
  - [x] Track fallback usage in `StageOutput.provider`
  - [x] Add fallback stages to `qualityContext.fallbacksUsed`
  - [x] Log warnings when fallbacks are used

- [x] Task 4: Implement State Persistence (AC: #5)
  - [x] Create `updateStageState()` in `src/state.ts`
  - [x] Persist state after each stage completion
  - [x] Update `currentStage` field during execution
  - [x] Accumulate `qualityContext` across stages
  - [x] Wrap Firestore writes in try/catch
  - [x] Handle Firestore write failures gracefully

- [x] Task 5: Implement Error Handling Strategy (AC: #6)
  - [x] Create `handleStageError()` function
  - [x] Route errors by severity level
  - [x] Abort on CRITICAL errors from critical stages
  - [x] Continue on RECOVERABLE errors
  - [x] Ensure NOTIFY stage always executes
  - [x] Log all error handling decisions
  - [x] Trigger skip day logic on abort

- [x] Task 6: Implement Pipeline Resume Logic (AC: #7)
  - [x] Create `resumePipeline()` function
  - [x] Load existing state from Firestore
  - [x] Find last successful stage
  - [x] Skip completed stages
  - [x] Resume from next stage
  - [x] Support explicit `fromStage` parameter

- [x] Task 7: Integration with Handlers (AC: all)
  - [x] Update `src/handlers/scheduled.ts` to call `executePipeline()`
  - [x] Update `src/handlers/manual.ts` to call `executePipeline()`
  - [x] Add resume endpoint to manual handler
  - [x] Return pipeline status to caller
  - [x] Handle async execution properly

- [x] Task 8: Testing and Validation (AC: all)
  - [x] Unit tests for `executePipeline()` with mocked stages
  - [x] Unit tests for retry logic
  - [x] Unit tests for error handling by severity
  - [x] Unit tests for state persistence
  - [x] Unit tests for resume logic
  - [x] Integration test: full pipeline with mock stages
  - [x] Integration test: pipeline with failures and retries
  - [x] Integration test: resume from mid-pipeline

## Dev Notes

### Critical Context from Previous Story (5.1)

**Foundation Already Built:**
- ✅ Orchestrator service structure created
- ✅ Stage registry with all imports (`src/stages.ts`)
- ✅ Pipeline state management (`src/state.ts`)
- ✅ Quality gate implementation (`src/quality-gate.ts`)
- ✅ Handler stubs created (scheduled, manual, health)

**What Story 5.2 MUST Implement:**
- Sequential stage execution logic (the core missing piece)
- Retry/fallback integration
- Error handling routing
- State updates during execution
- Resume capability

### Architecture Requirements - Pipeline Execution Pattern

**From Architecture Decision 1 (Central Orchestrator):**
> Orchestrator holds pipeline state in memory, persists to Firestore at checkpoints. Each stage returns result or throws typed error. Handles retry logic, fallback chains, state persistence. On failure: log → retry → fallback → skip → alert → continue or abort.

**Critical Pattern from Architecture (Section 4.3):**
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

**Every stage MUST:**
- Validate input → execute with retry → validate output → quality gate → return
- This is enforced by the `executeStage` wrapper from `@nexus-ai/core`

### Stage Execution Order (Architecture Decision)

**Complete Pipeline Sequence:**
```
1. news-sourcing → NewsItem (selected topic)
2. research → ResearchBrief (2,000 words)
3. script-gen → Script (1,200-1,800 words)
4. pronunciation → SSMLScript (tagged)
5. tts → AudioFile (.wav URL)
6. visual-gen → SceneTimeline (JSON)
7. render → VideoFile (.mp4 URL) [via render-service]
8. thumbnail → ThumbnailSet (3 variants)
9. youtube → YouTubeVideo (videoId, scheduledTime)
10. twitter → Tweet (tweetUrl) [RECOVERABLE]
11. notifications → NotificationResult [ALWAYS RUNS]
```

**Data Flow Example:**
```typescript
// Stage 1: News Sourcing
const newsOutput = await executeNewsSourcing({ pipelineId, ... });
// newsOutput.data = { topic: NewsItem }

// Stage 2: Research
const researchInput = {
  pipelineId,
  previousStage: 'news-sourcing',
  data: newsOutput.data,  // { topic }
  config: researchConfig,
  qualityContext: newsOutput.quality
};
const researchOutput = await executeResearch(researchInput);
// researchOutput.data = { brief: string, sources: string[] }

// Continue chaining...
```

### Retry Logic Implementation (FR42, NFR15)

**From Architecture Section 4.2:**
- Exponential backoff with configurable base/max delay
- Quality-aware retries (retry if output quality poor)
- Per-service retry configuration
- Track attempts and quality retries separately

**Retry Configuration Per Stage:**
```typescript
const stageRetryConfig = {
  'news-sourcing': { maxRetries: 3, baseDelay: 2000 },
  'research': { maxRetries: 3, baseDelay: 2000 },
  'script-gen': { maxRetries: 3, baseDelay: 2000 },
  'pronunciation': { maxRetries: 2, baseDelay: 1000 },
  'tts': { maxRetries: 5, baseDelay: 3000 }, // Higher retries for quality
  'visual-gen': { maxRetries: 3, baseDelay: 2000 },
  'render': { maxRetries: 3, baseDelay: 5000 },
  'thumbnail': { maxRetries: 3, baseDelay: 2000 },
  'youtube': { maxRetries: 5, baseDelay: 3000 }, // Upload critical
  'twitter': { maxRetries: 2, baseDelay: 1000 },
  'notifications': { maxRetries: 3, baseDelay: 1000 }
};
```

**Exponential Backoff Formula:**
```typescript
const delay = Math.min(
  baseDelay * Math.pow(2, attemptNumber) + Math.random() * 1000,
  maxDelay
);
```

### Error Handling Strategy (Architecture Decision 5)

**Error Severity Routing:**
```typescript
async function handleStageError(
  error: NexusError,
  stage: string,
  pipelineId: string
): Promise<'retry' | 'fallback' | 'continue' | 'abort'> {
  if (error.severity === ErrorSeverity.RETRYABLE) {
    return 'retry'; // Will be retried by withRetry
  }

  if (error.severity === ErrorSeverity.FALLBACK) {
    return 'fallback'; // Will be handled by withFallback
  }

  if (error.severity === ErrorSeverity.DEGRADED) {
    logger.warn('Stage degraded', { pipelineId, stage, error: error.message });
    return 'continue'; // Continue with quality flag
  }

  if (error.severity === ErrorSeverity.RECOVERABLE) {
    logger.warn('Stage failed, continuing', { pipelineId, stage });
    return 'continue'; // Skip stage, continue pipeline
  }

  if (error.severity === ErrorSeverity.CRITICAL) {
    logger.error('Critical stage failure', { pipelineId, stage, error });
    return 'abort'; // Abort pipeline
  }
}
```

**Stage Criticality Map (from Architecture Section 4.2):**
```typescript
const stageCriticality = {
  'news-sourcing': 'CRITICAL',    // No topic = no video
  'research': 'CRITICAL',          // Foundation for script
  'script-gen': 'CRITICAL',        // Core content
  'pronunciation': 'DEGRADED',     // Quality issue if skipped
  'tts': 'CRITICAL',               // No audio = no video
  'visual-gen': 'DEGRADED',        // Simple fallback available
  'thumbnail': 'DEGRADED',         // Template OK but hurts CTR
  'render': 'CRITICAL',            // No video = no video
  'youtube': 'CRITICAL',           // Must publish
  'twitter': 'RECOVERABLE',        // Nice to have
  'notifications': 'RECOVERABLE'   // Nice to have, BUT ALWAYS RUNS
};
```

### State Persistence Pattern

**Firestore State Structure (from Architecture Section 3):**
```typescript
interface PipelineState {
  pipelineId: string;           // YYYY-MM-DD
  status: 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  currentStage: string | null;
  startTime: string;            // ISO 8601
  endTime?: string;
  stages: {
    [stageName: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
      startTime?: string;
      endTime?: string;
      durationMs?: number;
      provider?: {
        name: string;
        tier: 'primary' | 'fallback';
        attempts: number;
      };
      cost?: CostBreakdown;
      error?: {
        code: string;
        message: string;
        severity: string;
      };
      retryAttempts?: number;
    };
  };
  qualityContext: {
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
}
```

**State Update Pattern:**
```typescript
async function updateStageState(
  pipelineId: string,
  stageName: string,
  update: Partial<StageState>
): Promise<void> {
  try {
    await firestoreClient.updateDocument(
      'pipelines',
      pipelineId,
      {
        [`state.stages.${stageName}`]: update,
        'state.currentStage': stageName,
        'state.lastUpdated': new Date().toISOString()
      }
    );
  } catch (error) {
    logger.error('Failed to update stage state', {
      pipelineId,
      stageName,
      error: error.message
    });
    // Don't throw - state persistence failure shouldn't abort pipeline
  }
}
```

### Pipeline Resume Logic

**Resume Scenarios:**
1. **Orchestrator crash recovery**: Resume from last successful stage
2. **Manual intervention**: Operator reruns from specific stage
3. **Quality gate failure**: Fix issue, resume from failed stage

**Resume Implementation Pattern:**
```typescript
async function resumePipeline(
  pipelineId: string,
  fromStage?: string
): Promise<PipelineResult> {
  const state = await loadPipelineState(pipelineId);

  if (!state) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  // Determine resume point
  const resumeStage = fromStage || findNextStageAfterLastSuccess(state);

  logger.info('Resuming pipeline', {
    pipelineId,
    fromStage: resumeStage,
    completedStages: getCompletedStages(state)
  });

  // Execute from resume point
  return executePipelineFromStage(pipelineId, resumeStage, state);
}
```

### Provider Fallback Integration (FR43)

**From Architecture Section 4.1 (Provider Abstraction):**
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

**Fallback Tracking in Stage Output:**
```typescript
// When fallback is used
stageOutput.provider = {
  name: 'chirp3-hd',      // Which provider succeeded
  tier: 'fallback',        // Primary or fallback
  attempts: 2              // How many providers tried
};

// Add to quality context
stageOutput.quality.fallbacksUsed.push('tts');
```

### Quality Context Accumulation

**Quality Context Flows Through Pipeline:**
```typescript
// Stage 1: Clean start
const stage1Output = await executeStage1({ qualityContext: {} });

// Stage 2: Inherit context
const stage2Input = {
  ...stage1Data,
  qualityContext: {
    degradedStages: [],
    fallbacksUsed: [],
    flags: []
  }
};

// Stage 5: TTS uses fallback
const stage5Output = await executeTTS({
  ...stage4Data,
  qualityContext: stage4Output.quality
});
// stage5Output.quality.fallbacksUsed = ['tts']

// Stage 11: Full context for decision
await executeNotifications({
  ...stage10Data,
  qualityContext: {
    degradedStages: [],
    fallbacksUsed: ['tts'],
    flags: ['pronunciation-unknowns']
  }
});
```

### NOTIFY Stage Always Executes (FR45, NFR4)

**Critical Requirement:**
> NOTIFY stage must execute regardless of prior stage failures

**Implementation Pattern:**
```typescript
async function executePipeline(pipelineId: string): Promise<PipelineResult> {
  let pipelineAborted = false;
  let abortReason = '';

  try {
    // Execute stages 1-10
    for (const stageName of stageOrder.slice(0, -1)) {
      try {
        await executeStage(stageName, ...);
      } catch (error) {
        if (isCriticalStageFailure(stageName, error)) {
          pipelineAborted = true;
          abortReason = error.message;
          break; // Exit stage loop
        }
      }
    }
  } finally {
    // ALWAYS execute notifications, even if pipeline aborted
    try {
      await executeNotifications({
        pipelineId,
        previousStage: 'twitter',
        data: {
          pipelineAborted,
          abortReason,
          completedStages: getCompletedStages(state)
        },
        config: notificationConfig,
        qualityContext: state.qualityContext
      });
    } catch (notifyError) {
      logger.error('Notification stage failed', {
        pipelineId,
        error: notifyError.message
      });
      // Even notification failure shouldn't throw
    }
  }

  return buildPipelineResult(state, pipelineAborted);
}
```

### Stage Registry Integration (from Story 5.1)

**Stage Registry Structure (already exists):**
```typescript
// src/stages.ts
export const stageRegistry = {
  'news-sourcing': executeNewsSourcing,
  'research': executeResearch,
  'script-gen': executeScriptGen,
  'pronunciation': executePronunciation,
  'tts': executeTTS,
  'visual-gen': executeVisualGen,
  'thumbnail': executeThumbnail,
  'youtube': executeYouTubeUpload,  // Note: actual export name
  'twitter': executeTwitter,
  'notifications': executeNotifications
};

export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'visual-gen',
  'thumbnail',
  'youtube',
  'twitter',
  'notifications'
];
```

**Usage in executePipeline:**
```typescript
for (const stageName of stageOrder) {
  const stageFunction = stageRegistry[stageName];
  const stageOutput = await stageFunction(stageInput);
  // Process output...
}
```

### Render Stage Special Case

**Render is NOT a Stage Package:**
- Render is a separate Cloud Run service (`apps/render-service`)
- Called via HTTP from visual-gen stage
- Visual-gen stage handles render invocation

**From Story 3.6 (Render Service):**
> render endpoint `/render` accepts pipelineId, timelineUrl, audioUrl. Returns video URL.

**Visual-gen Integration:**
```typescript
// Inside @nexus-ai/visual-gen
const renderServiceUrl = process.env.RENDER_SERVICE_URL;
const response = await fetch(`${renderServiceUrl}/render`, {
  method: 'POST',
  body: JSON.stringify({
    pipelineId,
    timelineUrl: sceneTimelineUrl,
    audioUrl: audioFileUrl
  })
});
const { videoUrl } = await response.json();
```

### Logging Pattern for Pipeline Execution

**From Project Context (Critical Rules):**
> Structured logging - NEVER console.log. Use logger with context.

**Pipeline Execution Logging:**
```typescript
// Pipeline start
logger.info('Pipeline started', {
  pipelineId,
  triggeredBy: 'scheduler' | 'manual',
  timestamp: new Date().toISOString()
});

// Stage start
logger.info('Stage started', {
  pipelineId,
  stage: stageName,
  previousStage: input.previousStage
});

// Stage complete
logger.info('Stage completed', {
  pipelineId,
  stage: stageName,
  durationMs: output.durationMs,
  provider: output.provider,
  cost: output.cost.total,
  quality: output.quality
});

// Retry attempt
logger.warn('Stage retry', {
  pipelineId,
  stage: stageName,
  attemptNumber: 2,
  delayMs: 4000,
  error: error.code
});

// Fallback used
logger.warn('Stage completed with fallback provider', {
  pipelineId,
  stage: stageName,
  provider: output.provider.name,
  tier: 'fallback',
  attempts: output.provider.attempts
});

// Stage failed
logger.error('Stage failed', {
  pipelineId,
  stage: stageName,
  error: error.code,
  message: error.message,
  severity: error.severity,
  retryAttempts: 3
});

// Pipeline complete
logger.info('Pipeline completed', {
  pipelineId,
  status: 'success' | 'failed' | 'skipped',
  totalDurationMs,
  totalCost,
  degradedStages: qualityContext.degradedStages,
  fallbacksUsed: qualityContext.fallbacksUsed
});
```

### Cost Tracking Integration

**From Story 1.8 (Cost Tracking):**
```typescript
// Each stage output includes cost
interface StageOutput {
  cost: {
    service: string;  // 'gemini', 'tts', 'image'
    tokens?: number;
    cost: number;     // in dollars, 4 decimal places
    timestamp: string;
  };
}

// Pipeline aggregates costs
const totalCost = stageOutputs.reduce((sum, output) =>
  sum + output.cost.cost, 0
);

// Persist to Firestore
await firestoreClient.setDocument(
  'pipelines',
  pipelineId,
  {
    costs: {
      'news-sourcing': stage1Output.cost,
      'research': stage2Output.cost,
      // ... all stages
      total: totalCost
    }
  }
);
```

**Cost Alerts (from Architecture Section 6):**
- WARNING: cost >$0.75/video
- CRITICAL: cost >$1.00/video
- Implement in notification stage based on total pipeline cost

### NFR Requirements for Pipeline Execution

**NFR6: Total pipeline duration must be <4 hours (6:00 AM → 10:00 AM UTC)**
- Cloud Run timeout: 4 hours (14,400 seconds)
- Monitor total duration: `endTime - startTime`
- Log warning if duration >3.5 hours
- Alert if duration >4 hours (shouldn't happen due to timeout)

**NFR2: Pipeline must complete with 5+ hours buffer before scheduled publish**
- Pipeline starts: 6:00 AM UTC
- Publish time: 2:00 PM UTC (14:00 UTC)
- 8-hour window, need <4 hours pipeline = 4-hour buffer ✅

**NFR8: API retry latency must be <30 seconds between attempts**
- Exponential backoff maxDelay: 30 seconds
- Ensures quick retries for transient failures

### Testing Strategy

**Unit Tests (`src/__tests__/pipeline.test.ts`):**
```typescript
describe('executePipeline', () => {
  it('executes all stages sequentially', async () => {
    // Mock all stage functions
    // Assert each called in order
  });

  it('passes StageOutput to next StageInput', async () => {
    // Mock stages, verify data chaining
  });

  it('updates Firestore state after each stage', async () => {
    // Mock firestoreClient
    // Verify updateDocument called 10 times
  });

  it('accumulates qualityContext across stages', async () => {
    // Mock stages with fallbacks
    // Verify qualityContext grows
  });

  it('handles CRITICAL error by aborting pipeline', async () => {
    // Mock stage3 throws CRITICAL error
    // Verify pipeline aborts
    // Verify notifications still runs
  });

  it('handles RECOVERABLE error by continuing', async () => {
    // Mock twitter throws RECOVERABLE error
    // Verify pipeline continues to notifications
  });

  it('retries RETRYABLE errors up to 3 times', async () => {
    // Mock stage throws RETRYABLE twice, succeeds third
    // Verify 3 calls to stage function
  });

  it('always executes notifications stage', async () => {
    // Mock stage5 throws CRITICAL
    // Verify notifications called with aborted=true
  });
});

describe('resumePipeline', () => {
  it('resumes from last successful stage', async () => {
    // Mock state with stages 1-5 completed
    // Verify execution starts at stage 6
  });

  it('resumes from explicit fromStage', async () => {
    // Call resumePipeline(id, 'script-gen')
    // Verify starts at script-gen
  });
});
```

**Integration Test (`src/__tests__/pipeline.integration.test.ts`):**
```typescript
describe('Pipeline Integration', () => {
  it('executes full pipeline with mock stages', async () => {
    // Mock all 10 stages with realistic delays
    // Execute pipeline
    // Verify all stages called
    // Verify state persisted correctly
    // Verify costs aggregated
  });

  it('handles mid-pipeline failure and resume', async () => {
    // Execute pipeline, fail at stage 6
    // Resume from stage 6
    // Verify stages 1-5 skipped
    // Verify stages 6-10 executed
  });
});
```

### Key Learnings from Previous Stories

**From Story 5.1 Dev Notes:**
1. **Use FirestoreClient methods**: `getDocument`, `setDocument`, `updateDocument` (not raw Firestore)
2. **Stage registry uses actual export names**: e.g., `executeYouTubeUpload` not `executeYouTube`
3. **Pino logger signature**: `logger.info(message, context)` not `logger.info(context, message)`
4. **Try/catch Firestore writes**: Prevent state persistence failures from aborting pipeline

**From Story 4.5 (Twitter Package) Dev Notes:**
1. **TDD approach works well**: Write failing tests first
2. **Firestore path consistency**: Use `pipelines/{pipelineId}/{stage}` pattern
3. **Integration tests critical**: Mock API responses for realistic testing
4. **Error handling matters**: Try/catch for all external calls

**Common Patterns Established:**
- Modular structure: separate files for different concerns
- `__tests__/` directory for unit and integration tests
- Export all public APIs from `index.ts`
- Use JSDoc comments for public functions
- Type-safe inputs/outputs with TypeScript strict mode

### Git Intelligence - Recent Commit Patterns

**From Last 5 Commits:**
```
79b1008 feat(orchestrator): implement orchestrator service foundation (Story 5.1)
7dca2f6 feat(youtube): enhance error logging with structured logger
d9e4058 feat(twitter): Implement Twitter package for auto-posting video links
ae2fda7 feat(scheduler): implement scheduled publishing feature with Firestore integration
f73f5ce feat(youtube): implement thumbnail upload functionality
```

**Patterns Established:**
- Commit message format: `feat({package}): {description} (Story X.Y)` or `feat({package}): {description}`
- Recent focus on YouTube and Twitter packages
- Firestore integration pattern consistently used
- Testing included in all implementations
- Structured logging adopted project-wide

### Edge Cases to Handle

**1. Firestore Write Failures:**
- State persistence should not abort pipeline
- Log errors but continue execution
- Retry state writes on next stage

**2. Stage Timeout:**
- Cloud Run has 4-hour timeout
- Individual stages should timeout sooner
- Use AbortController for stage timeouts

**3. Render Service Unavailable:**
- Render is external HTTP call
- Can timeout or return 503
- Should retry with exponential backoff
- Mark as CRITICAL if all retries fail

**4. Concurrent Pipeline Execution:**
- Orchestrator has concurrency=1
- But manual trigger could be called during scheduled run
- Check if pipeline already running before starting
- Return 409 Conflict if already running

**5. Invalid Stage Order:**
- Ensure stage output types match next stage input types
- TypeScript should catch most mismatches
- Runtime validation for critical fields

### Implementation Priority

**Phase 1: Core Execution (Tasks 1-2)**
- Implement `executePipeline()` with basic sequential execution
- Add retry logic with exponential backoff
- Get end-to-end execution working

**Phase 2: Error Handling (Tasks 3-5)**
- Integrate provider fallback chains
- Implement severity-based error routing
- Ensure state persistence
- Guarantee NOTIFY always runs

**Phase 3: Resume & Integration (Tasks 6-8)**
- Implement resume logic
- Update handlers to call pipeline
- Write comprehensive tests
- Validate all NFRs met

### References

**Source Documents:**
- [Epic 5, Story 5.2: Pipeline Execution](/_bmad-output/planning-artifacts/epics.md#L1569-L1607) - Full story requirements
- [Architecture: Decision 1 - Central Orchestrator](/_bmad-output/planning-artifacts/architecture.md#L180-L197) - Orchestration pattern
- [Architecture: Decision 5 - Error Handling Strategy](/_bmad-output/planning-artifacts/architecture.md#L308-L348) - Error severity routing
- [Architecture: Section 4.3 - Process Patterns](/_bmad-output/planning-artifacts/architecture.md#L546-L590) - Stage execution pattern
- [Story 5.1: Orchestrator Service](/_bmad-output/implementation-artifacts/5-1-create-orchestrator-service.md) - Foundation built in previous story
- [Project Context: Critical Rules](/_bmad-output/project-context.md#L31-L148) - Must-follow patterns

**Related Stories:**
- [Story 1.4: Retry and Fallback Utilities](/_bmad-output/planning-artifacts/epics.md#L439-L466) - Utilities used in pipeline
- [Story 1.9: Quality Gate Framework](/_bmad-output/planning-artifacts/epics.md#L593-L623) - Quality gate integration
- [Story 1.10: Execute Stage Wrapper](/_bmad-output/planning-artifacts/epics.md#L625-L662) - Stage execution pattern

**External Resources:**
- [Cloud Run Timeout Configuration](https://cloud.google.com/run/docs/configuring/request-timeout) - 4-hour max timeout
- [Firestore Best Practices](https://cloud.google.com/firestore/docs/best-practices) - State persistence patterns

### Implementation Checklist

**Before Starting:**
- [x] Story 5.1 completed and merged
- [ ] All 10 stage packages exist and export correct functions
- [ ] `@nexus-ai/core` has `executeStage`, `withRetry`, `withFallback` utilities
- [ ] Firestore client methods verified: `getDocument`, `setDocument`, `updateDocument`

**During Implementation:**
- [ ] Follow TypeScript strict mode (no `any` types)
- [ ] Use structured logging (no `console.log`)
- [ ] Try/catch all Firestore writes
- [ ] Log all retry attempts
- [ ] Log all fallback usage
- [ ] Track costs for all stages
- [ ] Accumulate quality context
- [ ] Ensure NOTIFY always runs
- [ ] Handle concurrent execution check

**After Implementation:**
- [ ] All unit tests passing (>20 tests expected)
- [ ] Integration tests passing (full pipeline mock)
- [ ] TypeScript compilation successful
- [ ] ESLint no errors
- [ ] Update sprint-status.yaml
- [ ] Mark story as review
- [ ] Ready for code review (Story 5.2 → review, Story 5.3 next)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: All types verified, no errors
- Test execution: 58 tests passing (6 test files)
- No runtime errors during implementation

### Completion Notes List

1. **Core Pipeline Executor (Task 1)**: Implemented `executePipeline()` function with:
   - Sequential stage execution loop following stageOrder
   - StageOutput → StageInput data chaining between stages
   - Firestore state initialization and updates via PipelineStateManager
   - Complete PipelineResult type with all stage outputs, costs, quality context

2. **Retry Logic (Task 2)**: Integrated `withRetry` from @nexus-ai/core:
   - Per-stage retry configuration (maxRetries: 2-5, baseDelay: 1000-3000ms)
   - Exponential backoff with jitter (max 30s delay)
   - Retry logging with pipelineId, stage, attemptNumber, delayMs
   - Original error severity preserved through context.originalSeverity

3. **Provider Fallback Chains (Task 3)**: Implemented fallback tracking:
   - `qualityContext.fallbacksUsed[]` populated with "stage:provider" format
   - Warning logged when fallback provider used
   - StageOutput.provider.tier tracked as 'primary' | 'fallback'

4. **State Persistence (Task 4)**: Using PipelineStateManager from Story 5.1:
   - State updates wrapped in try/catch (non-fatal)
   - currentStage updated during execution
   - qualityContext accumulated across stages
   - All writes gracefully handle failures

5. **Error Handling Strategy (Task 5)**: Severity-based routing implemented:
   - CRITICAL: Abort pipeline immediately
   - RECOVERABLE: Skip stage, continue pipeline, add to skippedStages
   - DEGRADED: Continue with quality flag in degradedStages
   - RETRYABLE: Handled by withRetry wrapper
   - Stage criticality map determines abort behavior per stage

6. **Pipeline Resume Logic (Task 6)**: Implemented `resumePipeline()`:
   - Loads existing state from Firestore
   - Finds last completed stage index
   - Supports explicit fromStage parameter
   - Skips already-completed stages
   - Preserves existing qualityContext

7. **Handler Integration (Task 7)**: Updated handlers:
   - scheduled.ts: Async execution with 202 Accepted response
   - manual.ts: Supports wait=true for sync execution, added handleResumeTrigger
   - index.ts: Added /trigger/resume route

8. **Testing (Task 8)**: 58 tests across 6 test files:
   - pipeline.test.ts: 18 unit tests for executePipeline, error handling, retry
   - pipeline.integration.test.ts: 10 integration tests for full pipeline scenarios
   - handlers.test.ts: 13 tests including new resume handler tests
   - All existing tests continue to pass

### File List

**Files Created:**
- apps/orchestrator/src/__tests__/pipeline.test.ts - Unit tests for pipeline execution
- apps/orchestrator/src/__tests__/pipeline.integration.test.ts - Integration tests

**Files Modified:**
- apps/orchestrator/src/pipeline.ts - Replaced stub with full `executePipeline()` and `resumePipeline()` implementations (~830 lines)
- apps/orchestrator/src/handlers/scheduled.ts - Calls `executePipeline()` with async execution
- apps/orchestrator/src/handlers/manual.ts - Added `handleResumeTrigger()`, sync/async execution support
- apps/orchestrator/src/index.ts - Added /trigger/resume route
- apps/orchestrator/src/__tests__/handlers.test.ts - Updated tests for new handler behavior
- _bmad-output/implementation-artifacts/5-2-implement-pipeline-execution.md - This story file
