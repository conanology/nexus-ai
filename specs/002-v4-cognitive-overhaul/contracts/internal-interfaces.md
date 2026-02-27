# Internal Interface Contracts: V4 Cognitive Generation Overhaul

**Branch**: `002-v4-cognitive-overhaul` | **Date**: 2026-02-22

These are internal TypeScript interfaces between packages. No
external API is exposed by this feature.

---

## Contract 1: Troll Agent (packages/script-gen)

### TrollEvaluation

Returned by the Troll Agent for each debate round.

```typescript
interface TrollEvaluation {
  score: number;           // 0-100 retention score
  approved: boolean;       // true if score >= 70
  critique: string;        // Line-level feedback (markdown)
  metrics: {
    hookCount: number;     // Hooks detected in draft
    openLoopCount: number; // Open loops before midpoint
    longestGapSec: number; // Longest segment without payoff
  };
}
```

### DebateResult

Returned by `executeTrollDebate()`.

```typescript
interface DebateResult {
  bestDraft: string;              // Highest-scoring draft text
  bestScore: number;              // Score of selected draft
  rounds: DebateRound[];          // All rounds for diagnostics
  approvedOnRound: number | null; // Round# of approval, or null
  totalRounds: number;            // Rounds executed (1-3)
}
```

### executeTrollDebate() Signature

```typescript
function executeTrollDebate(
  criticDraft: string,
  researchBrief: string,
  tracker: CostTracker,
  pipelineId: string,
  providers: LLMProvider[],
  options?: { maxRounds?: number; approvalThreshold?: number }
): Promise<DebateResult>;
```

---

## Contract 2: Memory Client (packages/script-gen)

### VideoMemoryEntry

Stored in and retrieved from the memory SQLite database.

```typescript
interface VideoMemoryEntry {
  id: string;              // UUID
  topic: string;           // Original topic
  title: string;           // Video title
  slug: string;            // URL-safe slug
  publishedAt: string;     // ISO 8601
  claims: string[];        // 3-5 key claims
  stance: string;          // Editorial stance
  topicTags: string[];     // Lowercase keywords
  source: string;          // News source
  wordCount: number;
  sceneCount: number;
  durationSec: number;
}
```

### MemoryClient Interface

```typescript
interface MemoryClient {
  /** Query similar past videos. Returns [] on any error. */
  query(topic: string, limit?: number): Promise<VideoMemoryEntry[]>;

  /** Save new video entry. Silent no-op on error. */
  save(entry: Omit<VideoMemoryEntry, 'id'>): Promise<void>;

  /** Close database connection. */
  close(): Promise<void>;
}
```

### Factory

```typescript
/** Returns MemoryClient. Never throws — returns no-op client on failure. */
function createMemoryClient(
  dbPath?: string
): MemoryClient;
```

Default `dbPath`: `local-storage/memory/channel-lore.db`

---

## Contract 3: Agentic Browser (packages/visual-gen)

### AgenticCaptureResult

Returned by the agentic browser capture attempt.

```typescript
interface AgenticCaptureResult {
  buffer: Buffer | null;        // Screenshot PNG buffer, or null
  status: 'success' | 'timeout' | 'blocked' | 'error';
  elapsedMs: number;
  actionsPerformed: string[];   // e.g., ["scrolled to section", "clicked tab"]
  failureReason?: string;
}
```

### captureWithAgenticBrowser() Signature

```typescript
function captureWithAgenticBrowser(
  page: Page,                    // Existing Playwright page
  url: string,                   // Target URL
  searchObjective: string,       // What to find (from scene content)
  options?: {
    timeoutMs?: number;          // Default: 30000
    maxDomainHops?: number;      // Default: 1
  }
): Promise<AgenticCaptureResult>;
```

---

## Contract 4: DynamicChart Scene Type (cross-package)

### DynamicChartVisualData

Shared between `packages/director-agent` and `apps/video-studio`.

```typescript
interface DynamicChartVisualData {
  chartType: 'bar' | 'line';
  title: string;
  data: Array<{ label: string; value: number }>;
  unit?: string;               // e.g., "%", "ms", "$M"
  animationStyle?: 'sequential' | 'simultaneous';
}
```

### Zod Schema

```typescript
const DynamicChartVisualDataSchema = z.object({
  chartType: z.enum(['bar', 'line']),
  title: z.string().max(80),
  data: z.array(z.object({
    label: z.string(),
    value: z.number().finite(),
  })).min(2).max(12),
  unit: z.string().optional(),
  animationStyle: z.enum(['sequential', 'simultaneous']).optional(),
});
```

### Scene Classification Output

When the director-agent classifies a segment as `dynamic-chart`:

```json
{
  "sceneType": "dynamic-chart",
  "visualData": {
    "chartType": "bar",
    "title": "Framework Performance (req/s)",
    "data": [
      { "label": "Express", "value": 15000 },
      { "label": "Fastify", "value": 45000 },
      { "label": "Hono", "value": 78000 }
    ],
    "unit": "req/s",
    "animationStyle": "sequential"
  },
  "pacing": "dense"
}
```

---

## Contract 5: Pipeline Integration (scripts/run-local.ts)

### Memory Read (before script-gen)

```typescript
// Between Step 3 (research) and Step 4 (script-gen)
const memoryClient = createMemoryClient();
const pastVideos = await memoryClient.query(topicData.title, 5);
// Inject into writer prompt via channelHistory parameter
```

### Memory Write (after pipeline completion)

```typescript
// After Step 11 (chapters)
await memoryClient.save({
  topic: topicData.title,
  title: directionDocument.metadata.title,
  slug: directionDocument.metadata.slug,
  publishedAt: new Date().toISOString(),
  claims: extractKeyClaims(scriptText),  // LLM or heuristic
  stance: extractStance(scriptText),     // LLM or heuristic
  topicTags: extractTopicTags(topicData.title, scriptText),
  source: topicData.source,
  wordCount: scriptGenOutput.wordCount,
  sceneCount: enrichedScenes.length,
  durationSec: audioDurationSec,
});
await memoryClient.close();
```
