---
project_name: 'youtube-automation'
product_name: 'NEXUS-AI'
user_name: 'Conan'
date: '2026-01-07'
source_document: '_bmad-output/planning-artifacts/architecture.md'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing NEXUS-AI. Read before writing any code._

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Monorepo | Turborepo + pnpm | Latest |
| Language | TypeScript | Strict mode |
| Runtime | Node.js | 20.x LTS |
| Video | Remotion | 4.x |
| Testing | Vitest | Latest |
| Cloud | GCP | Cloud Run, Functions, Firestore, Storage |
| LLM | Gemini 3 Pro | gemini-3-pro-preview |
| TTS | Gemini TTS | gemini-2.5-pro-tts (primary) |
| Fallback TTS | Chirp 3 HD, WaveNet | In order |

---

## CRITICAL RULES (MUST FOLLOW)

### 1. Every External API Call: Retry + Fallback

```typescript
// REQUIRED pattern for ALL external calls
const result = await withRetry(
  () => withFallback(providers, (p) => p.execute(data)),
  { maxRetries: 3, stage: 'tts' }
);
```

**NEVER do this:**
```typescript
// WRONG: Direct SDK call
const result = await geminiClient.generate(prompt);
```

### 2. Every Stage: StageInput/StageOutput Contracts

```typescript
// REQUIRED: All stages use typed contracts
interface StageInput<T> {
  pipelineId: string;        // YYYY-MM-DD
  previousStage: string | null;
  data: T;
  config: StageConfig;
  qualityContext?: {
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

### 3. Every Stage: Call Quality Gate Before Returning

```typescript
// REQUIRED at end of every stage
const gateResult = await qualityGate.check(stageName, output);
if (gateResult.status === 'FAIL') {
  throw NexusError.degraded('NEXUS_QUALITY_GATE_FAIL', gateResult.reason, stageName);
}
```

**Quality gates per stage:**
| Stage | Checks |
|-------|--------|
| script-gen | Word count 1200-1800 |
| tts | Silence <5%, no clipping |
| render | Zero frame drops, audio sync <100ms |
| thumbnail | 3 variants generated |

### 4. Every Stage: Track Costs via CostTracker

```typescript
// REQUIRED: Track all API costs
const tracker = new CostTracker(pipelineId, stageName);
tracker.recordApiCall('gemini-3-pro', tokens, cost);
// Costs automatically persisted to Firestore
```

### 5. NEVER Use console.log - Use Structured Logger

```typescript
// WRONG
console.log('Processing script...');

// CORRECT
import { logger } from '@nexus-ai/core';
logger.info('Processing script', {
  pipelineId,
  stage: 'script-gen',
  wordCount
});
```

**Logger naming:** `nexus.{package}.{module}`

### 6. NEVER Hardcode Credentials - Use Secret Manager

```typescript
// WRONG
const apiKey = 'sk-abc123...';

// CORRECT
import { getSecret } from '@nexus-ai/core';
const apiKey = await getSecret('nexus-gemini-api-key');
```

**Secret naming:** `nexus-{service}-{purpose}`

### 7. NEVER Publish Without Quality Gate Pass

```typescript
// Pre-publish check in orchestrator
const decision = qualityGateCheck(pipelineRun);
if (decision === 'HUMAN_REVIEW') {
  await queueForReview(pipelineRun);
  return; // DO NOT PUBLISH
}
```

---

## PATTERNS TO ENFORCE

### Provider Abstraction

All external services use interface-based abstraction:

```typescript
interface TTSProvider {
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  getVoices(): Promise<Voice[]>;
  estimateCost(text: string): number;
}

interface LLMProvider {
  generate(prompt: string, options: LLMOptions): Promise<LLMResult>;
}
```

**Provider registry:**
```typescript
const providers = {
  llm: {
    primary: GeminiProvider('gemini-3-pro-preview'),
    fallbacks: [GeminiProvider('gemini-2.5-pro')]
  },
  tts: {
    primary: GeminiTTSProvider('gemini-2.5-pro-tts'),
    fallbacks: [ChirpProvider('chirp3-hd'), WaveNetProvider()]
  }
};
```

### Error Classes with Severity Levels

```typescript
enum ErrorSeverity {
  RETRYABLE,    // Transient: timeout, rate limit, 503
  FALLBACK,     // Provider issue: use next in chain
  DEGRADED,     // Can continue but quality compromised
  RECOVERABLE,  // Stage failed, pipeline continues
  CRITICAL      // Must abort: no recovery possible
}

class NexusError extends Error {
  code: string;              // NEXUS_TTS_TIMEOUT
  severity: ErrorSeverity;
  stage?: string;
  retryable: boolean;
  context?: Record<string, unknown>;

  static retryable(code, message, stage, context?);
  static critical(code, message, stage, context?);
  static degraded(code, message, stage, context?);
}
```

**Error code format:** `NEXUS_{DOMAIN}_{TYPE}`

### Structured Logging with Pipeline/Stage Labels

```typescript
// Every log MUST include:
logger.info('Stage complete', {
  pipelineId: '2026-01-08',      // ALWAYS
  stage: 'tts',                   // ALWAYS
  durationMs: 4523,
  provider: 'gemini-2.5-pro-tts',
  tier: 'primary',
  cost: 0.0023
});
```

### Quality Tier Tracking

```typescript
// Track in every StageOutput
provider: {
  name: 'chirp3-hd',
  tier: 'fallback',  // 'primary' | 'fallback'
  attempts: 2
}

// Accumulate in qualityContext
qualityContext: {
  degradedStages: ['pronunciation'],
  fallbacksUsed: ['tts:chirp3-hd', 'thumbnail:template'],
  flags: ['word-count-low']
}
```

---

## ANTI-PATTERNS TO REJECT

### Direct SDK Calls Without Retry Wrapper

```typescript
// REJECT THIS
const response = await gemini.generateContent(prompt);

// REQUIRE THIS
const response = await withRetry(
  () => geminiProvider.generate(prompt),
  { maxRetries: 3, stage: 'script-gen' }
);
```

### Missing Quality Gate Checks

```typescript
// REJECT: Stage returns without quality check
return { success: true, data: output };

// REQUIRE: Quality gate before return
const gate = await qualityGate.check('tts', output);
return { success: true, data: output, quality: gate.metrics };
```

### Untyped Stage Inputs/Outputs

```typescript
// REJECT
async function executeStage(input: any): Promise<any>

// REQUIRE
async function executeTTS(
  input: StageInput<TTSInput>
): Promise<StageOutput<TTSOutput>>
```

### Hardcoded API Keys or Secrets

```typescript
// REJECT - Hardcoded
const client = new Client({ apiKey: 'abc123' });

// REJECT - Environment variable in code
const client = new Client({ apiKey: process.env.API_KEY });

// REQUIRE - Secret Manager
const apiKey = await getSecret('nexus-gemini-api-key');
const client = new Client({ apiKey });
```

### console.log Statements

```typescript
// REJECT - Any console usage
console.log('Debug:', data);
console.error('Error:', err);

// REQUIRE - Structured logger
logger.debug('Processing', { data });
logger.error('Stage failed', { error: err, pipelineId, stage });
```

### Ignoring Fallback Results

```typescript
// REJECT - Not tracking fallback usage
const audio = await tryProviders([gemini, chirp, wavenet]);

// REQUIRE - Track which provider succeeded
const { result, provider, tier } = await withFallback(
  [gemini, chirp, wavenet],
  (p) => p.synthesize(text),
  { stage: 'tts' }
);
// Use tier in StageOutput
```

---

## GCP SPECIFICS

### Firestore Document Paths

```
pipelines/{YYYY-MM-DD}/state
pipelines/{YYYY-MM-DD}/artifacts
pipelines/{YYYY-MM-DD}/costs
pipelines/{YYYY-MM-DD}/quality
pipelines/{YYYY-MM-DD}/youtube

pronunciation/{term}
topics/{YYYY-MM-DD}
buffer-videos/{id}
incidents/{id}
```

### Cloud Storage Paths

```
gs://nexus-ai-artifacts/{date}/{stage}/{file}

Examples:
gs://nexus-ai-artifacts/2026-01-08/research/research.md
gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav
gs://nexus-ai-artifacts/2026-01-08/render/video.mp4
gs://nexus-ai-artifacts/2026-01-08/thumbnails/1.png
```

### Secret Manager Names

```
nexus-gemini-api-key
nexus-youtube-oauth
nexus-twitter-oauth
nexus-discord-webhook
```

### Environment Variables

Prefix all with `NEXUS_`:
```
NEXUS_GEMINI_API_KEY
NEXUS_PROJECT_ID
NEXUS_BUCKET_NAME
NEXUS_FIRESTORE_DATABASE
```

---

## NAMING CONVENTIONS

| Element | Convention | Example |
|---------|------------|---------|
| Interfaces | PascalCase | `StageOutput`, `TTSProvider` |
| Functions | camelCase | `withRetry`, `executeStage` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `execute-stage.ts`, `with-retry.ts` |
| Packages | @nexus-ai/kebab | `@nexus-ai/core`, `@nexus-ai/tts` |
| Error codes | NEXUS_{DOMAIN}_{TYPE} | `NEXUS_TTS_TIMEOUT` |
| Logger names | nexus.{pkg}.{mod} | `nexus.tts.synthesis` |

---

## STAGE EXECUTION TEMPLATE

Every stage follows this pattern:

```typescript
import {
  StageInput, StageOutput,
  withRetry, withFallback,
  logger, CostTracker, qualityGate,
  NexusError
} from '@nexus-ai/core';

export async function execute{Stage}(
  input: StageInput<{Stage}Input>
): Promise<StageOutput<{Stage}Output>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, '{stage}');

  logger.info('Stage started', {
    pipelineId: input.pipelineId,
    stage: '{stage}'
  });

  try {
    // Execute with retry + fallback
    const { result, provider, tier, attempts } = await withRetry(
      () => withFallback(providers, (p) => p.execute(input.data)),
      { maxRetries: 3, stage: '{stage}' }
    );

    // Track costs
    tracker.recordApiCall(provider, result.tokens, result.cost);

    // Quality gate check
    const gate = await qualityGate.check('{stage}', result);

    const output: StageOutput<{Stage}Output> = {
      success: true,
      data: result,
      quality: gate.metrics,
      cost: tracker.getSummary(),
      durationMs: Date.now() - startTime,
      provider: { name: provider, tier, attempts },
      warnings: gate.warnings
    };

    logger.info('Stage complete', {
      pipelineId: input.pipelineId,
      stage: '{stage}',
      durationMs: output.durationMs,
      provider: output.provider
    });

    return output;

  } catch (error) {
    logger.error('Stage failed', {
      pipelineId: input.pipelineId,
      stage: '{stage}',
      error
    });
    throw NexusError.fromError(error, '{stage}');
  }
}
```

---

## QUICK REFERENCE

**Before writing any stage code, verify:**
- [ ] Using `StageInput<T>` / `StageOutput<T>` types
- [ ] Wrapping API calls with `withRetry` + `withFallback`
- [ ] Calling quality gate before returning
- [ ] Tracking costs via `CostTracker`
- [ ] Using structured logger (no console.log)
- [ ] Getting secrets from Secret Manager
- [ ] Following naming conventions
- [ ] Including `provider.tier` in output

**Pipeline ID format:** `YYYY-MM-DD` (e.g., `2026-01-08`)
**Publish time:** 14:00 UTC daily
**Cost target:** <$0.50/video (credit period), <$1.50/video (post-credit)
