# Story 3.7: Create Thumbnail Package

Status: done

## Story

As a developer,
I want AI-generated thumbnails,
So that videos have engaging click-worthy previews.

## Acceptance Criteria

1. **Given** script and topic from Epic 2
   **When** I create the `@nexus-ai/thumbnail` package
   **Then** package structure includes:
   - `src/index.ts` exports public API
   - `src/thumbnail.ts` for main stage logic
   - `src/template-fallback.ts` for fallback generation

2. **And** `executeThumbnail()` stage function per FR22:
   - Takes topic title and key visual concept as input
   - Uses Image provider (Gemini 3 Pro Image)
   - Generates 3 A/B thumbnail variants
   - Each variant: 1280x720 PNG
   - Stores to `{date}/thumbnails/{1,2,3}.png`

3. **And** thumbnail prompts include:
   - Topic title as text overlay area
   - Key visual concept from script
   - NEXUS-AI brand elements
   - High contrast, YouTube-optimized

4. **And** thumbnail variations:
   - Variant 1: Bold text focus
   - Variant 2: Visual concept focus
   - Variant 3: Mixed approach

5. **And** stage tracks costs via `CostTracker`

6. **And** quality gate verifies 3 variants generated (NFR22)

7. **And** output includes artifact references to all 3 thumbnails

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/thumbnail package (AC: #1)
  - [x] Create package structure
  - [x] Set up exports

- [x] Task 2: Create thumbnail prompts (AC: #3)
  - [x] Base prompt template
  - [x] Brand element instructions
  - [x] YouTube optimization tips

- [x] Task 3: Implement executeThumbnail (AC: #2, #5, #7)
  - [x] Accept topic and visual concept
  - [x] Call Image provider
  - [x] Generate 3 variants
  - [x] Store to Cloud Storage
  - [x] Track costs
  - [x] Return artifact references

- [x] Task 4: Implement variant prompts (AC: #4)
  - [x] Variant 1: Bold text focus
  - [x] Variant 2: Visual concept focus
  - [x] Variant 3: Mixed approach

- [x] Task 5: Add quality gate check (AC: #6)
  - [x] Verify 3 variants generated
  - [x] Check image dimensions
  - [x] FAIL if <3 variants

## Dev Notes

### Package Structure

```
packages/thumbnail/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── prompts.ts
    ├── thumbnail.ts
    └── template-fallback.ts
```

### Variant Prompts

**Variant 1 (Bold Text):**
```
YouTube thumbnail, dark background, bold white/yellow text "{title}",
subtle AI circuit imagery, NEXUS brand colors (indigo/pink),
high contrast, clickable, 1280x720
```

**Variant 2 (Visual):**
```
YouTube thumbnail, {visual_concept} visualization,
futuristic tech aesthetic, glowing elements,
NEXUS brand colors, minimal text area for overlay,
1280x720
```

**Variant 3 (Mixed):**
```
YouTube thumbnail, split design, left side: bold text "{title}",
right side: {visual_concept} imagery, NEXUS gradient accent,
professional tech style, 1280x720
```

### Storage Paths

```
{date}/thumbnails/
├── 1.png (bold text)
├── 2.png (visual)
└── 3.png (mixed)
```

### Quality Requirements (NFR22)

- Must generate exactly 3 variants
- Each: 1280x720 PNG
- File size: <2MB each

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/thumbnail package
- Three variant prompts: bold text, visual, mixed
- Uses Gemini 3 Pro Image provider
- Generates 1280x720 PNG thumbnails
- Stores all 3 to Cloud Storage
- Quality gate verifies 3 variants
- Cost tracking via CostTracker

### File List

**Created/Modified:**
- `nexus-ai/packages/thumbnail/package.json`
- `nexus-ai/packages/thumbnail/tsconfig.json`
- `nexus-ai/packages/thumbnail/src/types.ts`
- `nexus-ai/packages/thumbnail/src/prompts.ts`
- `nexus-ai/packages/thumbnail/src/thumbnail.ts`
- `nexus-ai/packages/thumbnail/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.10 (Script), Story 1.5 (Image Provider)
- **Downstream Dependencies:** Story 3.8 (Fallbacks), Story 4.3 (YouTube)
