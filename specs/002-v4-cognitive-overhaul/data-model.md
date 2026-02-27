# Data Model: V4 Cognitive Generation Overhaul

**Branch**: `002-v4-cognitive-overhaul` | **Date**: 2026-02-22

## Entity: DebateRound

Represents a single cycle of the Troll Agent debate loop within the
script generation stage.

**Attributes**:

| Field          | Type     | Required | Description                               |
|----------------|----------|----------|-------------------------------------------|
| roundNumber    | number   | yes      | 1-indexed round (1, 2, or 3)              |
| draftText      | string   | yes      | Full script text for this round            |
| wordCount      | number   | yes      | Word count of the draft                    |
| trollScore     | number   | yes      | Retention score 0-100                      |
| trollApproved  | boolean  | yes      | Whether the Troll approved this draft      |
| trollCritique  | string   | yes      | Line-level critique from the Troll         |
| hookCount      | number   | yes      | Number of hooks detected by Troll          |
| openLoopCount  | number   | yes      | Number of open loops before midpoint       |
| longestGapSec  | number   | yes      | Longest segment (sec) without payoff       |
| provider       | object   | yes      | LLM provider info { name, tier, attempts } |

**Lifecycle**: Created → Evaluated → (Approved | Rejected)
- Created when Writer produces a revision
- Evaluated when Troll scores it
- Approved if trollScore >= 70 or best score after MAX_ROUNDS

**Relationships**:
- Belongs to a single `ScriptGenOutput` pipeline run
- Array of DebateRounds stored in-memory during pipeline execution
- Not persisted to disk (transient pipeline state)
- Best round's `draftText` forwarded to Optimizer agent

---

## Entity: VideoMemoryEntry

Persistent record of a completed video, stored in the channel
memory SQLite database for cross-video lore references.

**Attributes**:

| Field          | Type       | Required | Description                             |
|----------------|------------|----------|-----------------------------------------|
| id             | string     | yes      | UUID, primary key                        |
| topic          | string     | yes      | Original topic string                    |
| title          | string     | yes      | Video title (from script-gen metadata)   |
| slug           | string     | yes      | URL-safe topic slug                      |
| publishedAt    | string     | yes      | ISO 8601 date of pipeline completion     |
| claims         | string[]   | yes      | 3-5 key claims/takeaways from the video  |
| stance         | string     | yes      | Editorial stance (e.g., "bullish on X")  |
| topicTags      | string[]   | yes      | Lowercase keywords for similarity search |
| source         | string     | yes      | News source (hacker-news, arxiv, etc.)   |
| wordCount      | number     | yes      | Final script word count                  |
| sceneCount     | number     | yes      | Number of scenes in final video          |
| durationSec    | number     | yes      | Video duration in seconds                |

**Identity**: `id` (UUID). Uniqueness enforced by SQLite primary key.

**Lifecycle**: Created once after successful pipeline completion.
Never updated or deleted (append-only, per clarification: retain
all entries forever).

**Relationships**:
- Referenced by future pipeline runs via similarity query
- `topicTags` used for TF-IDF cosine similarity matching
- No foreign key relationships (standalone entity)

**Storage**: SQLite table `video_memory` in
`local-storage/memory/channel-lore.db`.

**Query pattern**: `SELECT * FROM video_memory ORDER BY
similarity(topicTags, ?) DESC LIMIT 5`

---

## Entity: DynamicChartVisualData

Structured representation of chart data, stored as the `visualData`
field on scenes of type `dynamic-chart`. Extracted by the
director-agent during scene classification.

**Attributes**:

| Field          | Type       | Required | Description                             |
|----------------|------------|----------|-----------------------------------------|
| chartType      | enum       | yes      | 'bar' or 'line'                          |
| title          | string     | yes      | Chart title (displayed above chart)      |
| data           | DataPoint[]| yes      | Array of labeled data points             |
| unit           | string     | no       | Unit label (e.g., "%", "ms", "$M")       |
| animationStyle | enum       | no       | 'sequential' or 'simultaneous'           |

**DataPoint sub-entity**:

| Field  | Type   | Required | Description                  |
|--------|--------|----------|------------------------------|
| label  | string | yes      | Category or time label        |
| value  | number | yes      | Numerical value               |

**Validation rules**:
- `data` array must have 2-12 entries (per SC-008)
- `chartType` auto-selected: time-series keywords → 'line', otherwise → 'bar'
- `value` must be finite number (no NaN, no Infinity)
- `title` max 80 characters

**Lifecycle**: Generated during scene classification, consumed by
DynamicChart Remotion component at render time.

**Relationships**:
- Contained within a Scene's `visualData` field
- Validated by Zod schema (with `.passthrough()` per Constitution VI)

---

## Entity: AgenticCaptureSession

Represents a single agentic browser capture attempt within the
visual enrichment pipeline. Used for logging and diagnostics only.

**Attributes**:

| Field            | Type     | Required | Description                           |
|------------------|----------|----------|---------------------------------------|
| targetUrl        | string   | yes      | Original URL to capture                |
| searchObjective  | string   | yes      | Natural language description of target |
| cssSelector      | string   | no       | Original CSS selector that failed      |
| actionsPerformed | string[] | yes      | List of navigation actions taken       |
| resultStatus     | enum     | yes      | 'success', 'timeout', 'blocked', 'error' |
| screenshotBuffer | Buffer   | no       | Captured screenshot (null on failure)  |
| elapsedMs        | number   | yes      | Total time from start to completion    |
| domainHops       | number   | yes      | Number of cross-domain navigations     |
| failureReason    | string   | no       | Description of why capture failed      |

**Lifecycle**: Created at agentic capture start, completed when
capture succeeds or times out. Not persisted — logged to console
at `info` level (success) or `warn` level (failure).

**Relationships**:
- Belongs to a single scene's screenshot capture attempt
- Referenced by the enrichment pipeline's visual source metrics
