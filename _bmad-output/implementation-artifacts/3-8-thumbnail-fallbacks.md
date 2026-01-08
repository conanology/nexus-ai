# Story 3.8: Implement Thumbnail Fallbacks

Status: done

## Story

As a developer,
I want template-based thumbnail fallbacks,
So that thumbnails are always generated.

## Acceptance Criteria

1. **Given** thumbnail package from Story 3.7
   **When** I implement thumbnail fallbacks per FR23
   **Then** `generateTemplateThumbnail(title: string, variant: number)` function:
   - Uses pre-designed template images
   - Overlays topic title text
   - Applies NEXUS-AI branding
   - Outputs 1280x720 PNG

2. **And** template assets stored in `data/templates/thumbnails/`:
   - `template-1.png` - Bold text template
   - `template-2.png` - Visual focus template
   - `template-3.png` - Mixed template

3. **And** fallback trigger conditions:
   - Image provider returns error after retries
   - Generated image fails quality check (too dark, wrong size)
   - Cost budget exceeded for thumbnails

4. **And** fallback tracking:
   - Log warning when fallback used
   - Track in quality metrics as `thumbnailFallback: true`
   - If fallback used, flag as DEGRADED (hurts CTR)

5. **And** `executeThumbnail()` integrates fallback:
   1. Try AI generation with retry
   2. On failure, generate template thumbnails
   3. Always produce 3 variants
   4. Return with appropriate quality status

## Tasks / Subtasks

- [x] Task 1: Create template thumbnails (AC: #2)
  - [x] Design template-1.png (bold text)
  - [x] Design template-2.png (visual)
  - [x] Design template-3.png (mixed)
  - [x] Store in data/templates/thumbnails/

- [x] Task 2: Implement generateTemplateThumbnail (AC: #1)
  - [x] Load template image
  - [x] Overlay title text
  - [x] Apply NEXUS branding
  - [x] Output 1280x720 PNG

- [x] Task 3: Define fallback triggers (AC: #3)
  - [x] Catch image provider errors
  - [x] Check image quality
  - [x] Monitor cost budget

- [x] Task 4: Implement fallback tracking (AC: #4)
  - [x] Log warning on fallback
  - [x] Set thumbnailFallback: true
  - [x] Flag as DEGRADED

- [x] Task 5: Integrate into executeThumbnail (AC: #5)
  - [x] Try AI first
  - [x] Fall back on failure
  - [x] Always produce 3 variants
  - [x] Return quality status

## Dev Notes

### Template Structure

```
data/templates/thumbnails/
├── template-1.png  # Bold text area, dark gradient
├── template-2.png  # Visual background, text overlay zone
└── template-3.png  # Split layout, text left
```

### Text Overlay

Using Canvas or Sharp library:
- Font: Inter Bold
- Color: White with black outline
- Position: Per template design
- Max characters: 50 (truncate with ...)

### Fallback Decision Flow

```
1. Try AI generation (with retry)
2. If success → validate quality
   - Check dimensions (1280x720)
   - Check not too dark
   - Check not corrupted
3. If validation fails → fallback
4. If AI fails after retries → fallback
5. If cost > budget → fallback
6. Fallback generates templates
```

### Quality Status

| Scenario | Status | Metrics |
|----------|--------|---------|
| All AI success | PASS | thumbnailFallback: false |
| Partial fallback | WARN | thumbnailFallback: true |
| All fallback | DEGRADED | thumbnailFallback: true |

### Cost Budget

Default thumbnail budget: $0.03 per video
- ~$0.01 per AI generation
- 3 attempts before fallback

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created 3 template thumbnails in NEXUS brand style
- Implemented generateTemplateThumbnail with text overlay
- Fallback triggers: errors, quality fails, cost exceeded
- Fallback tracking in quality metrics
- DEGRADED status when fallback used
- executeThumbnail always produces 3 variants
- Templates stored in data/templates/thumbnails/

### File List

**Created/Modified:**
- `nexus-ai/packages/thumbnail/src/template-fallback.ts`
- `nexus-ai/packages/thumbnail/src/thumbnail.ts` (integration)
- `nexus-ai/data/templates/thumbnails/template-1.png`
- `nexus-ai/data/templates/thumbnails/template-2.png`
- `nexus-ai/data/templates/thumbnails/template-3.png`

### Dependencies

- **Upstream Dependencies:** Story 3.7 (Thumbnail Package)
- **Downstream Dependencies:** Story 4.3 (YouTube Thumbnail Upload)

---

## Epic 3 Complete

**Stories Completed:** 8/8
- Story 3.1: Create TTS Package ✅
- Story 3.2: Implement Audio Chunking and Stitching ✅
- Story 3.3: Create Visual Generation Package ✅
- Story 3.4: Implement Remotion Video Studio ✅
- Story 3.5: Implement Visual Fallbacks ✅
- Story 3.6: Create Render Service ✅
- Story 3.7: Create Thumbnail Package ✅
- Story 3.8: Implement Thumbnail Fallbacks ✅

**FRs Covered:** FR16-23 (100%)

**NFRs Addressed:** NFR7 (render time), NFR19 (programmatic visuals), NFR22 (3 thumbnails)

**Outcome:** Complete media production pipeline from scripts to rendered videos with thumbnails
