# Story 2.3: Implement HuggingFace Papers Source

Status: done

## Story

As a developer,
I want to fetch daily papers from HuggingFace,
So that new research is included in news coverage.

## Acceptance Criteria

1. **Given** the news sourcing package from Story 2.1
   **When** I implement `HuggingFacePapersSource`
   **Then** it implements `NewsSource` interface

2. **And** it fetches from HuggingFace Daily Papers API/page

3. **And** it extracts `viralityScore` from upvotes and comments

4. **And** it sets `authorityWeight` to 0.9 (research credibility)

5. **And** it includes paper abstract in metadata

6. **And** it links to both HuggingFace page and arXiv source

7. **And** it returns maximum 10 items per fetch

## Tasks / Subtasks

- [x] Task 1: Implement HuggingFacePapersSource class (AC: #1)
  - [x] Extend BaseNewsSource
  - [x] Set name to 'huggingface'
  - [x] Set authorityWeight to 0.9

- [x] Task 2: Implement fetch method (AC: #2, #7)
  - [x] Query HuggingFace Daily Papers endpoint
  - [x] Parse paper listings
  - [x] Limit to 10 items

- [x] Task 3: Extract engagement metrics (AC: #3)
  - [x] Get upvote count
  - [x] Get comment count
  - [x] Calculate virality: upvotes + (comments * 2)

- [x] Task 4: Build rich metadata (AC: #5, #6)
  - [x] Include paper abstract
  - [x] Include HuggingFace URL
  - [x] Include arXiv URL if available
  - [x] Include authors list

## Dev Notes

### Virality Score Calculation

```typescript
viralityScore = upvotes + (comments * 2)
```

### Authority Weight: 0.9

HuggingFace daily papers have high research credibility:
- Curated selection
- Academic sources
- Community validation

### Metadata Fields

```typescript
{
  abstract: string,
  huggingfaceUrl: string,
  arxivUrl: string | null,
  authors: string[],
  upvotes: number,
  comments: number,
  publishedDate: string
}
```

### API Endpoint

HuggingFace provides daily papers at:
- `https://huggingface.co/papers` (web)
- API endpoint for structured data

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented HuggingFacePapersSource extending BaseNewsSource
- Fetches from HuggingFace Daily Papers
- Extracts upvotes and comments for virality
- Authority weight 0.9 for research credibility
- Includes abstract, authors, and arXiv links in metadata
- Returns max 10 items per fetch

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/sources/huggingface-papers.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.1 (News Sourcing Package)
- **Downstream Dependencies:** Story 2.7 (Freshness Scoring)
