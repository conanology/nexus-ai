# Story 1.9: Implement Quality Gate Framework

Status: done

## Story

As a developer,
I want quality gates that validate stage outputs,
So that low-quality content is caught before publishing.

## Acceptance Criteria

1. **Given** cost tracking from Story 1.8
   **When** I implement the quality gate framework
   **Then** `QualityGate` interface defines:
   - `check(stageName, output)` returns `QualityGateResult`

2. **And** `QualityGateResult` includes:
   - `status`: 'PASS' | 'WARN' | 'FAIL'
   - `metrics`: stage-specific quality measurements
   - `warnings`: array of warning messages
   - `reason`: failure reason if status is FAIL

3. **And** stage-specific gates are defined per architecture:
   - `script-gen`: word count 1200-1800
   - `tts`: silence <5%, no clipping detection
   - `render`: zero frame drops, audio sync <100ms
   - `thumbnail`: 3 variants generated

4. **And** `qualityGate.check(stage, output)` dispatches to correct gate

5. **And** gates log quality metrics via structured logger

6. **And** pre-publish gate `qualityGateCheck(pipelineRun)` returns:
   - `AUTO_PUBLISH`: no issues
   - `AUTO_PUBLISH_WITH_WARNING`: minor issues (≤2, no TTS fallback)
   - `HUMAN_REVIEW`: major quality compromises

## Tasks / Subtasks

- [x] Task 1: Define quality gate interfaces (AC: #1, #2)
  - [x] Create QualityGate interface
  - [x] Create QualityGateResult type with status, metrics, warnings, reason
  - [x] Create QualityStatus type: PASS, WARN, FAIL

- [x] Task 2: Implement script-gen gate (AC: #3)
  - [x] Check word count 1200-1800 range
  - [x] FAIL if outside range
  - [x] Return word count in metrics

- [x] Task 3: Implement TTS gate (AC: #3)
  - [x] Check silence percentage <5%
  - [x] Check for audio clipping
  - [x] FAIL if clipping detected
  - [x] WARN if silence 3-5%

- [x] Task 4: Implement render gate (AC: #3)
  - [x] Check frame drop count
  - [x] Check audio sync offset <100ms
  - [x] FAIL if frame drops or sync issues

- [x] Task 5: Implement thumbnail gate (AC: #3)
  - [x] Check 3 variants generated
  - [x] FAIL if <3 variants
  - [x] Check image dimensions

- [x] Task 6: Create gate dispatcher (AC: #4, #5)
  - [x] Create checkQuality function that routes to correct gate
  - [x] Log metrics via structured logger

- [x] Task 7: Implement pre-publish gate (AC: #6)
  - [x] Aggregate all stage quality results
  - [x] Return AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, or HUMAN_REVIEW
  - [x] TTS fallback always triggers HUMAN_REVIEW

## Dev Notes

### Quality Gate Decisions

| Condition | Decision |
|-----------|----------|
| No issues | AUTO_PUBLISH |
| ≤2 warnings, no TTS fallback | AUTO_PUBLISH_WITH_WARNING |
| TTS fallback used | HUMAN_REVIEW |
| >30% visual fallbacks | HUMAN_REVIEW |
| Word count outside range | HUMAN_REVIEW |
| >3 pronunciation unknowns | HUMAN_REVIEW |

### Stage-Specific Metrics

| Stage | Metrics |
|-------|---------|
| script-gen | wordCount, paragraphCount |
| tts | silencePercent, clippingDetected, durationSec |
| render | frameDrops, audioSyncMs, fileSize |
| thumbnail | variantCount, dimensions |

### Quality Gate Result Example

```typescript
{
  status: 'WARN',
  metrics: { wordCount: 1180, paragraphCount: 12 },
  warnings: ['Word count slightly below target (1180 < 1200)'],
  reason: null
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created QualityGate interface and QualityGateResult type
- Implemented all 4 stage-specific quality gates
- Created checkQuality dispatcher function
- Implemented pre-publish qualityGateCheck with 3 decision outcomes
- All gates log metrics via structured logger
- TTS fallback always triggers HUMAN_REVIEW as per architecture

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/quality/gates.ts` - Quality gate implementations
- `nexus-ai/packages/core/src/quality/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Story 1.7 (Logging), Story 1.8 (Cost tracking context)
- **Downstream Dependencies:** Story 1.10 (executeStage), Story 5.11 (Pre-publish gate)
