# Story 1.5: Implement Provider Abstraction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want abstracted provider implementations for LLM, TTS, and Image generation,
So that I can swap providers without changing stage code.

## Acceptance Criteria

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

## Tasks / Subtasks

- [x] Implement GeminiLLMProvider class (AC: LLM Provider)
  - [x] Create providers/llm/gemini-llm-provider.ts
  - [x] Constructor accepts model name (default: 'gemini-3-pro-preview')
  - [x] Implement generate(prompt, options) using Google AI SDK
  - [x] Wrap SDK call with withRetry utility
  - [x] Return LLMResult with text, tokens (input/output), cost, model, quality
  - [x] Implement estimateCost(prompt) for cost estimation before call
  - [x] Add `name` property for withFallback compatibility
  - [x] Handle API errors and wrap in NexusError

- [x] Implement GeminiTTSProvider class (AC: TTS Provider)
  - [x] Create providers/tts/gemini-tts-provider.ts
  - [x] Constructor accepts model name (default: 'gemini-2.5-pro-tts')
  - [x] Implement synthesize(text, options) using Google Cloud TTS API
  - [x] Wrap SDK call with withRetry utility
  - [x] Return TTSResult with audioUrl, durationSec, cost, model, quality, codec, sampleRate
  - [x] Implement getVoices() to fetch available voices
  - [x] Implement estimateCost(text) for cost estimation
  - [x] Add `name` property for withFallback compatibility

- [x] Implement ChirpProvider class (AC: TTS Fallback 1)
  - [x] Create providers/tts/chirp-provider.ts
  - [x] Constructor accepts model name (default: 'chirp3-hd')
  - [x] Implement same TTSProvider interface
  - [x] Wrap SDK call with withRetry utility
  - [x] Add `name` property for withFallback compatibility

- [x] Implement WaveNetProvider class (AC: TTS Fallback 2)
  - [x] Create providers/tts/wavenet-provider.ts
  - [x] Constructor accepts model name (default: 'wavenet')
  - [x] Implement same TTSProvider interface
  - [x] Wrap SDK call with withRetry utility
  - [x] Add `name` property for withFallback compatibility

- [x] Implement GeminiImageProvider class (AC: Image Provider)
  - [x] Create providers/image/gemini-image-provider.ts
  - [x] Constructor accepts model name (default: 'gemini-3-pro-image-preview')
  - [x] Implement generate(prompt, options) for thumbnail generation
  - [x] Wrap SDK call with withRetry utility
  - [x] Return ImageResult with imageUrls (array), cost, model, quality
  - [x] Implement estimateCost(prompt, options) for cost estimation
  - [x] Add `name` property for withFallback compatibility

- [x] Implement TemplateThumbnailer class (AC: Image Fallback)
  - [x] Create providers/image/template-thumbnailer.ts
  - [x] Implements ImageProvider interface as fallback
  - [x] Uses pre-designed template images from data/templates/thumbnails/
  - [x] Overlays topic title text programmatically
  - [x] Add `name` property for withFallback compatibility

- [x] Create getSecret placeholder (AC: Secret retrieval)
  - [x] Create secrets/get-secret.ts with placeholder implementation
  - [x] For local dev: read from NEXUS_* environment variables
  - [x] Log warning that actual Secret Manager will be in Story 1.6
  - [x] Export from @nexus-ai/core

- [x] Define provider registry (AC: Provider registry)
  - [x] Create providers/registry.ts with provider chains
  - [x] Define llm.primary and llm.fallbacks
  - [x] Define tts.primary and tts.fallbacks
  - [x] Define image.primary and image.fallbacks
  - [x] Export createProviderRegistry() factory function

- [x] Configure package exports (AC: Exports)
  - [x] Export all providers from providers/index.ts
  - [x] Export provider registry from providers/index.ts
  - [x] Export getSecret from secrets/index.ts
  - [x] Ensure @nexus-ai/core exports all providers

- [x] Write comprehensive tests (AC: Unit tests)
  - [x] Test GeminiLLMProvider generate and estimateCost
  - [x] Test GeminiTTSProvider synthesize, getVoices, estimateCost
  - [x] Test GeminiImageProvider generate and estimateCost
  - [x] Test provider registry creation
  - [x] Test getSecret placeholder
  - [x] Test all providers have `name` property
  - [x] Mock Google SDK calls for unit tests

## Dev Notes

### Relevant Architecture Patterns

**Provider Abstraction (from Architecture):**
- Interface-based abstraction with fallback chains
- All providers must implement standard interfaces from types/providers.ts
- Providers must have `name` property for withFallback tracking
- Every API call wrapped with `withRetry` from Story 1.4

**Provider Registry (from Architecture):**
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

**TTS Strategy (Quality Priority from Architecture):**
- **Primary:** `gemini-2.5-pro-tts` - Best quality Google TTS (GA Sept 2025)
  - 30 speakers, 80+ locales
  - Natural language control for style, accent, pace, emotion
  - Multi-speaker synthesis support
- **Fallback 1:** Chirp 3 HD voices (quota issues)
- **Fallback 2:** WaveNet (last resort)
- **Rationale:** Voice quality directly impacts viewer retention

**Naming Conventions (from Architecture):**
- Files: kebab-case (e.g., `gemini-llm-provider.ts`)
- Classes: PascalCase (e.g., `GeminiLLMProvider`)
- Interfaces: PascalCase (e.g., `LLMProvider`)
- Error codes: `NEXUS_{DOMAIN}_{TYPE}` (e.g., `NEXUS_LLM_API_ERROR`)

### Technical Requirements (from Architecture)

**Provider Interface Implementations:**

```typescript
// packages/core/src/providers/llm/gemini-llm-provider.ts
import { LLMProvider, LLMOptions, LLMResult } from '../../types';
import { withRetry, RetryOptions } from '../../utils';
import { NexusError } from '../../errors';
import { getSecret } from '../../secrets';

export class GeminiLLMProvider implements LLMProvider {
  readonly name: string;
  private model: string;

  constructor(model: string = 'gemini-3-pro-preview') {
    this.model = model;
    this.name = model; // For withFallback tracking
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const apiKey = await getSecret('nexus-gemini-api-key');

    return withRetry(
      async () => {
        // Google AI SDK call
        // const response = await genAI.generateContent(...);

        return {
          text: '...',
          tokens: { input: 0, output: 0 },
          cost: 0.0,
          model: this.model,
          quality: 'primary' as const
        };
      },
      {
        maxRetries: 3,
        stage: 'llm',
        baseDelay: 1000,
        maxDelay: 30000
      }
    ).then(result => result.result);
  }

  estimateCost(prompt: string): number {
    // Estimate based on token count
    // ~$0.00125/1K input tokens, ~$0.005/1K output tokens (Gemini 3 Pro)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = 2000; // Average script length
    return (estimatedInputTokens / 1000) * 0.00125 + (estimatedOutputTokens / 1000) * 0.005;
  }
}
```

**TTS Provider Implementation:**
```typescript
// packages/core/src/providers/tts/gemini-tts-provider.ts
import { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types';
import { withRetry } from '../../utils';
import { NexusError } from '../../errors';
import { getSecret } from '../../secrets';

export class GeminiTTSProvider implements TTSProvider {
  readonly name: string;
  private model: string;

  constructor(model: string = 'gemini-2.5-pro-tts') {
    this.model = model;
    this.name = model;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const apiKey = await getSecret('nexus-gemini-api-key');

    return withRetry(
      async () => {
        // Google Cloud TTS API call
        // - 44.1kHz WAV format
        // - SSML support
        // - Voice selection

        return {
          audioUrl: 'gs://nexus-ai-artifacts/...',
          durationSec: 0,
          cost: 0.0,
          model: this.model,
          quality: 'primary' as const,
          codec: 'wav' as const,
          sampleRate: 44100
        };
      },
      {
        maxRetries: 3,
        stage: 'tts',
        baseDelay: 1000,
        maxDelay: 30000
      }
    ).then(result => result.result);
  }

  async getVoices(): Promise<Voice[]> {
    // Return available voices for gemini-2.5-pro-tts
    return [];
  }

  estimateCost(text: string): number {
    // Estimate based on character count
    // ~$0.000016/character for Gemini TTS
    return text.length * 0.000016;
  }
}
```

**Image Provider Implementation:**
```typescript
// packages/core/src/providers/image/gemini-image-provider.ts
import { ImageProvider, ImageOptions, ImageResult } from '../../types';
import { withRetry } from '../../utils';
import { NexusError } from '../../errors';
import { getSecret } from '../../secrets';

export class GeminiImageProvider implements ImageProvider {
  readonly name: string;
  private model: string;

  constructor(model: string = 'gemini-3-pro-image-preview') {
    this.model = model;
    this.name = model;
  }

  async generate(prompt: string, options: ImageOptions = {}): Promise<ImageResult> {
    const apiKey = await getSecret('nexus-gemini-api-key');
    const count = options.count ?? 3; // NFR22: 3 variants

    return withRetry(
      async () => {
        // Google AI Image Generation
        // - 1280x720 for YouTube thumbnails
        // - Generate `count` variants

        return {
          imageUrls: [],
          cost: 0.0,
          model: this.model,
          quality: 'primary' as const,
          generatedAt: new Date().toISOString()
        };
      },
      {
        maxRetries: 3,
        stage: 'image',
        baseDelay: 1000,
        maxDelay: 30000
      }
    ).then(result => result.result);
  }

  estimateCost(prompt: string, options?: ImageOptions): number {
    // ~$0.04/image for Gemini 3 Pro Image
    const count = options?.count ?? 3;
    return count * 0.04;
  }
}
```

**Provider Registry:**
```typescript
// packages/core/src/providers/registry.ts
import { GeminiLLMProvider } from './llm/gemini-llm-provider';
import { GeminiTTSProvider } from './tts/gemini-tts-provider';
import { ChirpProvider } from './tts/chirp-provider';
import { WaveNetProvider } from './tts/wavenet-provider';
import { GeminiImageProvider } from './image/gemini-image-provider';
import { TemplateThumbnailer } from './image/template-thumbnailer';
import { LLMProvider, TTSProvider, ImageProvider } from '../types';

export interface ProviderChain<T> {
  primary: T;
  fallbacks: T[];
}

export interface ProviderRegistry {
  llm: ProviderChain<LLMProvider>;
  tts: ProviderChain<TTSProvider>;
  image: ProviderChain<ImageProvider>;
}

export function createProviderRegistry(): ProviderRegistry {
  return {
    llm: {
      primary: new GeminiLLMProvider('gemini-3-pro-preview'),
      fallbacks: [new GeminiLLMProvider('gemini-2.5-pro')]
    },
    tts: {
      primary: new GeminiTTSProvider('gemini-2.5-pro-tts'),
      fallbacks: [new ChirpProvider(), new WaveNetProvider()]
    },
    image: {
      primary: new GeminiImageProvider('gemini-3-pro-image-preview'),
      fallbacks: [new TemplateThumbnailer()]
    }
  };
}
```

**Secret Management Placeholder:**
```typescript
// packages/core/src/secrets/get-secret.ts

/**
 * Get secret value from Secret Manager or environment variable
 *
 * PLACEHOLDER: This reads from environment variables for local development.
 * Story 1.6 will implement actual GCP Secret Manager integration.
 *
 * @param secretName - Secret name (e.g., 'nexus-gemini-api-key')
 * @returns Secret value
 */
export async function getSecret(secretName: string): Promise<string> {
  // Convert secret name to env var format
  // nexus-gemini-api-key -> NEXUS_GEMINI_API_KEY
  const envVarName = secretName.toUpperCase().replace(/-/g, '_');

  const value = process.env[envVarName];

  if (!value) {
    // In development, warn but don't fail
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[getSecret] Secret '${secretName}' not found. ` +
        `Set environment variable ${envVarName} or wait for Story 1.6 (GCP Secret Manager).`
      );
    }
    throw new Error(`Secret '${secretName}' not found`);
  }

  return value;
}
```

### Project Structure Notes

**File Location:**
```
packages/core/src/
├── providers/
│   ├── index.ts              # Barrel exports
│   ├── registry.ts           # Provider registry factory
│   ├── llm/
│   │   ├── index.ts
│   │   ├── gemini-llm-provider.ts
│   │   └── __tests__/
│   │       └── gemini-llm-provider.test.ts
│   ├── tts/
│   │   ├── index.ts
│   │   ├── gemini-tts-provider.ts
│   │   ├── chirp-provider.ts
│   │   ├── wavenet-provider.ts
│   │   └── __tests__/
│   │       ├── gemini-tts-provider.test.ts
│   │       ├── chirp-provider.test.ts
│   │       └── wavenet-provider.test.ts
│   └── image/
│       ├── index.ts
│       ├── gemini-image-provider.ts
│       ├── template-thumbnailer.ts
│       └── __tests__/
│           ├── gemini-image-provider.test.ts
│           └── template-thumbnailer.test.ts
├── secrets/
│   ├── index.ts
│   ├── get-secret.ts
│   └── __tests__/
│       └── get-secret.test.ts
├── types/                    # EXISTS (from Story 1.2)
├── errors/                   # EXISTS (from Story 1.3)
├── utils/                    # EXISTS (from Story 1.4)
└── index.ts                  # Main package export - add providers export
```

**Export Configuration:**
- `@nexus-ai/core` exports all providers and getSecret
- `@nexus-ai/core/providers` direct access to providers module (optional)
- `@nexus-ai/core/secrets` direct access to secrets module (optional)

### Previous Story Intelligence (1.4)

**What Was Established:**
- `withRetry` utility with exponential backoff and jitter
- `withFallback` utility for provider chain with tier tracking
- `RetryOptions`, `RetryResult` types
- `FallbackOptions`, `FallbackResult`, `FallbackAttempt` types
- `NamedProvider` interface - providers must have `name` property
- All utilities in `packages/core/src/utils/`
- 63 tests for utilities, all passing

**Patterns to Follow:**
- All API calls wrapped with `withRetry`
- Provider classes must have `name` property for `withFallback`
- Use `NexusError.fromError()` to wrap SDK errors
- Tests co-located in `__tests__/` directories
- Vitest for testing with describe/it/expect pattern

**Integration Points:**
- Providers use `withRetry` for resilience
- Provider registry used with `withFallback` in stages
- `getSecret` called for API keys
- Future: Story 1.6 replaces getSecret placeholder with real Secret Manager

### Git Intelligence (Recent Commits)

**Last Commit (c55fa1a):**
- Implemented retry and fallback utilities for Story 1.4
- 63 tests added, all 338 tests passing
- withRetry, withFallback, sleep, calculateDelay available
- Error codes: NEXUS_RETRY_EXHAUSTED, NEXUS_FALLBACK_EXHAUSTED

**Files to Integrate With:**
- `packages/core/src/utils/with-retry.ts` - withRetry function
- `packages/core/src/utils/with-fallback.ts` - withFallback function
- `packages/core/src/types/providers.ts` - LLMProvider, TTSProvider, ImageProvider interfaces
- `packages/core/src/errors/nexus-error.ts` - NexusError class
- `packages/core/src/index.ts` - Package exports

**Existing Provider Types (from Story 1.2):**
- `LLMProvider` interface with `generate()`, `estimateCost()`
- `TTSProvider` interface with `synthesize()`, `getVoices()`, `estimateCost()`
- `ImageProvider` interface with `generate()`, `estimateCost()`
- `LLMResult`, `TTSResult`, `ImageResult` types defined
- `LLMOptions`, `TTSOptions`, `ImageOptions` types defined

**Commit Message Pattern:**
```
feat(core): implement provider abstraction layer

Complete Story 1-5: Implement Provider Abstraction

- Create GeminiLLMProvider implementing LLMProvider interface
- Create GeminiTTSProvider, ChirpProvider, WaveNetProvider for TTS
- Create GeminiImageProvider, TemplateThumbnailer for images
- Define provider registry with primary/fallback chains
- Add getSecret placeholder for API key retrieval
- All providers use withRetry for resilience
- Comprehensive unit tests (X tests, all passing)

All acceptance criteria met. Ready for Story 1.6.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### References

- [Epic 1: Story 1.5 Acceptance Criteria](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/epics.md#story-15-implement-provider-abstraction)
- [Architecture: Provider Abstraction](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#4-external-api-client-pattern-provider-abstraction)
- [Project Context: Provider Abstraction](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/project-context.md#provider-abstraction)
- [Story 1.2: Provider Interfaces](file:///D:/05_Work/NEXUS-AI-PROJECT/packages/core/src/types/providers.ts)
- [Story 1.4: Retry/Fallback Utilities](file:///D:/05_Work/NEXUS-AI-PROJECT/packages/core/src/utils/with-retry.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Implemented complete provider abstraction layer with 6 providers (GeminiLLMProvider, GeminiTTSProvider, ChirpProvider, WaveNetProvider, GeminiImageProvider, TemplateThumbnailer)
- All providers implement their respective interfaces with `name` property for withFallback compatibility
- All provider API calls wrapped with `withRetry` utility for resilience
- Created `getSecret` placeholder that reads from environment variables (NEXUS_* format)
- Implemented `createProviderRegistry()` factory with primary/fallback chains per architecture spec
- Added `name` property to LLMProvider, TTSProvider, ImageProvider interfaces in types/providers.ts
- 82 new provider-related tests added (420 total tests, all passing)
- TypeScript build passes successfully

### Code Review Fixes Applied (2026-01-10)

- **[HIGH]** Removed console.warn from getSecret - replaced with TODO for structured logging (Story 1.6)
- **[HIGH]** Fixed ImageProvider.generate() interface to make options parameter optional (matching implementation)
- **[MEDIUM]** Added input validation to all providers - empty prompts/text now throw NEXUS_*_INVALID_INPUT errors
- Added 9 new validation tests for input validation coverage

### File List

**New Files:**
- packages/core/src/providers/index.ts
- packages/core/src/providers/registry.ts
- packages/core/src/providers/llm/index.ts
- packages/core/src/providers/llm/gemini-llm-provider.ts
- packages/core/src/providers/llm/__tests__/gemini-llm-provider.test.ts
- packages/core/src/providers/tts/index.ts
- packages/core/src/providers/tts/gemini-tts-provider.ts
- packages/core/src/providers/tts/chirp-provider.ts
- packages/core/src/providers/tts/wavenet-provider.ts
- packages/core/src/providers/tts/__tests__/gemini-tts-provider.test.ts
- packages/core/src/providers/tts/__tests__/chirp-provider.test.ts
- packages/core/src/providers/tts/__tests__/wavenet-provider.test.ts
- packages/core/src/providers/image/index.ts
- packages/core/src/providers/image/gemini-image-provider.ts
- packages/core/src/providers/image/template-thumbnailer.ts
- packages/core/src/providers/image/__tests__/gemini-image-provider.test.ts
- packages/core/src/providers/image/__tests__/template-thumbnailer.test.ts
- packages/core/src/providers/__tests__/registry.test.ts
- packages/core/src/secrets/index.ts
- packages/core/src/secrets/get-secret.ts
- packages/core/src/secrets/__tests__/get-secret.test.ts

**Modified Files:**
- packages/core/src/index.ts (added providers and secrets exports)
- packages/core/src/types/providers.ts (added `name` property to interfaces)

### Change Log

- 2026-01-10: Implemented provider abstraction layer (Story 1.5)
  - Created 6 provider implementations: GeminiLLMProvider, GeminiTTSProvider, ChirpProvider, WaveNetProvider, GeminiImageProvider, TemplateThumbnailer
  - Created provider registry with primary/fallback chains
  - Created getSecret placeholder for API key retrieval
  - Added `name` property to provider interfaces for withFallback compatibility
  - Added 73 new tests (411 total, all passing)
- 2026-01-10: Code review fixes applied
  - Removed console.warn from getSecret (violates project logging standards)
  - Made ImageProvider.generate() options parameter optional in interface
  - Added input validation to all 6 providers with proper NEXUS_*_INVALID_INPUT errors
  - Added 9 new validation tests (420 total, all passing)

---

## COMPREHENSIVE DEVELOPER CONTEXT

### MISSION CRITICAL: Provider Abstraction for Pipeline Flexibility

This story creates the **provider abstraction layer** that enables the pipeline to:
1. Swap between Gemini models without code changes
2. Fall back to alternate providers when primary fails
3. Track which provider tier was used for quality decisions
4. Estimate costs before making expensive API calls

**Every stage in Epic 2-5 will use these providers through the registry.**

### EXHAUSTIVE PROVIDER ANALYSIS

#### 1. LLM Provider Implementation

**GeminiLLMProvider Requirements:**
- Model options: `gemini-3-pro-preview` (primary), `gemini-2.5-pro` (fallback)
- Must implement `LLMProvider` interface from types/providers.ts
- Must have `name` property for withFallback compatibility
- Must use `withRetry` wrapper for API calls
- Must return `LLMResult` with: text, tokens.input, tokens.output, cost, model, quality

**Cost Estimation (Gemini 3 Pro):**
- Input: ~$0.00125 per 1K tokens
- Output: ~$0.005 per 1K tokens
- Token estimation: ~4 characters per token

**Error Handling:**
```typescript
// Wrap SDK errors in NexusError
try {
  const response = await sdk.generateContent(prompt);
  // ...
} catch (error) {
  throw NexusError.fromError(error, 'llm');
}
```

**Usage Pattern in Stages:**
```typescript
// In script-gen stage
const registry = createProviderRegistry();
const allProviders = [registry.llm.primary, ...registry.llm.fallbacks];

const { result, provider, tier } = await withFallback(
  allProviders,
  (p) => p.generate(prompt, options),
  { stage: 'script-gen' }
);

// Track tier in StageOutput
return {
  data: result,
  provider: { name: provider, tier, attempts: 1 }
};
```

---

#### 2. TTS Provider Implementation

**Primary: GeminiTTSProvider (`gemini-2.5-pro-tts`)**
- Best quality TTS from Google (GA Sept 2025)
- 30 speakers, 80+ locales
- Natural language control for style, accent, pace, emotion
- SSML support for pronunciation hints
- 44.1kHz WAV output

**Fallback 1: ChirpProvider (`chirp3-hd`)**
- High-definition voice synthesis
- Use when Gemini TTS hits quota limits
- Similar API interface

**Fallback 2: WaveNetProvider**
- Last resort fallback
- Standard quality TTS
- Most reliable availability

**TTS Quality Impact:**
- Audio quality directly impacts viewer retention
- Fallback usage triggers quality gate consideration
- TTS fallback + thumbnail fallback = HUMAN_REVIEW

**Cost Estimation:**
- Gemini TTS: ~$0.000016/character
- Chirp HD: ~$0.000012/character
- WaveNet: ~$0.000004/character

---

#### 3. Image Provider Implementation

**Primary: GeminiImageProvider (`gemini-3-pro-image-preview`)**
- AI-generated thumbnails
- 1280x720 for YouTube
- Generate 3 A/B variants (NFR22)

**Fallback: TemplateThumbnailer**
- Uses pre-designed template images
- Overlays topic title text
- Stored in `data/templates/thumbnails/`
- Always produces 3 variants

**Thumbnail Fallback Impact:**
- Hurts click-through rate (CTR)
- Tracked as DEGRADED quality
- Combined with TTS fallback = HUMAN_REVIEW

---

#### 4. Secret Management

**Placeholder Implementation (Story 1.5):**
- Read from environment variables
- Pattern: `nexus-gemini-api-key` -> `NEXUS_GEMINI_API_KEY`
- Warn in development if secret not found
- Throw error in production if secret not found

**Real Implementation (Story 1.6):**
- GCP Secret Manager integration
- In-memory caching for process duration
- Secret names: `nexus-{service}-{purpose}`

**Environment Variables for Local Dev:**
```bash
NEXUS_GEMINI_API_KEY=your-gemini-api-key
NEXUS_YOUTUBE_OAUTH=your-youtube-oauth-json
NEXUS_TWITTER_OAUTH=your-twitter-oauth-json
NEXUS_DISCORD_WEBHOOK=your-discord-webhook-url
```

---

#### 5. Provider Registry Design

**Registry Structure:**
```typescript
interface ProviderChain<T> {
  primary: T;
  fallbacks: T[];
}

interface ProviderRegistry {
  llm: ProviderChain<LLMProvider>;
  tts: ProviderChain<TTSProvider>;
  image: ProviderChain<ImageProvider>;
}
```

**Registry Factory:**
```typescript
function createProviderRegistry(): ProviderRegistry {
  return {
    llm: {
      primary: new GeminiLLMProvider('gemini-3-pro-preview'),
      fallbacks: [new GeminiLLMProvider('gemini-2.5-pro')]
    },
    tts: {
      primary: new GeminiTTSProvider('gemini-2.5-pro-tts'),
      fallbacks: [new ChirpProvider(), new WaveNetProvider()]
    },
    image: {
      primary: new GeminiImageProvider('gemini-3-pro-image-preview'),
      fallbacks: [new TemplateThumbnailer()]
    }
  };
}
```

**Usage with withFallback:**
```typescript
const registry = createProviderRegistry();

// Get all providers in order
const allTTSProviders = [registry.tts.primary, ...registry.tts.fallbacks];

// Use withFallback
const { result, provider, tier } = await withFallback(
  allTTSProviders,
  (p) => p.synthesize(text, options),
  { stage: 'tts' }
);
```

---

#### 6. Testing Strategy

**Provider Tests:**
```typescript
describe('GeminiLLMProvider', () => {
  it('should have name property matching model', () => {
    const provider = new GeminiLLMProvider('gemini-3-pro-preview');
    expect(provider.name).toBe('gemini-3-pro-preview');
  });

  it('should implement LLMProvider interface', () => {
    const provider = new GeminiLLMProvider();
    expect(typeof provider.generate).toBe('function');
    expect(typeof provider.estimateCost).toBe('function');
  });

  it('should estimate cost based on token count', () => {
    const provider = new GeminiLLMProvider();
    const cost = provider.estimateCost('Hello world'); // ~3 tokens
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });

  // Mock SDK for generate tests
  it('should return LLMResult from generate', async () => {
    const provider = new GeminiLLMProvider();
    // Mock the SDK call
    const result = await provider.generate('Test prompt');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('cost');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('quality');
  });
});
```

**Registry Tests:**
```typescript
describe('createProviderRegistry', () => {
  it('should create registry with all provider types', () => {
    const registry = createProviderRegistry();
    expect(registry.llm).toBeDefined();
    expect(registry.tts).toBeDefined();
    expect(registry.image).toBeDefined();
  });

  it('should have primary and fallbacks for each type', () => {
    const registry = createProviderRegistry();
    expect(registry.llm.primary).toBeDefined();
    expect(registry.llm.fallbacks).toHaveLength(1);
    expect(registry.tts.primary).toBeDefined();
    expect(registry.tts.fallbacks).toHaveLength(2);
    expect(registry.image.primary).toBeDefined();
    expect(registry.image.fallbacks).toHaveLength(1);
  });

  it('should have all providers with name property', () => {
    const registry = createProviderRegistry();

    expect(registry.llm.primary.name).toBeDefined();
    registry.llm.fallbacks.forEach(p => expect(p.name).toBeDefined());

    expect(registry.tts.primary.name).toBeDefined();
    registry.tts.fallbacks.forEach(p => expect(p.name).toBeDefined());

    expect(registry.image.primary.name).toBeDefined();
    registry.image.fallbacks.forEach(p => expect(p.name).toBeDefined());
  });
});
```

**getSecret Tests:**
```typescript
describe('getSecret', () => {
  it('should read from environment variable', async () => {
    process.env.NEXUS_TEST_SECRET = 'test-value';
    const value = await getSecret('nexus-test-secret');
    expect(value).toBe('test-value');
    delete process.env.NEXUS_TEST_SECRET;
  });

  it('should throw if secret not found', async () => {
    await expect(getSecret('nexus-nonexistent'))
      .rejects.toThrow("Secret 'nexus-nonexistent' not found");
  });

  it('should convert kebab-case to SCREAMING_SNAKE', async () => {
    process.env.NEXUS_GEMINI_API_KEY = 'api-key-value';
    const value = await getSecret('nexus-gemini-api-key');
    expect(value).toBe('api-key-value');
    delete process.env.NEXUS_GEMINI_API_KEY;
  });
});
```

---

### COMMON MISTAKES TO PREVENT

**1. Missing `name` Property:**
```typescript
// WRONG: No name property
class MyProvider implements LLMProvider {
  async generate(prompt: string) { ... }
  estimateCost(prompt: string) { ... }
}

// CORRECT: Include name for withFallback
class MyProvider implements LLMProvider {
  readonly name: string = 'my-provider';
  async generate(prompt: string) { ... }
  estimateCost(prompt: string) { ... }
}
```

**2. Not Using withRetry:**
```typescript
// WRONG: Direct SDK call
async generate(prompt: string): Promise<LLMResult> {
  const response = await sdk.generateContent(prompt);
  // ...
}

// CORRECT: Wrap with withRetry
async generate(prompt: string): Promise<LLMResult> {
  return withRetry(
    async () => {
      const response = await sdk.generateContent(prompt);
      // ...
    },
    { maxRetries: 3, stage: 'llm' }
  ).then(r => r.result);
}
```

**3. Not Wrapping SDK Errors:**
```typescript
// WRONG: Raw SDK error escapes
catch (error) {
  throw error; // Raw error, not NexusError
}

// CORRECT: Wrap in NexusError
catch (error) {
  throw NexusError.fromError(error, 'llm');
}
```

**4. Hardcoded API Keys:**
```typescript
// WRONG: Hardcoded secret
const apiKey = 'sk-abc123...';

// CORRECT: Use getSecret
const apiKey = await getSecret('nexus-gemini-api-key');
```

**5. Wrong Quality Tier:**
```typescript
// WRONG: Always returning 'primary'
return { ...result, quality: 'primary' };

// CORRECT: Return accurate tier (set by withFallback)
// The quality field is set by stage after withFallback returns tier
```

---

### VALIDATION CHECKLIST

Before marking story complete, verify:

**GeminiLLMProvider:**
- [ ] Implements LLMProvider interface
- [ ] Has `name` property matching model
- [ ] `generate()` returns LLMResult with all required fields
- [ ] `estimateCost()` returns reasonable estimate
- [ ] Uses withRetry for API calls
- [ ] Uses getSecret for API key

**GeminiTTSProvider:**
- [ ] Implements TTSProvider interface
- [ ] Has `name` property matching model
- [ ] `synthesize()` returns TTSResult with all required fields
- [ ] `getVoices()` returns Voice array
- [ ] `estimateCost()` returns reasonable estimate
- [ ] Uses withRetry for API calls

**ChirpProvider & WaveNetProvider:**
- [ ] Implement TTSProvider interface
- [ ] Have `name` property
- [ ] Same interface as GeminiTTSProvider

**GeminiImageProvider:**
- [ ] Implements ImageProvider interface
- [ ] Has `name` property matching model
- [ ] `generate()` returns ImageResult with imageUrls array
- [ ] `estimateCost()` returns reasonable estimate
- [ ] Uses withRetry for API calls

**TemplateThumbnailer:**
- [ ] Implements ImageProvider interface
- [ ] Has `name` property
- [ ] Generates 3 variants using templates

**Provider Registry:**
- [ ] Creates all provider types
- [ ] Has primary and fallbacks for each
- [ ] All providers have name property
- [ ] Factory function exported

**getSecret:**
- [ ] Reads from environment variables
- [ ] Converts kebab-case to SCREAMING_SNAKE
- [ ] Throws if secret not found
- [ ] Warns in development mode

**Package Exports:**
- [ ] All providers exported from @nexus-ai/core
- [ ] Provider registry exported
- [ ] getSecret exported

**Testing:**
- [ ] Each provider has unit tests
- [ ] Registry creation tested
- [ ] getSecret tested
- [ ] All providers have name property tests

---

### EXPECTED FILE STRUCTURE

```
packages/core/src/
├── providers/
│   ├── index.ts              # Barrel exports
│   ├── registry.ts           # Provider registry factory
│   ├── llm/
│   │   ├── index.ts
│   │   ├── gemini-llm-provider.ts
│   │   └── __tests__/
│   │       └── gemini-llm-provider.test.ts
│   ├── tts/
│   │   ├── index.ts
│   │   ├── gemini-tts-provider.ts
│   │   ├── chirp-provider.ts
│   │   ├── wavenet-provider.ts
│   │   └── __tests__/
│   │       ├── gemini-tts-provider.test.ts
│   │       ├── chirp-provider.test.ts
│   │       └── wavenet-provider.test.ts
│   └── image/
│       ├── index.ts
│       ├── gemini-image-provider.ts
│       ├── template-thumbnailer.ts
│       └── __tests__/
│           ├── gemini-image-provider.test.ts
│           └── template-thumbnailer.test.ts
├── secrets/
│   ├── index.ts
│   ├── get-secret.ts
│   └── __tests__/
│       └── get-secret.test.ts
├── types/                    # EXISTS (from Story 1.2)
├── errors/                   # EXISTS (from Story 1.3)
├── utils/                    # EXISTS (from Story 1.4)
└── index.ts                  # Add providers and secrets exports
```

**Barrel Export Pattern (providers/index.ts):**
```typescript
// LLM Providers
export { GeminiLLMProvider } from './llm/gemini-llm-provider';

// TTS Providers
export { GeminiTTSProvider } from './tts/gemini-tts-provider';
export { ChirpProvider } from './tts/chirp-provider';
export { WaveNetProvider } from './tts/wavenet-provider';

// Image Providers
export { GeminiImageProvider } from './image/gemini-image-provider';
export { TemplateThumbnailer } from './image/template-thumbnailer';

// Registry
export { createProviderRegistry } from './registry';
export type { ProviderChain, ProviderRegistry } from './registry';
```

**Main Package Export Update (src/index.ts):**
```typescript
// Add to existing exports
export * from './providers';
export * from './secrets';
```

---

### INTEGRATION WITH FUTURE STORIES

**Story 1.6 (GCP Infrastructure):**
- Replace getSecret placeholder with GCP Secret Manager
- Add caching for secrets
- Add Firestore/Storage clients

**Story 1.8 (Cost Tracking):**
- CostTracker calls provider.estimateCost()
- Tracks actual costs from provider results
- Aggregates by service

**Story 1.10 (Execute Stage Wrapper):**
- executeStage uses provider registry
- Wraps provider calls with withFallback
- Tracks provider tier in StageOutput

**Epic 2-5 (All Pipeline Stages):**
- All stages use createProviderRegistry()
- LLM stages: news-sourcing, research, script-gen
- TTS stages: tts
- Image stages: thumbnail

---

### IMPLEMENTATION GUIDANCE

**Start Here:**
1. Create `packages/core/src/providers/` directory structure
2. Create `packages/core/src/secrets/` directory structure

**Then Implement in Order:**
1. **getSecret first** (dependency for providers):
   - Simple env var lookup
   - Pattern: kebab-case to SCREAMING_SNAKE

2. **GeminiLLMProvider second**:
   - Implements LLMProvider interface
   - Mock SDK calls for initial implementation
   - Can be fully implemented when API key available

3. **TTS Providers third**:
   - GeminiTTSProvider (primary)
   - ChirpProvider (fallback 1)
   - WaveNetProvider (fallback 2)

4. **Image Providers fourth**:
   - GeminiImageProvider (primary)
   - TemplateThumbnailer (fallback)

5. **Provider Registry fifth**:
   - Factory function
   - Wire up all providers

6. **Update exports last**:
   - providers/index.ts barrel
   - secrets/index.ts barrel
   - src/index.ts main export

**Testing Strategy:**
1. Test getSecret first (simple, no mocking needed)
2. Test each provider's name property and interface
3. Mock SDK calls for generate/synthesize tests
4. Test registry creation and structure

---

### KEY LEARNINGS FOR DEV AGENT

**1. `name` Property is Essential:**
Every provider must have a `name` property for withFallback to track which provider succeeded.

**2. withRetry Wraps SDK Calls:**
All external API calls go through withRetry for resilience. The retry logic from Story 1.4 handles retryable errors automatically.

**3. Interface Compliance is Strict:**
Providers must match the interfaces defined in types/providers.ts exactly. The types were designed in Story 1.2.

**4. Cost Estimation Before, Actual After:**
- `estimateCost()` called before API call for budgeting
- Actual cost returned in result for tracking

**5. Quality Tier Set by Stage:**
The provider returns its data. The stage using withFallback determines the tier and includes it in StageOutput.

**6. getSecret is a Placeholder:**
Story 1.6 will implement real Secret Manager. For now, just read from environment variables.

**7. Template Thumbnailer is Different:**
Unlike other providers, TemplateThumbnailer doesn't call external APIs. It uses local template images.

---

**Developer:** Read this entire context before writing code. The provider abstraction you create will be the interface between the pipeline and all external AI services. These patterns directly impact pipeline reliability (NFR1-5) and cost efficiency (NFR10-13).
