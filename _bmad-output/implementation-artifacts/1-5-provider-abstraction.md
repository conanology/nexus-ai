# Story 1.5: Implement Provider Abstraction

Status: done

## Story

As a developer,
I want abstracted provider implementations for LLM, TTS, and Image generation,
So that I can swap providers without changing stage code.

## Acceptance Criteria

1. **Given** retry/fallback utilities from Story 1.4
   **When** I implement the provider abstraction layer
   **Then** `GeminiLLMProvider` class implements `LLMProvider` interface:
   - Constructor accepts model name (e.g., 'gemini-3-pro-preview')
   - `generate(prompt, options)` returns `LLMResult` with text, tokens, cost
   - `estimateCost(prompt)` returns estimated cost in dollars
   - Uses `withRetry` internally for API calls

2. **And** `GeminiTTSProvider` class implements `TTSProvider` interface:
   - Constructor accepts model name (e.g., 'gemini-2.5-pro-tts')
   - `synthesize(text, options)` returns `TTSResult` with audioUrl, durationSec, cost
   - `getVoices()` returns available voice options
   - `estimateCost(text)` returns estimated cost

3. **And** `GeminiImageProvider` class implements `ImageProvider` interface:
   - Constructor accepts model name (e.g., 'gemini-3-pro-image-preview')
   - `generate(prompt, options)` returns `ImageResult` with imageUrl, cost
   - `estimateCost(prompt)` returns estimated cost

4. **And** provider registry is defined with primary and fallback chains

5. **And** providers retrieve API keys via `getSecret()`

## Tasks / Subtasks

- [x] Task 1: Implement GeminiLLMProvider (AC: #1)
  - [x] Create LLMProvider interface with generate, estimateCost methods
  - [x] Implement GeminiLLMProvider class
  - [x] Add model name configuration
  - [x] Integrate withRetry for API calls
  - [x] Calculate token counts and costs

- [x] Task 2: Implement GeminiTTSProvider (AC: #2)
  - [x] Create TTSProvider interface with synthesize, getVoices, estimateCost
  - [x] Implement GeminiTTSProvider class
  - [x] Add voice selection support
  - [x] Return audio URLs from Cloud Storage

- [x] Task 3: Implement GeminiImageProvider (AC: #3)
  - [x] Create ImageProvider interface with generate, estimateCost
  - [x] Implement GeminiImageProvider class
  - [x] Support image size and quality options

- [x] Task 4: Create provider registry (AC: #4)
  - [x] Define ProviderRegistry structure
  - [x] Configure LLM chain: gemini-3-pro-preview → gemini-2.5-pro
  - [x] Configure TTS chain: gemini-2.5-pro-tts → chirp3-hd → wavenet
  - [x] Configure Image chain: gemini-3-pro-image → template fallback
  - [x] Create getProviders() factory function

- [x] Task 5: Integrate secret management (AC: #5)
  - [x] Use getSecret() for API key retrieval
  - [x] Handle missing credentials gracefully

## Dev Notes

### Provider Fallback Chains

| Provider Type | Primary | Fallback 1 | Fallback 2 |
|--------------|---------|------------|------------|
| LLM | gemini-3-pro-preview | gemini-2.5-pro | - |
| TTS | gemini-2.5-pro-tts | chirp3-hd | wavenet |
| Image | gemini-3-pro-image | template | - |

### Cost Estimation

- LLM: Based on token count × model pricing
- TTS: Based on character count × voice pricing
- Image: Fixed cost per generation

### Implementation Notes

- All providers use interface-based abstraction
- Providers are stateless and can be instantiated multiple times
- Cost tracking integrates with CostTracker from Story 1.8

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created LLMProvider, TTSProvider, ImageProvider interfaces
- Implemented GeminiLLMProvider with token counting and cost calculation
- Implemented GeminiTTSProvider with voice selection and audio generation
- Implemented GeminiImageProvider with size/quality options
- Created provider registry with fallback chains per architecture spec
- Integrated getSecret() for credential retrieval
- Added ChirpTTSProvider and WaveNetTTSProvider as fallbacks

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/types/providers.ts` - Provider interfaces
- `nexus-ai/packages/core/src/providers/llm.ts` - GeminiLLMProvider
- `nexus-ai/packages/core/src/providers/tts.ts` - TTS providers
- `nexus-ai/packages/core/src/providers/image.ts` - GeminiImageProvider
- `nexus-ai/packages/core/src/providers/registry.ts` - Provider registry
- `nexus-ai/packages/core/src/providers/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Story 1.4 (Retry/Fallback), Story 1.6 (GCP for secrets)
- **Downstream Dependencies:** All stages that use external AI services
