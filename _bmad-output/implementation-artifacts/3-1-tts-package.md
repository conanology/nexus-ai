# Story 3.1: Create TTS Package

Status: done

## Story

As a developer,
I want a TTS synthesis stage,
So that scripts are converted to high-quality audio.

## Acceptance Criteria

1. **Given** SSML-tagged script from Epic 2
   **When** I create the `@nexus-ai/tts` package
   **Then** package structure follows architecture:
   - `src/index.ts` exports public API
   - `src/types.ts` defines TTS-specific types
   - `src/tts.ts` for main stage logic
   - `src/audio-quality.ts` for quality checks
   - `src/chunker.ts` for script chunking

2. **And** `executeTTS()` stage function per FR16:
   - Takes SSML-tagged script as input
   - Uses TTS provider with fallback chain (Gemini → Chirp → WaveNet)
   - Synthesizes audio at 44.1kHz WAV format
   - Stores audio to Cloud Storage at `{date}/tts/audio.wav`
   - Returns `StageOutput` with audio artifact reference

3. **And** TTS options include:
   - Voice selection (configurable)
   - Speaking rate (0.9-1.1x normal)
   - Pitch adjustment

4. **And** stage uses `executeStage` wrapper

5. **And** stage tracks costs via `CostTracker`

6. **And** provider tier is tracked in output (primary vs fallback)

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/tts package (AC: #1)
  - [x] Create package structure
  - [x] Add package.json
  - [x] Add tsconfig.json
  - [x] Set up exports

- [x] Task 2: Define TTS types
  - [x] TTSInput with script, options
  - [x] TTSOutput with audioUrl, duration, cost
  - [x] TTSOptions with voice, rate, pitch

- [x] Task 3: Implement executeTTS (AC: #2, #4, #5, #6)
  - [x] Use executeStage wrapper
  - [x] Call TTS provider with fallback
  - [x] Store audio to Cloud Storage
  - [x] Track costs
  - [x] Track provider tier

- [x] Task 4: Implement TTS options (AC: #3)
  - [x] Voice selection
  - [x] Speaking rate configuration
  - [x] Pitch adjustment

## Dev Notes

### Package Structure

```
packages/tts/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── tts.ts
    ├── chunker.ts
    ├── stitcher.ts
    └── audio-quality.ts
```

### TTS Provider Chain

1. Primary: `gemini-2.5-pro-tts`
2. Fallback 1: `chirp3-hd`
3. Fallback 2: `wavenet`

### Audio Output

- Format: WAV
- Sample rate: 44.1kHz
- Channels: Mono
- Storage: `gs://nexus-ai-artifacts/{date}/tts/audio.wav`

### Voice Options

```typescript
interface TTSOptions {
  voice: string;        // Voice ID
  speakingRate: number; // 0.9-1.1
  pitch: number;        // Semitone adjustment
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/tts package with full structure
- Implemented executeTTS stage function
- Uses TTS provider with Gemini → Chirp → WaveNet fallback
- Outputs 44.1kHz WAV audio
- Stores to Cloud Storage with artifact reference
- Tracks provider tier in output
- Voice, rate, pitch options configurable

### File List

**Created/Modified:**
- `nexus-ai/packages/tts/package.json`
- `nexus-ai/packages/tts/tsconfig.json`
- `nexus-ai/packages/tts/src/types.ts`
- `nexus-ai/packages/tts/src/tts.ts`
- `nexus-ai/packages/tts/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.13 (SSML Script), Story 1.5 (TTS Provider)
- **Downstream Dependencies:** Story 3.2 (Audio Chunking), Story 3.6 (Render)
