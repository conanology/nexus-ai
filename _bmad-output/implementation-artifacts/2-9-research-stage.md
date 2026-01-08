# Story 2.9: Create Research Stage

Status: done

## Story

As a developer,
I want to generate research briefs from selected topics,
So that scripts have comprehensive source material.

## Acceptance Criteria

1. **Given** selected topic from Story 2.8
   **When** I implement the research stage
   **Then** `@nexus-ai/research` package is created

2. **And** `executeResearch()` stage function:
   - Takes topic URL and metadata as input
   - Calls LLM provider with research prompt
   - Generates 2,000-word research brief per FR6
   - Includes facts, context, implications, key quotes
   - Stores brief to Cloud Storage at `{date}/research/research.md`

3. **And** research prompt includes:
   - Topic title and URL
   - Source metadata
   - Instructions for comprehensive coverage
   - Format requirements (sections, bullet points)

4. **And** stage uses `executeStage` wrapper

5. **And** stage tracks costs via `CostTracker`

6. **And** output includes artifact reference to stored brief

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/research package (AC: #1)
  - [x] Create package structure
  - [x] Add package.json
  - [x] Add tsconfig.json
  - [x] Set up exports

- [x] Task 2: Create research prompts (AC: #3)
  - [x] Define RESEARCH_PROMPT template
  - [x] Include topic context sections
  - [x] Include format requirements
  - [x] Include 2000 word target

- [x] Task 3: Implement executeResearch (AC: #2, #4, #5, #6)
  - [x] Use executeStage wrapper
  - [x] Call LLM provider with prompt
  - [x] Parse and validate response
  - [x] Store to Cloud Storage
  - [x] Track costs
  - [x] Return artifact reference

## Dev Notes

### Package Structure

```
packages/research/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── prompts.ts
    └── research.ts
```

### Research Prompt Structure

```typescript
const RESEARCH_PROMPT = `
You are a senior technology researcher preparing material for a video script.

Topic: {title}
Source: {url}
Published: {publishedAt}

Research this topic thoroughly and produce a 2,000-word research brief covering:

## Summary (200 words)
- What is the core innovation/news?
- Why does this matter?

## Technical Details (600 words)
- How does it work?
- Key technical concepts
- Comparison to alternatives

## Impact & Implications (400 words)
- Who is affected?
- Industry implications
- Future predictions

## Key Quotes & Data (300 words)
- Notable statements from creators/experts
- Statistics and metrics
- Benchmarks if applicable

## Script Hooks (200 words)
- Attention-grabbing angles
- Audience relevance points
- Call-to-action ideas

## Sources (300 words)
- Primary source analysis
- Related coverage
- Expert opinions
`;
```

### Storage Path

`gs://nexus-ai-artifacts/{date}/research/research.md`

### Output Structure

```typescript
interface ResearchOutput {
  brief: string;           // Full markdown content
  wordCount: number;       // Actual word count
  artifactUrl: string;     // Cloud Storage URL
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/research package
- Implemented comprehensive research prompt template
- executeResearch uses executeStage wrapper
- Calls LLM provider with topic context
- Generates ~2000 word research brief
- Stores to Cloud Storage with artifact reference
- Cost tracking via CostTracker

### File List

**Created/Modified:**
- `nexus-ai/packages/research/package.json`
- `nexus-ai/packages/research/tsconfig.json`
- `nexus-ai/packages/research/src/types.ts`
- `nexus-ai/packages/research/src/prompts.ts`
- `nexus-ai/packages/research/src/research.ts`
- `nexus-ai/packages/research/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.8 (Topic Selection), Story 1.5 (LLM Provider)
- **Downstream Dependencies:** Story 2.10 (Script Generation)
