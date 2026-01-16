# Story 2.6: implement-arxiv-rss-source

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to fetch papers from arXiv cs.AI and cs.LG RSS feeds,
so that latest research papers are included in news coverage.

## Acceptance Criteria

1.  **Interface Implementation:** `ArxivRSSSource` implements `NewsSource` interface from `@nexus-ai/news-sourcing`.
2.  **Source Fetching:** Fetches from official arXiv RSS feeds for `cs.AI` and `cs.LG` categories.
3.  **Parsing:** Parses RSS XML responses using `fast-xml-parser` to extract paper metadata.
4.  **Deduplication:** Handles potential duplicates between the two feeds (papers often cross-listed).
5.  **Metadata:** Includes abstract, authors (first 3 + et al), and primary categories in metadata.
6.  **Authority Weight:** Sets `authorityWeight` to 0.95 (Academic Source).
7.  **Virality Scoring:** Implements scoring logic. (Note: Twitter/X scraping is out of scope for MVP without search API access; implement "Default score" based on cross-category presence and author reputation signals if available, or static baseline).
8.  **Freshness:** Filters items older than 24 hours (based on `dc:date` or `pubDate`).
9.  **Limiting:** Returns maximum 15 items per fetch (higher volume source).
10. **Error Handling:** Uses `withRetry` for feed fetching and handles XML parsing errors gracefully.

## Tasks / Subtasks

- [x] Create `ArxivRSSSource` class
    - [x] Implement `NewsSource` interface
    - [x] Set `name` to 'arxiv-rss'
    - [x] Set `authorityWeight` to 0.95

- [x] Implement RSS Fetching
    - [x] Use `node-fetch` (via `withRetry`) to get `http://export.arxiv.org/rss/cs.AI`
    - [x] Use `node-fetch` (via `withRetry`) to get `http://export.arxiv.org/rss/cs.LG`
    - [x] Handle fetch errors gracefully (log and continue if one feed fails but other works)

- [x] Implement XML Parsing
    - [x] Import `XMLParser` from `fast-xml-parser`
    - [x] Configure parser to ignore attributes (mostly) but capture `dc:creator`, `dc:date`, `title`, `link`, `description`
    - [x] Parse both feed responses

- [x] Implement Data Mapping & Filtering
    - [x] Map RSS items to `NewsItem` structure
        - [x] Clean up titles (remove " (arXiv:...)")
        - [x] Extract abstract from `description` (clean up HTML if present)
        - [x] Parse authors from `dc:creator`
    - [x] Deduplicate items based on arXiv ID (from link or title)
    - [x] Filter by date (< 24 hours)

- [x] Implement Scoring Logic
    - [x] Base Score: 0.5 (default)
    - [x] Cross-listing Bonus: +0.2 if present in both feeds
    - [x] (Future) Twitter signal placeholder (implement interface but return 0 for now)

- [x] Integration & Testing
    - [x] Unit test: Mock XML response parsing
    - [x] Unit test: Deduplication logic
    - [x] Unit test: Error handling (malformed XML, network error)

## Dev Notes

### Architecture Compliance

- **Libraries:** Use `fast-xml-parser` (already in `package.json`). Do NOT introduce new XML libraries like `xml2js`.
- **Logging:** Use `logger` from `@nexus-ai/core`.
- **Error Handling:** Wrap XML parsing in try/catch and throw `NexusError`.

### Technical Details

**RSS Feed URLs:**
- `http://export.arxiv.org/rss/cs.AI`
- `http://export.arxiv.org/rss/cs.LG`

**XML Parsing Strategy:**
- arXiv RSS uses Dublin Core modules (`dc:creator`, `dc:date`).
- `fast-xml-parser` configuration:
  ```typescript
  const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
  });
  ```
- Note: RSS `title` often includes the paper ID. Strip it for clean display.
- Note: `description` often contains the abstract.

**Virality Scoring (MVP Limit):**
- The PRD mentions "Twitter/X mentions" or "Citation velocity".
- Without a configured Twitter Search API (we only have OAuth for posting), we cannot reliably fetch mention counts.
- **Decision:** Implement the *structure* for this (e.g. a `calculateVirality` method), but for MVP, base it on:
  1.  **Freshness:** Newer = higher (implicit in sorting, but score can reflect it)
  2.  **Cross-category:** If a paper appears in both `cs.AI` and `cs.LG`, it's likely more significant.
  3.  **Author heuristic:** (Optional) If we had a list of "star authors" we could boost, but keep it simple for now.

### Project Structure Notes

- File: `packages/news-sourcing/src/sources/arxiv-source.ts`
- Test: `packages/news-sourcing/src/sources/arxiv-source.test.ts`

### References

- [arXiv RSS Help](https://arxiv.org/help/rss)
- [fast-xml-parser Docs](https://github.com/NaturalIntelligence/fast-xml-parser)

## Dev Agent Record

### Implementation Plan
- [x] Create class structure and tests
- [x] Implement fetching logic with retries
- [x] Implement XML parsing
- [x] Implement data mapping and filtering
- [x] Implement scoring logic
- [x] Final integration tests

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented `ArxivRSSSource` fetching from cs.AI and cs.LG feeds
- Implemented XML parsing using `fast-xml-parser`
- Implemented deduplication and cross-listing bonus scoring
- Implemented filtering by date (< 24h) and limiting to 15 items
- Implemented category extraction from `dc:subject`
- Added comprehensive tests for fetching, parsing, deduplication, and error handling
- Added `.eslintrc.cjs` to `packages/news-sourcing` to enable linting (extended from root config)

### File List

- packages/news-sourcing/src/sources/arxiv-rss-source.ts
- packages/news-sourcing/src/sources/arxiv-rss-source.test.ts
- packages/news-sourcing/.eslintrc.cjs
