# Story 3.2: Implement Audio Chunking and Stitching

Status: done

## Story

As a developer,
I want to handle long scripts via chunking,
So that TTS API limits don't cause failures.

## Acceptance Criteria

1. **Given** TTS package from Story 3.1
   **When** I implement audio chunking and stitching per FR17
   **Then** `chunkScript(script: string, maxChars: number)` splits scripts:
   - Default maxChars = 5000 (API limit)
   - Chunks at sentence boundaries (never mid-sentence)
   - Preserves SSML tags across chunks
   - Returns array of chunk strings with indices

2. **And** each chunk is synthesized independently

3. **And** `stitchAudio(segments: AudioSegment[])` combines:
   - Concatenates WAV segments in order
   - Adds configurable silence between segments (default: 200ms)
   - Normalizes audio levels across segments
   - Outputs single WAV file

4. **And** individual segments stored at `{date}/tts/audio-segments/{index}.wav`

5. **And** final stitched audio at `{date}/tts/audio.wav`

6. **And** quality checks per TTS quality gate:
   - Silence detection: <5% of total duration
   - Clipping detection: no samples at max amplitude
   - Duration validation: matches expected from word count

7. **And** if quality check fails, stage returns DEGRADED status

## Tasks / Subtasks

- [x] Task 1: Implement chunkScript (AC: #1)
  - [x] Split at sentence boundaries
  - [x] Respect maxChars limit
  - [x] Preserve SSML tags
  - [x] Return indexed chunks

- [x] Task 2: Implement chunk synthesis (AC: #2, #4)
  - [x] Synthesize each chunk independently
  - [x] Store individual segments
  - [x] Track segment metadata

- [x] Task 3: Implement stitchAudio (AC: #3, #5)
  - [x] Concatenate WAV segments
  - [x] Add inter-segment silence
  - [x] Normalize audio levels
  - [x] Output final WAV

- [x] Task 4: Implement quality checks (AC: #6, #7)
  - [x] Silence percentage check
  - [x] Clipping detection
  - [x] Duration validation
  - [x] Return DEGRADED if fails

## Dev Notes

### Chunking Algorithm

```typescript
function chunkScript(script: string, maxChars = 5000): Chunk[] {
  const sentences = script.split(/(?<=[.!?])\s+/);
  const chunks: Chunk[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      chunks.push({ text: current, index: chunks.length });
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current) chunks.push({ text: current, index: chunks.length });
  return chunks;
}
```

### SSML Tag Preservation

When splitting, ensure:
- Opening `<speak>` at start of each chunk
- Closing `</speak>` at end of each chunk
- Phoneme tags not split mid-tag

### Audio Normalization

- Target peak: -3dB
- RMS normalization for consistent loudness
- No clipping allowed

### Quality Thresholds

| Check | Threshold | Action |
|-------|-----------|--------|
| Silence | <5% | PASS |
| Silence | 5-10% | WARN |
| Silence | >10% | FAIL |
| Clipping | 0 samples | PASS |
| Clipping | Any | FAIL |
| Duration | ±10% expected | PASS |
| Duration | >10% off | WARN |

### Storage Structure

```
{date}/tts/
├── audio-segments/
│   ├── 0.wav
│   ├── 1.wav
│   └── 2.wav
└── audio.wav (final)
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented chunkScript with sentence boundary detection
- SSML tags preserved across chunks
- Each chunk synthesized and stored independently
- stitchAudio concatenates with 200ms silence
- Audio normalization to -3dB peak
- Quality checks for silence, clipping, duration
- Returns DEGRADED if quality fails

### File List

**Created/Modified:**
- `nexus-ai/packages/tts/src/chunker.ts`
- `nexus-ai/packages/tts/src/stitcher.ts`
- `nexus-ai/packages/tts/src/audio-quality.ts`

### Dependencies

- **Upstream Dependencies:** Story 3.1 (TTS Package)
- **Downstream Dependencies:** Story 3.6 (Render Service)
