# Story 2.6: Implement arXiv RSS Source

Status: done

## Story

As a developer,
I want to fetch papers from arXiv cs.AI and cs.LG RSS feeds,
So that latest research papers are included in news coverage.

## Acceptance Criteria

1. **Given** the news sourcing package from Story 2.1
   **When** I implement `ArxivRSSSource`
   **Then** it implements `NewsSource` interface

2. **And** it fetches from arXiv RSS feeds for cs.AI and cs.LG categories

3. **And** it parses RSS XML to extract paper metadata

4. **And** it extracts `viralityScore` based on:
   - Twitter/X mentions (via academic API or scraping)
   - Citation velocity if available
   - Default score based on category popularity

5. **And** it sets `authorityWeight` to 0.95 (academic source)

6. **And** it includes abstract, authors, and categories in metadata

7. **And** it returns maximum 15 items per fetch (higher volume source)

## Tasks / Subtasks

- [x] Task 1: Implement ArxivRSSSource class (AC: #1)
  - [x] Extend BaseNewsSource
  - [x] Set name to 'arxiv'
  - [x] Set authorityWeight to 0.95

- [x] Task 2: Fetch and parse RSS feeds (AC: #2, #3)
  - [x] Fetch cs.AI RSS feed
  - [x] Fetch cs.LG RSS feed
  - [x] Parse XML to extract items
  - [x] Merge and deduplicate

- [x] Task 3: Calculate virality (AC: #4)
  - [x] Attempt to get Twitter mentions
  - [x] Fall back to category-based default
  - [x] Weight recent papers higher

- [x] Task 4: Build metadata (AC: #6, #7)
  - [x] Extract abstract from description
  - [x] Parse authors list
  - [x] Include categories
  - [x] Include arXiv ID
  - [x] Limit to 15 items

## Dev Notes

### arXiv RSS Feeds

- cs.AI: `http://arxiv.org/rss/cs.AI`
- cs.LG: `http://arxiv.org/rss/cs.LG`

### Authority Weight: 0.95

Highest credibility source:
- Peer-reviewed research
- Academic institutions
- Primary sources

### Virality Score Strategy

```typescript
// Priority order:
1. Twitter mentions count (if available)
2. Category base score + recency bonus
   - cs.LG base: 5.0 (more popular)
   - cs.AI base: 4.0
   - Recency bonus: +2 if <12 hours old
```

### Metadata Fields

```typescript
{
  arxivId: string,
  abstract: string,
  authors: string[],
  categories: string[],
  pdfUrl: string,
  htmlUrl: string,
  submittedDate: string
}
```

### RSS Item Structure

```xml
<item>
  <title>Paper Title</title>
  <link>https://arxiv.org/abs/2401.12345</link>
  <description>Abstract text...</description>
  <dc:creator>Author 1, Author 2</dc:creator>
  <arxiv:primary_category term="cs.LG"/>
</item>
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented ArxivRSSSource extending BaseNewsSource
- Fetches from cs.AI and cs.LG RSS feeds
- Parses XML using XML parser library
- Virality based on category popularity + recency
- Authority weight 0.95 (highest for academic)
- Includes abstract, authors, categories in metadata
- Returns max 15 items (higher volume source)

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/sources/arxiv-rss.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.1 (News Sourcing Package)
- **Downstream Dependencies:** Story 2.7 (Freshness Scoring)
