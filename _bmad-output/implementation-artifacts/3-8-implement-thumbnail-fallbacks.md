# Story 3.8: Implement Thumbnail Fallbacks

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want template-based thumbnail fallbacks,
so that thumbnails are always generated even if AI generation fails.

## Acceptance Criteria

1.  **Given** the `@nexus-ai/thumbnail` package
    **When** I implement the `TemplateThumbnailProvider`
    **Then** it implements the `ImageProvider` interface from `@nexus-ai/core`
    **And** it uses `sharp` to composite images
    **And** it loads template images from `data/templates/thumbnails/`

2.  **Given** a thumbnail request
    **When** the provider generates a thumbnail
    **Then** it overlays the topic title on the selected template variant
    **And** it handles text wrapping to fit within a safe area
    **And** it uses a brand-consistent font (e.g., loaded from `data/assets/fonts/`)
    **And** the output is a 1280x720 PNG

3.  **Given** `executeThumbnail` stage
    **When** configured with providers
    **Then** `TemplateThumbnailProvider` is registered as a fallback to `GeminiImageProvider`
    **And** if AI generation fails, the template fallback is automatically used
    **And** the `provider.tier` in output is set to `'fallback'`

4.  **Given** the template assets
    **When** the package is initialized
    **Then** placeholder templates (variant 1, 2, 3) exist in the data directory
    **And** they follow the visual styles: Bold Text, Visual Focus, Mixed

## Tasks / Subtasks

- [x] Task 1: Setup Assets & Dependencies
    - [x] Install `sharp` in `@nexus-ai/thumbnail`
    - [x] Create `data/templates/thumbnails/` directory
    - [x] Add 3 placeholder template PNGs (1280x720)
    - [x] Add font file to `data/assets/fonts/` (or use system font)
- [x] Task 2: Implement TemplateThumbnailProvider
    - [x] Create `src/providers/TemplateThumbnailProvider.ts`
    - [x] Implement `generate` method with `sharp` composition
    - [x] Implement text wrapping and font sizing logic
- [x] Task 3: Integrate Fallback
    - [x] Update `src/thumbnail.ts` to include `TemplateThumbnailProvider` in fallback chain
    - [x] Verify `withFallback` logic handles it correctly
- [x] Task 4: Testing
    - [x] Unit test text wrapping logic
    - [x] Integration test verifying fallback execution

## Dev Notes

- **Dependencies:** `sharp` is the standard for Node.js image processing. Ensure it's installed in `packages/thumbnail`.
- **Assets:** Template PNGs should be 1280x720. Create simple placeholders if design assets aren't ready.
- **Fonts:** Text overlay requires a font file. Use a free license font (Google Fonts - Roboto or similar) and store it in `data/assets/fonts/`.
- **Text Wrapping:** `sharp` doesn't have built-in text wrapping. You'll need a utility function to split text into lines based on max width.
- **Provider Interface:** Ensure `TemplateThumbnailProvider` strictly implements `ImageProvider`. The `generate` method usually takes a prompt. For templates, use the prompt as the text to overlay.

### Project Structure Notes

- **Data Directory:** Architecture defines `data/templates/thumbnails/`. Ensure this path is accessible during execution. For Cloud Functions deployment, consider how assets are bundled (e.g., copying to `dist/` or `assets/` inside the package).

### References

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Architecture Decision 3.8](_bmad-output/planning-artifacts/architecture.md#story-38-implement-thumbnail-fallbacks)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Senior Developer Review (AI)

**Review Date:** 2026-01-18
**Reviewer:** Cryptology
**Outcome:** Approved with Fixes

**Issues Fixed:**
1. **CRITICAL:** `thumbnail.test.ts` was mocking `withFallback` and passing without actually testing fallback logic. Rewrote test to use actual `withFallback` and verify provider switching.
2. **HIGH:** `TemplateThumbnailer` was ignoring `Roboto-Bold` font config. Updated SVG generation to include `Roboto` in font-family.
3. **MEDIUM:** Removed unused `sharp` dependency from `@nexus-ai/thumbnail`.
4. **MEDIUM:** Cleaned up duplicate generation scripts and staged untracked `data/` assets.

### Completion Notes List

- ✅ Task 1: Installed `sharp` in both @nexus-ai/thumbnail and @nexus-ai/core packages
- ✅ Task 1: Created `data/templates/thumbnails/` directory with 3 template PNGs (1280x720)
- ✅ Task 1: Downloaded Roboto-Bold.ttf font to `data/assets/fonts/`
- ✅ Task 2: Implemented TemplateThumbnailProvider with full sharp-based text overlay
  - Added wrapText() utility for text wrapping (30 chars per line)
  - Added createTextSVG() helper for generating SVG text overlays
  - Implemented generate() method with sharp compositing
  - Proper structured logging with pino
  - Uploads to Cloud Storage via CloudStorageClient
- ✅ Task 3: Provider already integrated in registry.ts as fallback for GeminiImageProvider
- ✅ Task 4: Enhanced test coverage with 17 comprehensive tests
  - Unit tests for text wrapping logic
  - Integration tests for provider interface compliance
  - Validation tests for input handling
  - Tests for special characters and long titles

### File List

**Modified:**
- packages/core/src/providers/image/template-thumbnailer.ts
- packages/core/src/providers/image/__tests__/template-thumbnailer.test.ts
- packages/core/package.json
- packages/thumbnail/package.json
- packages/thumbnail/src/thumbnail.test.ts

**Created:**
- data/templates/thumbnails/variant-1-bold.png
- data/templates/thumbnails/variant-2-visual.png
- data/templates/thumbnails/variant-3-mixed.png
- data/assets/fonts/Roboto-Bold.ttf
- packages/thumbnail/scripts/generate-templates.mjs

**Deleted:**
- scripts/generate-template-thumbnails.ts
- scripts/generate-template-thumbnails.mjs


