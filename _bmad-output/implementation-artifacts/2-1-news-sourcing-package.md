# Story 2.1: Create News Sourcing Package

Status: done

## Story

As a developer,
I want a news sourcing package with source interfaces,
So that I can add new news sources consistently.

## Acceptance Criteria

1. **Given** the core package from Epic 1
   **When** I create the `@nexus-ai/news-sourcing` package
   **Then** package structure follows architecture:
   - `src/index.ts` exports public API
   - `src/types.ts` defines source-specific types
   - `src/sources/` directory for individual source implementations
   - `src/scoring.ts` for freshness algorithm
   - `src/news-sourcing.ts` for main stage logic

2. **And** `NewsSource` interface is defined with:
   - `name`: string identifier
   - `fetch()`: returns `NewsItem[]`
   - `authorityWeight`: number (source credibility factor)

3. **And** `NewsItem` type includes:
   - `title`: string
   - `url`: string
   - `source`: string (source name)
   - `publishedAt`: Date
   - `viralityScore`: number (upvotes, stars, etc.)
   - `metadata`: Record<string, unknown>

4. **And** package compiles and exports from `@nexus-ai/news-sourcing`

## Tasks / Subtasks

- [x] Task 1: Create package structure (AC: #1)
  - [x] Create packages/news-sourcing directory
  - [x] Create package.json with @nexus-ai/news-sourcing name
  - [x] Create tsconfig.json extending base config
  - [x] Create src directory structure

- [x] Task 2: Define types (AC: #2, #3)
  - [x] Create NewsSource interface
  - [x] Create NewsItem type
  - [x] Create ScoredNewsItem extending NewsItem
  - [x] Export from types.ts

- [x] Task 3: Create placeholder modules
  - [x] Create sources/index.ts
  - [x] Create scoring.ts
  - [x] Create news-sourcing.ts
  - [x] Create main index.ts with exports

- [x] Task 4: Configure package (AC: #4)
  - [x] Add to workspace in pnpm-workspace.yaml
  - [x] Verify package compiles
  - [x] Verify exports work correctly

## Dev Notes

### Package Structure

```
packages/news-sourcing/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── scoring.ts
    ├── topic-selection.ts
    ├── news-sourcing.ts
    └── sources/
        ├── index.ts
        ├── base.ts
        ├── github-trending.ts
        ├── huggingface-papers.ts
        ├── hacker-news.ts
        ├── reddit.ts
        └── arxiv-rss.ts
```

### NewsItem Fields

| Field | Type | Description |
|-------|------|-------------|
| title | string | Item title |
| url | string | Source URL |
| source | string | Source name (e.g., "github") |
| publishedAt | Date | Publication timestamp |
| viralityScore | number | Engagement metric |
| metadata | object | Source-specific data |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/news-sourcing package with full structure
- Defined NewsSource interface and NewsItem type
- Created base source class for common functionality
- Set up exports for all modules
- Package compiles successfully in workspace

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/package.json`
- `nexus-ai/packages/news-sourcing/tsconfig.json`
- `nexus-ai/packages/news-sourcing/src/types.ts`
- `nexus-ai/packages/news-sourcing/src/sources/base.ts`
- `nexus-ai/packages/news-sourcing/src/sources/index.ts`
- `nexus-ai/packages/news-sourcing/src/scoring.ts`
- `nexus-ai/packages/news-sourcing/src/news-sourcing.ts`
- `nexus-ai/packages/news-sourcing/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Epic 1 (Core package)
- **Downstream Dependencies:** Stories 2.2-2.8 (individual sources and scoring)
