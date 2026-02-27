# Research: V4 Cognitive Generation Overhaul

**Branch**: `002-v4-cognitive-overhaul` | **Date**: 2026-02-22

## Decision 1: Troll Agent Debate Loop Placement

**Decision**: Insert the debate loop after the existing Critic agent
and before the Optimizer agent in `packages/script-gen/src/script-gen.ts`.

**Rationale**: The current pipeline is Writer → Critic → Optimizer.
The Critic already performs a single review pass and produces a
revised draft. The Troll Agent adds an adversarial retention-focused
review loop on the Critic's revised output. The Optimizer then
synthesizes the best-scoring draft into the final dual-output
(narration + direction JSON). This placement:
- Preserves the existing Writer → Critic flow unchanged
- Adds the debate loop as an isolated stage between Critic and Optimizer
- Allows the Optimizer to receive the highest-quality draft
- Keeps the debate cost bounded (Troll reviews Critic output, not raw Writer output)

**Alternatives considered**:
- *Parallel debate (Writer + Troll in parallel → Optimizer synthesis)*:
  Higher quality but doubles LLM calls for every pipeline run.
  Rejected per Constitution VII (YAGNI) — sequential debate with
  early exit is simpler and sufficient.
- *Replace Critic with Troll*: Would lose the Critic's structural
  feedback (format, tags, word count). The Troll has a different
  persona (bored viewer, not script editor). Both serve distinct roles.
- *Post-Optimizer debate*: Too late — the Optimizer produces
  structured JSON that's hard to revise in a debate loop.

**Integration point**: `script-gen.ts` line ~405 (after Critic
extracts revised script, before Optimizer call at line ~409).

---

## Decision 2: Troll Agent Implementation Pattern

**Decision**: Create `packages/script-gen/src/troll-agent.ts` as a
new module exporting `executeTrollDebate()`. Add
`buildTrollPrompt()` to `prompts.ts`.

**Rationale**: Follows the existing pattern where each agent has a
prompt builder in `prompts.ts` and execution logic in the main
module. The Troll Agent needs:
- A distinct persona prompt (bored YouTube viewer, not a script editor)
- Retention-specific evaluation criteria (hooks, open loops, 15s payoff rule)
- A numerical score (0-100) for objective draft comparison
- Line-level critique output format

**Debate loop mechanics**:
1. Troll receives Critic's revised draft
2. Troll outputs: `{ score: number, approved: boolean, critique: string }`
3. If approved (score >= 70) → pass draft to Optimizer
4. If not approved → Writer revises based on Troll critique
5. Repeat up to MAX_DEBATE_ROUNDS (3)
6. If no approval after 3 rounds → select highest-scoring draft

**LLM configuration**: Same provider chain as Critic
(`gemini-3.1-pro-preview` → `gemini-2.5-pro` fallback),
temperature 0.4 (slightly creative for interesting critiques).

---

## Decision 3: Memory Store Technology

**Decision**: Use `better-sqlite3` with a simple embedding-based
similarity search. Store in `local-storage/memory/channel-lore.db`.

**Rationale**: Constitution V (Dual-Mode Operation) requires
local-first operation without cloud dependencies. SQLite is:
- Zero-config, no external server process
- File-based (compatible with local-storage pattern)
- Fast enough for <10,000 entries (realistic channel lifetime)
- Already compatible with the Node.js runtime (native addon)

For similarity search, use TF-IDF cosine similarity on topic tags
rather than neural embeddings. This avoids:
- External embedding API calls (would need Gemini embeddings)
- Large vector storage overhead
- Additional dependency on vector DB libraries

The memory store retains all entries indefinitely (per clarification).
Query returns top 5 by TF-IDF cosine similarity on topic tags +
title keywords.

**Alternatives considered**:
- *Anthropic Memory MCP server*: External dependency, requires
  running a separate process. Rejected per Constitution V
  (must work without external services in local mode).
- *ChromaDB / LanceDB (vector store)*: Overkill for <10K entries.
  Adds heavy native dependencies. Rejected per Constitution VII.
- *Gemini embeddings + cosine search*: Higher quality similarity
  but requires API call per query. Would violate Constitution XII
  (must have fallback if API unavailable). Could be added as
  enhancement later.
- *Plain JSON file*: Simplest, but no indexing. Linear scan for
  similarity would be fine for <1000 entries but doesn't scale.
  SQLite is nearly as simple but supports efficient queries.

**MCP wrapping**: The SQLite client is wrapped as an MCP-compatible
tool in `packages/script-gen/src/memory-client.ts`. Fallback:
return empty results on any SQLite error (file missing, corruption,
permission denied). Pipeline continues without channel lore.

---

## Decision 4: Memory Integration Points

**Decision**: Read before script-gen (run-local.ts Step 4), write
after successful render (run-local.ts Step 11).

**Rationale**:
- **Read**: The writer needs past video context to include channel
  lore references. This context must be available before the Writer
  agent prompt is constructed. Insert at run-local.ts line ~1208
  (between research and script-gen).
- **Write**: Only save after successful video completion to avoid
  storing metadata for failed/incomplete runs. Insert at
  run-local.ts line ~1421 (after chapters generation).

**Data flow**:
- Read: `memoryClient.query(topicData.title)` → returns
  `VideoMemoryEntry[]` (max 5) → injected into writer prompt as
  "Channel History" context section.
- Write: `memoryClient.save({ topic, title, claims, stance, date })`
  → persists to SQLite after successful render.

---

## Decision 5: Agentic Browser Technology

**Decision**: Use Stagehand (`@browserbasehq/stagehand`) as the
agentic browser wrapper, falling back to the existing static
Playwright capture when Stagehand is unavailable.

**Rationale**: Stagehand provides:
- LLM-powered element identification (`page.act("click the pricing tab")`)
- Autonomous navigation with natural language instructions
- Built on Playwright (shares the existing browser instance)
- npm package, TypeScript-native
- Can use the project's existing Gemini API key for LLM calls

The agentic browser is a **fallback only** — static CSS selector
capture remains primary. When `page.locator(cssSelector)` fails
(element not found within 3s timeout), the agentic path activates:
1. Describe the target content from scene context
2. Stagehand navigates the page to find it
3. Capture screenshot of the found element
4. 30-second hard timeout per attempt

**Alternatives considered**:
- *Raw Playwright with heuristic navigation*: Lower quality than
  LLM-guided navigation. Would require hand-coding navigation
  strategies for different site types. Fragile.
- *Puppeteer + custom agent*: Playwright is already the project's
  browser engine. Mixing engines adds complexity.
- *BrowserBase cloud API*: External service dependency. Rejected
  per Constitution V (local mode).

**MCP wrapping**: Wrapped in `packages/visual-gen/src/agentic-browser.ts`.
Fallback: if Stagehand import fails (not installed) or LLM call
fails, return null and let the visual layer cascade handle it.
30s timeout per Constitution XII (critical enrichment).

**Domain restriction**: Same-domain + one redirect hop (per
clarification). Implemented by checking URL origin before and after
each navigation action.

---

## Decision 6: Agentic Browser Integration

**Decision**: Modify `screenshot-service.ts` to call the agentic
browser as a fallback within the existing CSS selector capture path.

**Rationale**: The current flow in screenshot-service.ts (line ~416):
```
if (cssSelector) {
  locator = page.locator(cssSelector).first();
  if (await locator.isVisible({ timeout: 3000 })) {
    return locator.screenshot();
  }
  // CURRENT: falls through to full viewport screenshot
  // NEW: try agentic browser before viewport fallback
}
```

Insert the agentic fallback between CSS selector failure and
viewport fallback. This is minimally invasive — a single `try`
block addition to the existing capture function.

---

## Decision 7: Chart Data Extraction Approach

**Decision**: Extract chart data within the director-agent's LLM
classification call (Gemini `gemini-2.5-flash`), not via a separate
Python/Data MCP server.

**Rationale**: The director-agent already sends every script segment
to Gemini for scene classification. Extending the classification
prompt to also extract chart data when it detects comparative
statistics is:
- Zero additional API calls (data extraction piggybacks on classification)
- Zero new dependencies (no Python, no separate MCP server)
- Consistent with existing architecture (Gemini already parses structured JSON)
- Falls back to heuristic extraction (regex for common patterns)

The LLM returns a `chartData` field in the scene classification
JSON when it assigns type `dynamic-chart`:
```json
{
  "sceneType": "dynamic-chart",
  "visualData": {
    "chartType": "bar",
    "title": "Framework Performance",
    "data": [
      { "label": "React", "value": 67 },
      { "label": "Vue", "value": 45 },
      { "label": "Svelte", "value": 89 }
    ]
  }
}
```

**Alternatives considered**:
- *Python subprocess MCP*: Adds Python runtime dependency, IPC
  overhead, and a new MCP server to manage. Rejected per
  Constitution VII (YAGNI) and V (local mode simplicity).
- *Dedicated Gemini call for chart extraction*: Separate API call
  per chart-eligible segment. Wasteful when classification already
  reads the same content.
- *Client-side chart.js / Recharts in Remotion*: External charting
  library adds bundle bloat. SVG-based custom charts are lighter
  and fully customizable for the Neon Hacker aesthetic.

**Heuristic fallback** (when LLM fails to extract chart data):
- Regex patterns for common comparison formats:
  - `X is N% faster than Y` → bar chart, 2 data points
  - `grew from N% to M%` → line chart, 2 data points
  - `$Nm vs $Mm` → bar chart, 2 data points
- If regex extraction also fails → fall back to stat-callout scene

---

## Decision 8: DynamicChart Rendering Technology

**Decision**: Pure SVG rendering within the Remotion component. No
external charting library.

**Rationale**: The project renders at 1920x1080, 30fps with full
frame-by-frame control via Remotion's `useCurrentFrame()`. Charting
libraries (Chart.js, Recharts, D3) are designed for interactive
DOM rendering, not frame-perfect video animation. A custom SVG
approach:
- Full control over per-frame animation (bar growth, line draw)
- No runtime DOM manipulation overhead
- Consistent with existing components (WorldMap uses SVG, Diagram uses SVG)
- Neon Hacker aesthetic baked into the component, not themed externally
- Smaller bundle (no charting library dependency)

**Chart types supported**:
- **Bar chart**: Vertical bars with sequential entrance (left-to-right spring animation)
- **Line chart**: SVG path with draw-on animation (stroke-dashoffset)
- Auto-selection: time-series keywords (years, months, quarters) → line; otherwise → bar

**Animation timeline**:
- Frame 0-6: Title slam entrance
- Frame 6+: Bars/lines animate sequentially (3-frame stagger per data point)
- Glow effect on data points using `#aaff00` with feGaussianBlur

---

## Decision 9: New Scene Type Registration

**Decision**: Add `'dynamic-chart'` as the 18th scene type following
the established 7-step "Adding New Scene Types" workflow from the
constitution.

**Files to modify**:
1. `apps/video-studio/src/types/scenes.ts` — SceneType union + DynamicChartVisualData
2. `apps/video-studio/src/components/scenes/DynamicChart.tsx` — new component
3. `apps/video-studio/src/SceneRouter.tsx` — register in SCENE_REGISTRY
4. `packages/director-agent/src/types.ts` — mirror SceneType + VisualData
5. `packages/director-agent/src/scene-classifier.ts` — heuristic detection + defaults
6. `packages/director-agent/src/prompts/director-system.ts` — LLM prompt
7. `packages/asset-library/src/audio-assets.ts` — SFX mapping
8. Rebuild director-agent: `npx tsc`

---

## Decision 10: Stagehand Dependency Strategy

**Decision**: Add `@browserbasehq/stagehand` as an optional
peer dependency of `@nexus-ai/visual-gen`. Dynamic import with
try-catch so the pipeline works without it installed.

**Rationale**: Not all pipeline environments need agentic browsing.
Making it optional means:
- `pnpm install` doesn't pull Stagehand in CI/cloud where it's not needed
- Local dev can install it explicitly: `pnpm add -D @browserbasehq/stagehand`
- Dynamic `await import('@browserbasehq/stagehand')` with catch → null
- Constitution XII fallback: if import fails, log warning and skip

**Version**: Latest stable (`^1.x`). Stagehand uses Playwright
internally, compatible with the project's existing Playwright setup.
