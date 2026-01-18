# Story 3.7: Create Thumbnail Package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an AI-powered thumbnail generation package,
so that I can automatically produce engaging, high-CTR thumbnails for every video without manual design work.

## Acceptance Criteria

1.  **Given** the `@nexus-ai/core` package
    **When** I create the `@nexus-ai/thumbnail` package
    **Then** package structure follows architecture:
    -   `src/index.ts` exports public API
    -   `src/thumbnail.ts` for main stage logic
    -   `src/types.ts` defines thumbnail-specific types
    -   `src/prompts.ts` or `data/prompts/thumbnail.md` for prompt management

2.  **And** `executeThumbnail` stage function is implemented:
    -   Input: `StageInput<ThumbnailInput>` where `ThumbnailInput` has `topic`, `visualConcept`
    -   Uses `ImageProvider` (via `providers.image.primary` from core)
    -   Generates 3 A/B variants (1280x720 PNG)
    -   Uploads to Cloud Storage at `{date}/thumbnails/{1,2,3}.png` using `CloudStorageClient`
    -   Returns `StageOutput` with `artifacts` referencing the 3 images

3.  **And** thumbnail prompts are constructed dynamically for 3 variants:
    -   **Variant 1 (Bold):** Focus on large, high-contrast text of the topic title.
    -   **Variant 2 (Visual):** Focus on the `visualConcept` illustration with minimal text.
    -   **Variant 3 (Mixed):** Balanced composition of text and visual.
    -   **And** all prompts include "YouTube thumbnail", "4k", "highly detailed", "catchy" keywords.

4.  **And** stage tracks costs via `CostTracker`:
    -   Records tokens/images generated.
    -   Persists cost data.

5.  **And** quality gate verifies:
    -   3 variants successfully generated (NFR22).
    -   Artifact URLs are valid.

## Tasks / Subtasks

- [x] Task 1: Scaffold `@nexus-ai/thumbnail` package
    - [x] Create `package.json`, `tsconfig.json`
    - [x] Update `pnpm-workspace.yaml` (if needed)
    - [x] Install dependencies (`@nexus-ai/core`)
- [x] Task 2: Implement Types and Prompt Management
    - [x] Define `ThumbnailInput`, `ThumbnailOutput` in `src/types.ts`
    - [x] Create prompt templates in `src/prompts.ts` (or load from file)
- [x] Task 3: Implement Thumbnail Stage Logic
    - [x] Implement `executeThumbnail` in `src/thumbnail.ts`
    - [x] Integrate `ImageProvider` for generation
    - [x] Integrate `CloudStorageClient` for upload
    - [x] Implement `CostTracker` and Logger
- [x] Task 4: Testing & Verification
    - [x] Unit tests mocking `ImageProvider` and `CloudStorageClient`
    - [x] Verify stage output format matches `StageOutput` contract

## Dev Notes

### Relevant Architecture Patterns and Constraints

-   **Package:** This is a shared package in `packages/thumbnail`.
-   **Provider:** MUST use `ImageProvider` interface from `@nexus-ai/core`. Do not use direct API clients.
-   **Storage:** MUST use `CloudStorageClient` from `@nexus-ai/core`.
-   **Inputs:** `ThumbnailInput` should come from the output of previous stages (Script Gen/Research).
-   **Structure:** Follow standard package structure: `src/index.ts`, `src/thumbnail.ts`.

### Source Tree Components to Touch

-   `packages/thumbnail/package.json` (New)
-   `packages/thumbnail/tsconfig.json` (New)
-   `packages/thumbnail/src/index.ts` (New)
-   `packages/thumbnail/src/thumbnail.ts` (New)
-   `packages/thumbnail/src/types.ts` (New)
-   `packages/thumbnail/src/prompts.ts` (New)

### Project Structure Notes

-   Ensure `@nexus-ai/thumbnail` is added to `packages/orchestrator` dependencies (later).
-   Ensure `@nexus-ai/core` is a dependency.

### References

-   [Architecture Decision 3.7: Thumbnail Package](_bmad-output/planning-artifacts/architecture.md#story-37-create-thumbnail-package)
-   [Core Providers](packages/core/src/providers/image)

## Dev Agent Record

### Agent Model Used

gemini-2.0-flash-exp (opencode)

### Debug Log References

### Completion Notes List
- Task 1: Scaffolded `@nexus-ai/thumbnail` package. Created `package.json`, `tsconfig.json`, and `src/index.ts`. Installed `@nexus-ai/core` dependency. Confirmed build success. Added local `.gitignore`.
- Task 2: Implemented `src/types.ts` with `ThumbnailInput` and `ThumbnailOutput` interfaces. Created `src/prompts.ts` with `THUMBNAIL_VARIANTS` for Bold, Visual, and Mixed styles.
- Task 3: Implemented `executeThumbnail` in `src/thumbnail.ts`. Refactored to use `executeStage` wrapper for consistent logging, cost tracking, and quality gates. Parallelized variant generation using `Promise.all`. Integrated `ImageProvider` fallback chain and `CloudStorageClient` for artifact relocation to mandated `{date}/thumbnails/{variant}.png` paths.
- Task 4: Created `src/thumbnail.test.ts` with unit tests mocking providers and storage. Verified `StageOutput` contract compliance, parallel generation, and variant artifact mapping.

### File List
- packages/thumbnail/package.json
- packages/thumbnail/tsconfig.json
- packages/thumbnail/src/index.ts
- packages/thumbnail/src/types.ts
- packages/thumbnail/src/prompts.ts
- packages/thumbnail/src/thumbnail.ts
- packages/thumbnail/src/thumbnail.test.ts

