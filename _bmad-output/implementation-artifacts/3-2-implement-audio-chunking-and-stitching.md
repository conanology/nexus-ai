# Story 3.2: implement-audio-chunking-and-stitching

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to handle long scripts via chunking,
so that TTS API limits don't cause failures.

## Acceptance Criteria

1. **Script Chunking Function (FR17):** Implement `chunkScript(script: string, maxChars: number = 5000)` that splits scripts into manageable chunks at sentence boundaries (never mid-sentence), preserves SSML tags across chunks, and returns array of `ChunkInfo` objects with indices
2. **SSML Preservation:** Chunking MUST preserve SSML phoneme tags across chunk boundaries: if `<phoneme>` tag starts in one chunk but closes in next, maintain proper tag structure in both chunks
3. **Audio Stitching Function:** Implement `stitchAudio(segments: AudioSegment[])` that concatenates WAV segments in order, adds configurable silence between segments (default: 200ms), normalizes audio levels across segments, and outputs single WAV file
4. **Storage Requirements:** Individual audio segments stored at `{date}/tts/audio-segments/{index}.wav`, final stitched audio at `{date}/tts/audio.wav`
5. **Quality Gate Integration:** Call TTS quality gate after stitching to validate: silence detection (<5% of total duration), clipping detection (no samples at max amplitude), duration validation (matches expected from word count ~140 words/minute speech), returning DEGRADED status if checks fail
6. **Enhanced TTS Stage Function:** Modify `executeTTS()` from Story 3.1 to detect long scripts (>5000 chars), automatically chunk them, synthesize each chunk separately using existing TTS providers with retry/fallback, stitch audio segments with quality validation, and store both segments and final audio
7. **TypeScript Contracts:** Define `ChunkInfo` type with `{ index: number, text: string, startChar: number, endChar: number }` and `AudioSegment` type with `{ index: number, audioBuffer: Buffer, durationSec: number }`
8. **Integration Testing:** Create integration tests that verify script chunking with SSML preservation, multi-chunk TTS synthesis with fallback chains, audio stitching with silence padding and normalization, quality gate validation on stitched audio, and Cloud Storage upload for all artifacts

## Tasks / Subtasks

- [x] **T1: Implement Script Chunking Logic (AC: 1, 2)**
  - [x] Create `chunker.ts` with `chunkScript()` function
  - [x] Implement sentence boundary detection (split at `. `, `! `, `? `)
  - [x] Add SSML tag tracking to preserve tags across chunks
  - [x] Handle edge case: SSML tag spans chunk boundary
  - [x] Return `ChunkInfo[]` with indices and character positions
  - [x] Unit test with various script lengths and SSML patterns

- [x] **T2: Define Chunking Types (AC: 7)**
  - [x] Define `ChunkInfo` interface in `types.ts`
  - [x] Define `AudioSegment` interface in `types.ts`
  - [x] Update `TTSInput` to include optional `maxChunkChars` parameter
  - [x] Export types from package index

- [x] **T3: Implement Audio Stitching Logic (AC: 3)**
  - [x] Enhance `audio-quality.ts` with `stitchAudio()` function
  - [x] Implement WAV concatenation with proper header handling
  - [x] Add configurable silence padding between segments (200ms default)
  - [x] Implement audio level normalization across segments
  - [x] Return single WAV buffer with combined audio
  - [x] Unit test with mock audio segments

- [x] **T4: Enhance TTS Stage for Chunking (AC: 6)**
  - [x] Modify `executeTTS()` in `tts.ts` to detect scripts >5000 chars
  - [x] If chunking needed: call `chunkScript()` to split input
  - [x] Loop through chunks, synthesize each with existing TTS providers
  - [x] Use `withRetry` + `withFallback` for each chunk synthesis
  - [x] Track costs for all chunk synthesis operations
  - [x] Store individual segments to Cloud Storage at `{date}/tts/audio-segments/{index}.wav`
  - [x] Call `stitchAudio()` to combine segments
  - [x] Store final audio to Cloud Storage at `{date}/tts/audio.wav`
  - [x] Update `StageOutput` to include segment references

- [x] **T5: Quality Gate Integration (AC: 5)**
  - [x] Call existing `validateAudioQuality()` on stitched audio
  - [x] Verify silence detection (<5% total duration)
  - [x] Verify clipping detection (no max amplitude samples)
  - [x] Verify duration validation (matches word count expectation)
  - [x] Return DEGRADED status if any check fails
  - [x] Include quality metrics in `StageOutput`

- [x] **T6: Storage and Artifact Management (AC: 4)**
  - [x] Upload individual segments to `{pipelineId}/tts/audio-segments/{index}.wav`
  - [x] Upload final stitched audio to `{pipelineId}/tts/audio.wav`
  - [x] Return both segment URLs and final URL in `StageOutput.artifacts`
  - [x] Add metadata: segment count, total duration, stitched duration

- [x] **T7: Error Handling for Chunking (AC: 6)**
  - [x] Handle chunk synthesis failure: retry with backoff
  - [x] If all providers fail for one chunk: throw CRITICAL error
  - [x] If stitching fails: throw CRITICAL error (no audio = no video)
  - [x] Log per-chunk synthesis progress
  - [x] Track which chunks used fallback providers

- [x] **T8: Integration and Unit Testing (AC: 8)**
  - [x] Unit test `chunkScript()` with various inputs and SSML patterns
  - [x] Unit test `stitchAudio()` with mock audio segments
  - [x] Integration test: long script (>5000 chars) with SSML tags
  - [x] Integration test: multi-chunk synthesis with mock TTS providers
  - [x] Integration test: audio stitching with silence and normalization
  - [x] Integration test: quality gate validation on stitched audio
  - [x] Integration test: Cloud Storage upload for segments and final audio
  - [x] Integration test: fallback chain for chunk synthesis failures

## Dev Notes

### Architecture Context - Audio Chunking Strategy

**TTS API Constraints:**
- **Character Limit:** 5000 characters per TTS API request (hard limit)
- **Rationale:** Long scripts (1200-1800 words ≈ 7000-10000 chars) exceed single request limit
- **Solution:** Chunk scripts at sentence boundaries, synthesize separately, stitch audio
- Source: [epics.md:1072-1100, architecture.md:263-286]

**Chunking Requirements:**
- **Sentence Boundary Detection:** Split at `. `, `! `, `? ` to avoid mid-sentence cuts
- **SSML Tag Preservation:** Critical for pronunciation markup from Story 2.13
  - Example: `<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme>`
  - If tag spans chunks, must close in first chunk and reopen in next
- **Character Position Tracking:** Return start/end positions for debugging
- Source: [epics.md:1072-1100]

**Audio Stitching Requirements:**
- **WAV Format:** 44.1kHz sample rate (from Story 3.1)
- **Silence Padding:** 200ms between segments (configurable)
- **Level Normalization:** Prevent volume jumps between segments
- **Quality Validation:** Same checks as single synthesis (silence, clipping, duration)
- Source: [epics.md:1095-1100, 3-1-create-tts-package.md:219-239]

### Technical Implementation Patterns

**1. Chunking Algorithm (CRITICAL):**
```typescript
interface ChunkInfo {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

export function chunkScript(
  script: string,
  maxChars: number = 5000
): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  let currentChunk = '';
  let currentStart = 0;

  // Split into sentences
  const sentences = script.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    // If adding sentence exceeds limit, save current chunk
    if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
      chunks.push({
        index: chunks.length,
        text: currentChunk.trim(),
        startChar: currentStart,
        endChar: currentStart + currentChunk.length
      });
      currentStart += currentChunk.length;
      currentChunk = '';
    }
    currentChunk += sentence + ' ';
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunks.length,
      text: currentChunk.trim(),
      startChar: currentStart,
      endChar: currentStart + currentChunk.length
    });
  }

  return chunks;
}
```
**CRITICAL:** Must handle SSML tag preservation across chunks - detect open tags at chunk end, close them, and reopen in next chunk.

**2. SSML Tag Preservation Pattern:**
```typescript
function preserveSSMLTags(chunks: ChunkInfo[]): ChunkInfo[] {
  // Track open SSML tags across chunks
  let openTags: string[] = [];

  return chunks.map(chunk => {
    let text = chunk.text;

    // Prepend open tags from previous chunk
    if (openTags.length > 0) {
      text = openTags.join('') + text;
    }

    // Find unclosed tags in this chunk
    const tagPattern = /<(\w+)[^>]*>/g;
    const closePattern = /<\/(\w+)>/g;

    // Track tags that remain open at end of chunk
    openTags = []; // Reset and recalculate

    // ... tag tracking logic ...

    return { ...chunk, text };
  });
}
```
Source: [epics.md:1072-1100]

**3. Audio Stitching Implementation:**
```typescript
interface AudioSegment {
  index: number;
  audioBuffer: Buffer;
  durationSec: number;
}

export function stitchAudio(
  segments: AudioSegment[],
  silenceDurationMs: number = 200
): Buffer {
  // Sort segments by index
  const sorted = segments.sort((a, b) => a.index - b.index);

  // Generate silence padding (44.1kHz WAV, 200ms)
  const silenceBuffer = generateSilence(silenceDurationMs, 44100);

  // Normalize levels across all segments
  const normalized = normalizeAudioLevels(sorted.map(s => s.audioBuffer));

  // Concatenate with silence padding
  const combined: Buffer[] = [];
  normalized.forEach((buffer, i) => {
    combined.push(buffer);
    if (i < normalized.length - 1) {
      combined.push(silenceBuffer);
    }
  });

  // Combine WAV buffers with proper header
  return combineWAVBuffers(combined);
}

function generateSilence(durationMs: number, sampleRate: number): Buffer {
  // Generate silent PCM samples
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples = Buffer.alloc(numSamples * 2); // 16-bit samples
  return createWAVBuffer(samples, sampleRate);
}

function normalizeAudioLevels(buffers: Buffer[]): Buffer[] {
  // Calculate max amplitude across all segments
  let maxAmplitude = 0;
  for (const buffer of buffers) {
    const samples = extractPCMSamples(buffer);
    const segmentMax = Math.max(...samples.map(Math.abs));
    maxAmplitude = Math.max(maxAmplitude, segmentMax);
  }

  // Normalize to 90% of max to prevent clipping
  const targetMax = 32767 * 0.9; // 16-bit max
  const scaleFactor = targetMax / maxAmplitude;

  return buffers.map(buffer => {
    const samples = extractPCMSamples(buffer);
    const normalized = samples.map(s => Math.round(s * scaleFactor));
    return createWAVBuffer(Buffer.from(normalized), 44100);
  });
}
```
Source: [epics.md:1095-1100, 3-1-create-tts-package.md:223-239]

**4. Enhanced TTS Stage Function:**
```typescript
export async function executeTTS(
  input: StageInput<TTSInput>
): Promise<StageOutput<TTSOutput>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, 'tts');

  logger.info('TTS stage started', {
    pipelineId: input.pipelineId,
    stage: 'tts',
    scriptLength: input.data.ssmlScript.length
  });

  try {
    const script = input.data.ssmlScript;
    const maxChars = input.data.maxChunkChars || 5000;

    // Detect if chunking needed
    if (script.length <= maxChars) {
      // Single synthesis (existing logic from Story 3.1)
      return await synthesizeSingle(input, tracker);
    }

    // Chunking required
    logger.info('Script exceeds limit, chunking required', {
      pipelineId: input.pipelineId,
      scriptLength: script.length,
      maxChars
    });

    // Chunk script
    const chunks = chunkScript(script, maxChars);
    logger.info('Script chunked', {
      pipelineId: input.pipelineId,
      chunkCount: chunks.length
    });

    // Synthesize each chunk
    const segments: AudioSegment[] = [];
    for (const chunk of chunks) {
      logger.info('Synthesizing chunk', {
        pipelineId: input.pipelineId,
        chunkIndex: chunk.index,
        chunkLength: chunk.text.length
      });

      const { result, provider, tier, attempts } = await withRetry(
        () => withFallback(providers.tts, (p) => p.synthesize(chunk.text, input.data)),
        { maxRetries: 3, stage: 'tts' }
      );

      tracker.recordApiCall(provider, chunk.text.length, result.cost);

      // Store segment to Cloud Storage
      const segmentUrl = await cloudStorage.uploadFile(
        'nexus-ai-artifacts',
        `${input.pipelineId}/tts/audio-segments/${chunk.index}.wav`,
        result.audioContent,
        'audio/wav'
      );

      segments.push({
        index: chunk.index,
        audioBuffer: result.audioContent,
        durationSec: result.durationSec
      });

      logger.info('Chunk synthesized', {
        pipelineId: input.pipelineId,
        chunkIndex: chunk.index,
        provider,
        tier,
        segmentUrl
      });
    }

    // Stitch audio segments
    logger.info('Stitching audio segments', {
      pipelineId: input.pipelineId,
      segmentCount: segments.length
    });

    const stitchedBuffer = stitchAudio(segments, 200);
    const totalDuration = segments.reduce((sum, s) => sum + s.durationSec, 0) +
                          (segments.length - 1) * 0.2; // Add silence time

    // Upload stitched audio
    const audioUrl = await cloudStorage.uploadFile(
      'nexus-ai-artifacts',
      `${input.pipelineId}/tts/audio.wav`,
      stitchedBuffer,
      'audio/wav'
    );

    // Quality gate check on stitched audio
    const qualityInfo = await validateAudioQuality(stitchedBuffer, {
      expectedDuration: calculateExpectedDuration(script)
    });

    const gate = await qualityGate.check('tts', {
      audioUrl,
      durationSec: totalDuration,
      quality: qualityInfo
    });

    const output: StageOutput<TTSOutput> = {
      success: true,
      data: {
        audioUrl,
        durationSec: totalDuration,
        format: 'wav',
        sampleRate: 44100,
        segmentCount: segments.length
      },
      artifacts: [
        { type: 'audio', url: audioUrl },
        ...segments.map(s => ({
          type: 'audio-segment',
          url: `gs://nexus-ai-artifacts/${input.pipelineId}/tts/audio-segments/${s.index}.wav`
        }))
      ],
      quality: gate.metrics,
      cost: tracker.getSummary(),
      durationMs: Date.now() - startTime,
      provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: segments.length },
      warnings: gate.warnings
    };

    logger.info('TTS stage complete', {
      pipelineId: input.pipelineId,
      stage: 'tts',
      segmentCount: segments.length,
      totalDuration,
      durationMs: output.durationMs
    });

    return output;

  } catch (error) {
    logger.error('TTS stage failed', {
      pipelineId: input.pipelineId,
      stage: 'tts',
      error
    });
    throw NexusError.fromError(error, 'tts');
  }
}
```
Source: [project-context.md:388-453, 3-1-create-tts-package.md:149-218]

**5. Cost Tracking for Chunked Synthesis:**
- Each chunk synthesis tracked separately via `CostTracker`
- Total cost = sum of all chunk costs
- Example: 10,000 char script split into 2 chunks × $0.000016/char = ~$0.16 total
- Cost tracking CRITICAL for NFR10 (<$0.50/video) and NFR11 (<$1.50/video)
- Source: [project-context.md:99-106, architecture.md:43]

### Integration with Existing Code

**Reuse from Story 3.1 (TTS Package):**
- `executeTTS()` function - ENHANCE with chunking detection
- `GeminiTTSProvider`, `ChirpProvider`, `WaveNetProvider` - USE as-is for chunk synthesis
- `validateAudioQuality()` - USE on stitched audio
- `TTSInput`, `TTSOutput` types - EXTEND with chunk metadata
- `withRetry()`, `withFallback()` - USE for each chunk synthesis
- `CostTracker` - ACCUMULATE costs across chunks
- `qualityGate.check()` - USE on final stitched audio
- Source: [3-1-create-tts-package.md]

**Input from Story 2.13 (SSML Tagging):**
- SSML-tagged scripts with pronunciation markup
- Format: `<phoneme alphabet="ipa" ph="{ipa}">{term}</phoneme>`
- Chunking MUST preserve these tags correctly
- Source: [2-13-implement-ssml-tagging.md, 3-1-create-tts-package.md:122-127]

**Output to Story 3.3 (Visual Generation):**
- Final audio URL at `{date}/tts/audio.wav`
- Total duration for video synchronization
- Individual segments available for advanced use cases
- Source: [epics.md:1101-1130]

### Package Location

**Module:** `@nexus-ai/tts` (existing package from Story 3.1)

**Files to Modify:**
- `packages/tts/src/tts.ts` (ENHANCE - add chunking logic to `executeTTS()`)
- `packages/tts/src/types.ts` (ADD - `ChunkInfo`, `AudioSegment` types)
- `packages/tts/src/chunker.ts` (ENHANCE - from placeholder to full implementation)
- `packages/tts/src/audio-quality.ts` (ADD - `stitchAudio()` function)
- `packages/tts/src/index.ts` (UPDATE - export new types and functions)

**Files to Create:**
- `packages/tts/src/__tests__/chunker.test.ts` (NEW - unit tests for chunking)
- `packages/tts/src/__tests__/stitching.test.ts` (NEW - unit tests for audio stitching)
- `packages/tts/src/__tests__/tts-chunking-integration.test.ts` (NEW - integration tests)

**Dependencies (already in package.json from Story 3.1):**
```json
{
  "dependencies": {
    "@nexus-ai/core": "workspace:*",
    "@google-cloud/text-to-speech": "^5.0.0",
    "wav": "^1.0.2",
    "audio-buffer-utils": "^6.0.0"
  }
}
```

### Project Structure Notes

- **Epic:** Epic 3: Media Production Pipeline (Story 2 of 8)
- **Dependencies:**
  - Story 3.1 (TTS package with synthesis, providers, quality validation)
  - Story 2.13 (SSML-tagged scripts as input)
  - Story 1.6 (Cloud Storage for segments and final audio)
  - Story 1.4 (retry/fallback utilities)
  - Story 1.8 (cost tracking for multi-chunk synthesis)
- **Next Stage:** Story 3.3 (visual generation - consumes audio URL)
- **Critical Path:** Audio chunking prevents TTS failures on long scripts, enabling consistent video production

### Previous Story Learnings (from Story 3.1)

**What Worked Well from Story 3.1:**
- Comprehensive TTS provider abstraction with fallback chain
- Audio quality validation framework (silence, clipping, duration)
- Integration with Cloud Storage for artifact upload
- Cost tracking per API call
- 24 tests (13 quality + 11 integration) provided excellent coverage

**Code Patterns Established in Story 3.1:**
- **TTS Provider Pattern:** Interface-based with `synthesize()`, `getVoices()`, `estimateCost()`
- **Quality Validation:** Separate functions for silence, clipping, duration checks
- **Stage Structure:** `StageInput` → detect long script → chunk → synthesize → validate → `StageOutput`
- **Error Handling:** `NexusError.fromError(error, 'tts')` with TTS-specific error codes

**Recommendations for This Story:**
1. Follow established TTS patterns from Story 3.1 - consistency critical
2. Test chunking edge cases: SSML tags spanning chunks, very long scripts, single-sentence chunks
3. Test audio stitching with various segment counts and silence padding values
4. Verify quality validation works correctly on stitched audio (not just single synthesis)
5. Test fallback chain per-chunk - each chunk should independently retry/fallback
6. Consider performance - chunking adds overhead but prevents API failures

### Git Commit Patterns

**Recent Commits (for reference):**
- `63ca742`: "feat(tts): add TTS synthesis stage with audio quality validation and chunking utilities"
- `8cea29d`: "Add integration and unit tests for SSML tagging and pronunciation stage"
- `9f6c946`: "Add tests and implementation for pronunciation extraction and review queue"

**Suggested Commit Message:**
```
feat(tts): implement audio chunking and stitching for long scripts

- Enhance executeTTS() to detect scripts >5000 chars and chunk automatically
- Implement chunkScript() with sentence boundary detection and SSML preservation
- Implement stitchAudio() with WAV concatenation, silence padding, and normalization
- Add ChunkInfo and AudioSegment types to TTS package
- Store individual segments to Cloud Storage at {date}/tts/audio-segments/{index}.wav
- Validate stitched audio quality using existing quality gate framework
- Track costs per-chunk and accumulate total synthesis cost
- Add comprehensive tests for chunking, stitching, and multi-chunk synthesis
- Handle chunk synthesis failures with retry + fallback chain per chunk

Implements Story 3.2 (FR17) - prevents TTS API failures on long scripts
Enhances Epic 3: Media Production Pipeline
```

### Critical Development Considerations

**1. SSML Tag Preservation Complexity:**
- MOST CRITICAL aspect of this story
- If SSML tags are broken during chunking, pronunciation markup from Story 2.13 is lost
- Example edge case:
  ```
  Chunk 1 ends: "...discussing <phoneme alphabet='ipa' ph='mɪkˈstr"
  Chunk 2 starts: "ɑːl'>Mixtral</phoneme> architecture..."
  ```
- MUST detect open tags at chunk boundaries and properly close/reopen them
- Test with real SSML-tagged scripts from Story 2.13 output

**2. Audio Stitching Quality:**
- Silence padding prevents jarring transitions between segments
- Too much silence: unnatural pauses (>300ms = noticeable)
- Too little silence: segments blend together (<100ms = rushed)
- 200ms is optimal based on human speech patterns
- Level normalization prevents volume jumps that sound robotic

**3. Cost Impact of Chunking:**
- Chunking increases cost linearly with chunk count
- 10,000 char script: 2 chunks × $0.000016/char = $0.16
- Still well under NFR10 (<$0.50/video) and NFR11 (<$1.50/video)
- But track carefully - 20,000 char script would be $0.32 for TTS alone

**4. Performance Considerations:**
- Each chunk = separate TTS API call (sequential)
- 2 chunks at ~3sec each = 6 seconds total synthesis time
- Plus stitching overhead (~500ms)
- Still within NFR6 (<4 hours total pipeline) and NFR7 (<45 min render)

**5. Error Handling Edge Cases:**
- What if chunk 1 succeeds but chunk 2 fails after retries?
  - CRITICAL error - cannot stitch incomplete audio
  - Must retry chunk 2 with all fallback providers
  - If all fail, abort stage (no audio = no video)
- What if stitching fails due to incompatible WAV formats?
  - CRITICAL error - validate all segments have same sample rate before stitching
  - Should not happen if using same provider, but validate anyway

**6. Testing Strategy:**
- **Unit Tests:**
  - `chunkScript()` with various lengths and SSML patterns
  - `stitchAudio()` with mock audio buffers
  - SSML tag preservation across chunks
- **Integration Tests:**
  - End-to-end: long script → chunk → synthesize → stitch → validate → upload
  - Fallback chain: chunk synthesis fails → retries → uses Chirp/WaveNet
  - Quality gate: stitched audio fails silence check → DEGRADED status
- **Edge Case Tests:**
  - Script exactly at 5000 chars (no chunking)
  - Script at 5001 chars (2 chunks)
  - Very long script (15000 chars → 3 chunks)
  - Single-sentence script >5000 chars (cannot chunk at sentence boundary)

**7. Future Enhancements (NOT in scope for this story):**
- Parallel chunk synthesis (Month 3) - synthesize all chunks simultaneously for speed
- Dynamic chunk size based on provider limits (Month 3) - different providers may have different limits
- Advanced stitching with crossfade (Month 4) - smooth transitions instead of silence
- Chunk caching (Month 4) - reuse chunks if script partially changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Implement Audio Chunking and Stitching]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17: System can chunk long scripts and stitch audio segments]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stage Deployment Model]
- [Source: _bmad-output/planning-artifacts/architecture.md#Quality Gate Framework]
- [Source: _bmad-output/implementation-artifacts/3-1-create-tts-package.md#TTS Stage Function]
- [Source: _bmad-output/implementation-artifacts/3-1-create-tts-package.md#Audio Quality Gate]
- [Source: _bmad-output/implementation-artifacts/2-13-implement-ssml-tagging.md#SSML Format Standard]
- [Source: _bmad-output/project-context.md#Stage Execution Template]
- [Source: _bmad-output/project-context.md#CRITICAL RULES]
- [Source: packages/tts/src/tts.ts#executeTTS function]
- [Source: packages/tts/src/types.ts#TTSInput/TTSOutput interfaces]
- [Source: packages/tts/src/audio-quality.ts#validateAudioQuality]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No critical issues encountered during implementation.

### Completion Notes List

#### T1-T2: Types and Chunking Logic Implementation (2026-01-17)

✅ Implemented comprehensive script chunking with SSML tag preservation:
- Created `ChunkInfo` and `AudioSegment` interfaces in packages/tts/src/types.ts:55-76
- Enhanced `TTSInput` with optional `maxChunkChars` parameter (default: 5000)
- Implemented `chunkScript()` function with sentence boundary detection at `. `, `! `, `? `
- Implemented `preserveSSMLTags()` to handle SSML phoneme tags spanning chunk boundaries
- Algorithm tracks open tags, closes them at chunk end, reopens in next chunk
- Returns `ChunkInfo[]` with index, text, startChar, endChar for debugging
- Handles edge cases: empty scripts, single long sentences, multiple nested tags

#### T3: Audio Stitching Implementation (2026-01-17)

✅ Implemented full audio stitching pipeline in packages/tts/src/audio-quality.ts:299-560:
- `stitchAudio()` function concatenates WAV segments with configurable silence padding (200ms default)
- `extractPCMData()` strips WAV headers from segments (44 bytes standard)
- `generateSilence()` creates silence buffers (16-bit PCM stereo at 44.1kHz)
- `normalizeAudioLevels()` prevents volume jumps by normalizing to 90% of max amplitude
- `createWAVBuffer()` generates proper WAV file with RIFF header, fmt chunk, data chunk
- All segments sorted by index before stitching to ensure correct order
- Validates sample rate consistency across segments

#### T4-T7: Enhanced TTS Stage with Multi-Chunk Support (2026-01-17)

✅ Modified packages/tts/src/tts.ts:79-622 to support chunking:
- `executeTTS()` detects scripts >5000 chars and triggers chunking path
- Single-chunk path (scripts ≤5000 chars) uses optimized `synthesizeSingleChunk()` helper
- Multi-chunk path synthesizes each chunk separately with independent retry+fallback chains
- Each chunk uses `withRetry()` (3 attempts) + `withFallback()` (Gemini → Chirp → WaveNet)
- Tracks costs per chunk via `CostTracker.recordApiCall()`
- Uploads individual segments to `{pipelineId}/tts/audio-segments/{index}.wav`
- Calls `stitchAudio()` to combine segments with 200ms silence padding
- Uploads final stitched audio to `{pipelineId}/tts/audio.wav`
- Runs `validateAudioQuality()` on stitched audio (silence, clipping, duration checks)
- Quality gate integration validates stitched audio meets NFR requirements
- Comprehensive error handling: CRITICAL errors for chunk synthesis failures, stitching failures
- Detailed structured logging for each chunk synthesis with pipelineId, chunkIndex, provider, tier

#### T8: Comprehensive Test Coverage (2026-01-17)

✅ Created 67 passing tests across 5 test files:
- **chunker.test.ts** (16 tests): Script chunking with SSML preservation, sentence boundaries, edge cases
- **stitching.test.ts** (12 tests): Audio stitching, WAV generation, normalization, silence padding
- **tts-chunking-integration.test.ts** (15 tests): End-to-end chunking+stitching, SSML preservation, performance
- **audio-quality.test.ts** (13 tests): Quality validation (existing from Story 3.1)
- **tts.test.ts** (11 tests): TTS stage function (existing from Story 3.1)

Test coverage includes:
- SSML tag preservation across chunk boundaries
- Sentence boundary detection (`.`, `!`, `?`)
- Audio normalization to prevent clipping
- Silence padding between segments (100ms, 200ms, 500ms variations)
- WAV header generation (RIFF, fmt, data chunks)
- Multi-chunk synthesis with varying durations
- Edge cases: empty scripts, single long sentences, very short/long segments
- Performance tests: 100 sentences chunked in <100ms, 1000 sentences in <500ms

All 67 tests passing (vitest --run)

### File List

**Modified Files:**
- packages/tts/src/types.ts - Added ChunkInfo, AudioSegment types; extended TTSInput, TTSOutput
- packages/tts/src/index.ts - Exported new types and stitchAudio function
- packages/tts/src/chunker.ts - Full implementation replacing placeholder
- packages/tts/src/audio-quality.ts - Added stitchAudio and helper functions
- packages/tts/src/tts.ts - Enhanced executeTTS for multi-chunk synthesis

**New Test Files:**
- packages/tts/src/__tests__/chunker.test.ts - Unit tests for chunking logic
- packages/tts/src/__tests__/stitching.test.ts - Unit tests for audio stitching
- packages/tts/src/__tests__/tts-chunking-integration.test.ts - Integration tests for full pipeline

### Change Log

**2026-01-17:** Implemented audio chunking and stitching for long scripts (Story 3.2)
- Enhanced TTS stage to detect scripts >5000 chars and chunk automatically
- Implemented sentence boundary detection with SSML tag preservation across chunks
- Implemented WAV audio stitching with silence padding (200ms) and level normalization
- Added per-chunk retry+fallback chains (Gemini 2.5 Pro TTS → Chirp 3 HD → WaveNet)
- Integrated quality gate validation on stitched audio (silence, clipping, duration)
- Cloud Storage uploads for both individual segments and final stitched audio
- Cost tracking per-chunk with accumulation across all segments
- Comprehensive test suite: 67 tests (16 chunking + 12 stitching + 15 integration + 24 existing)
- Prevents TTS API failures on long scripts (1200-1800 word scripts ≈ 7000-10000 chars)
- Maintains audio quality through normalization and quality gate validation

**2026-01-17 (Review Fixes):** Addressed critical issues found during code review
- **Fixed:** Enforced `audioEncoding: 'LINEAR16'` in TTS options to prevent MP3 corruption during stitching (Critical)
- **Fixed:** Hardened WAV parsing in `extractPCMData` to dynamically locate 'data' chunk instead of blind slicing (High)
- **Fixed:** Improved space preservation in chunking logic by removing aggressive trimming
- **Fixed:** Added untracked test files to git
- **Updated:** Core types to support `audioEncoding` and `audio-segment` artifact type
