# Feature Specification: V4 Cognitive Generation Overhaul

**Feature Branch**: `002-v4-cognitive-overhaul`
**Created**: 2026-02-22
**Status**: Draft
**Input**: User description: "Nexus-AI V4 Cognitive Generation Overhaul — multi-agent debates, memory, agentic browsing, dynamic data visualization"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Retention Debate (Troll Agent) (Priority: P1)

A pipeline operator runs the video generation pipeline on a trending
topic. Before the script reaches the optimization stage, a dedicated
adversarial reviewer (the "Troll Agent") — whose persona is a highly
critical, easily bored YouTube viewer — evaluates the draft for
retention weaknesses. The Troll Agent specifically flags segments
that lack hooks, have no open loops, or go longer than 15 seconds
without a payoff. The writer revises the script based on the
critique. This loop repeats until the Troll Agent approves or a
maximum round limit is reached. Only then does the script proceed to
the Optimizer stage.

**Why this priority**: Viewer retention is the single most important
quality metric for the output video. A multi-agent debate that
specifically targets boring stretches will have the highest
immediate impact on video quality and watch time. This can be
implemented and tested entirely within the script generation stage.

**Independent Test**: Run the pipeline on any topic. Compare the
final script's retention profile (hook density, open loop count,
longest segment without payoff) before and after enabling the debate
loop. The debate version must score measurably better on all three
metrics.

**Acceptance Scenarios**:

1. **Given** a research brief is available, **When** the script
   generation stage executes, **Then** the writer produces a draft,
   the Troll Agent critiques it with specific line-level feedback on
   boring segments, and the writer produces a revised draft
   addressing those critiques.

2. **Given** the Troll Agent has identified 3 boring segments in a
   draft, **When** the writer revises, **Then** the revised draft
   either eliminates those segments or replaces them with hooks,
   open loops, or payoffs.

3. **Given** the maximum debate round limit (3 rounds) has been
   reached without full approval, **When** the final round
   completes, **Then** the best-scoring draft is selected and passed
   to the optimizer, with a warning logged.

4. **Given** the Troll Agent approves on the first round, **When**
   the debate loop evaluates the result, **Then** the script
   proceeds immediately to the optimizer without unnecessary
   additional rounds.

---

### User Story 2 — Dynamic Data Visualization (Priority: P2)

A pipeline operator generates a video about a topic that includes
statistical comparisons (e.g., "Framework X is 3x faster than
Framework Y" or "adoption grew from 12% to 67%"). The system
automatically detects these statistical claims in the script,
generates a structured dataset representing the numbers, and renders
an animated cinematic chart (bar chart or line graph) as a scene in
the video. The chart follows the project's visual identity (Neon
Hacker aesthetic) and animates data points with entrance effects.

**Why this priority**: Statistical data is one of the most common
content types in tech explainer videos. Currently, stats are shown
as static text overlays (stat-callout scenes). Animated charts are a
significant production value upgrade that viewers immediately notice,
and they require a new scene type with clear integration points.

**Independent Test**: Generate a video whose script contains at
least 2 statistical comparisons. Verify that both render as animated
charts with correct data values, labels, and the Neon Hacker color
scheme. The charts must be visually distinct from stat-callout
scenes.

**Acceptance Scenarios**:

1. **Given** a script segment contains a numerical comparison
   between two or more items, **When** scene classification runs,
   **Then** the system identifies it as a dynamic chart candidate
   and produces a structured dataset with labels and values.

2. **Given** a structured chart dataset exists for a scene, **When**
   the video renders, **Then** the chart animates with sequential
   bar/line entrance effects, uses Neon Green (`#aaff00`) as the
   accent color on a deep black background, and displays correct
   data labels.

3. **Given** a script segment contains a single percentage or
   number without comparison context, **When** scene classification
   runs, **Then** the system uses the existing stat-callout scene
   type instead of a chart (charts require comparative data).

4. **Given** the data generation service is unavailable, **When**
   scene classification identifies a chart candidate, **Then** the
   system falls back to a stat-callout scene with the raw numbers
   and logs a warning.

---

### User Story 3 — Agentic Visual Capture (Priority: P3)

A pipeline operator generates a video that references a specific
product feature, API documentation page, or UI element on a third-
party website. The current static URL + CSS selector approach fails
because the page layout has changed, the selector is stale, or the
content requires navigation (e.g., clicking a tab, scrolling to a
section, or dismissing an interstitial). Instead of returning a
blank or broken screenshot, the system autonomously navigates the
site, searches for the relevant content, and captures a clean
screenshot dynamically.

**Why this priority**: Broken or missing screenshots are visible
quality defects in the final video. Improving screenshot capture
resilience directly improves visual quality for every video
produced. This builds on the existing screenshot infrastructure with
a fallback layer.

**Independent Test**: Create a test scenario with 5 intentionally
broken CSS selectors pointing to real websites. Run the visual
enrichment pipeline. Verify that the agentic fallback successfully
captures at least 3 out of 5 screenshots that would have failed
with the static approach.

**Acceptance Scenarios**:

1. **Given** a scene has a target URL and a CSS selector, **When**
   the static selector fails to find the element, **Then** the
   agentic browser activates as a fallback and attempts to find and
   capture the relevant content by navigating the page.

2. **Given** a target page requires interaction to reveal content
   (e.g., clicking a tab, expanding a section), **When** the
   agentic browser runs, **Then** it performs the necessary
   navigation actions and captures the revealed content.

3. **Given** the agentic browser also fails to find relevant content
   after a reasonable timeout, **When** the fallback completes,
   **Then** the system gracefully skips the screenshot (using the
   next enrichment layer) and logs the failure. The pipeline does
   not crash.

4. **Given** the agentic browser dependency is unavailable or not
   installed, **When** the enrichment pipeline runs, **Then** the
   system uses the existing static screenshot approach only and logs
   a warning. No pipeline interruption occurs.

---

### User Story 4 — Channel Lore & Memory (Priority: P4)

A pipeline operator has produced several videos over time. When
generating a new video on a related topic, the system queries a
persistent memory store for past videos on similar subjects. The
script writer uses this context to include "channel lore" — brief
references to past coverage, callbacks, or continuity statements
(e.g., "As we covered in our deep dive on Rust..."). After the
video is published, the system saves the new video's core topic,
stance, and key claims into the memory store for future reference.

**Why this priority**: Channel lore builds subscriber loyalty and
perceived channel identity — hallmarks of top YouTube channels like
Fireship. However, this feature requires accumulation of historical
data over multiple pipeline runs before it delivers significant
value, making it lower priority for initial implementation.

**Independent Test**: Run the pipeline twice on related topics (e.g.,
"Rust vs Go" then "Rust in production"). Verify that the second
video's script contains at least one reference to the first video's
coverage. Verify the memory store contains entries for both videos
after completion.

**Acceptance Scenarios**:

1. **Given** the memory store contains entries for 3 past videos,
   **When** a new video is generated on a related topic, **Then**
   the research stage retrieves relevant past video summaries and
   the writer incorporates at least one channel lore reference in
   the script.

2. **Given** the memory store is empty (first run), **When** a new
   video is generated, **Then** the script generation proceeds
   normally without channel lore references, and no errors occur.

3. **Given** a video has been successfully rendered, **When** the
   pipeline completes, **Then** the system saves the video's topic,
   title, key claims, and publication date into the memory store.

4. **Given** the memory service is unavailable, **When** the
   research stage attempts to query past videos, **Then** the system
   skips memory retrieval, generates the script without channel lore,
   and logs a warning. The pipeline does not block.

---

### Edge Cases

- What happens when the Troll Agent and Writer enter a disagreement
  loop where revisions make the script worse? The system selects the
  highest-scoring draft across all rounds rather than always using
  the latest revision.

- What happens when chart data contains extreme outliers (e.g., one
  value is 1000x larger than others)? The chart renderer must handle
  scale normalization so all bars/lines are visible.

- What happens when the agentic browser encounters a CAPTCHA or
  login wall? The system must detect these blockers and abort the
  attempt rather than capturing a CAPTCHA page as a screenshot.

- What happens when channel lore references a video that has been
  deleted or made private? The memory store should not validate
  external URLs; references are textual callbacks only (e.g., "we
  talked about X"), not hyperlinks.

- What happens when the memory store grows large over time? The
  store retains all entries indefinitely (no eviction). The system
  limits memory retrieval to the 5 most relevant entries per query
  to control context size regardless of total store volume.

- What happens when statistical data in the script is qualitative
  rather than quantitative (e.g., "significantly faster")? The
  system must only generate charts for segments with explicit
  numerical values, not qualitative comparisons.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST include an adversarial review stage
  (Troll Agent) that evaluates script drafts for retention
  weaknesses before the optimization stage.

- **FR-002**: The Troll Agent MUST evaluate specifically for: (a)
  segments longer than 15 seconds without a hook or payoff, (b)
  absence of open loops before the script midpoint, (c) weak or
  missing opening hook.

- **FR-003**: The writer MUST revise the script based on the Troll
  Agent's line-level critique. The debate loop MUST repeat until
  approval or a maximum of 3 rounds.

- **FR-004**: If the maximum debate rounds are exhausted without
  approval, the system MUST select the best-scoring draft (not
  necessarily the latest) and proceed with a logged warning.

- **FR-005**: The pipeline MUST maintain a persistent memory store
  that records the topic, title, key claims, and stance of each
  completed video.

- **FR-006**: Before script generation, the system MUST query the
  memory store for past videos related to the current topic and
  provide relevant summaries to the writer.

- **FR-007**: The writer MUST incorporate channel lore references
  when relevant past video context is available, limited to brief
  natural callbacks (not forced references to every past video).

- **FR-008**: After successful video completion, the pipeline MUST
  save the new video's metadata to the memory store.

- **FR-009**: Memory store queries and writes MUST NOT block the
  pipeline if the memory service is unavailable. Graceful fallback
  to memoryless generation is required.

- **FR-010**: The visual enrichment pipeline MUST include an agentic
  browser fallback that activates when static CSS selector-based
  screenshot capture fails.

- **FR-011**: The agentic browser MUST be capable of autonomous page
  navigation: scrolling, clicking tabs/buttons, expanding sections,
  and searching within a page to find relevant content.

- **FR-012**: The agentic browser MUST restrict navigation to the
  original URL's domain, with at most one cross-domain redirect hop
  (e.g., CDN, docs subdomain). It MUST detect and abort on blocking
  conditions (CAPTCHAs, login walls, infinite redirects) rather
  than capturing unusable content.

- **FR-013**: The agentic browser MUST operate within a 30-second
  timeout per capture attempt (aligned with Constitution Principle
  XII critical MCP timeout). If the timeout expires, the system
  falls back to the next enrichment layer.

- **FR-014**: If the agentic browser dependency is not installed,
  the system MUST fall back to the existing static screenshot
  approach without errors.

- **FR-015**: The scene classification system MUST identify script
  segments containing statistical comparisons with explicit
  numerical values and classify them as chart candidates.

- **FR-016**: For each chart candidate, the system MUST generate a
  structured dataset containing labeled data points with numerical
  values.

- **FR-017**: The video renderer MUST include a chart scene type
  that animates bar charts or line graphs using the project's Neon
  Hacker visual identity.

- **FR-018**: If chart data generation fails, the system MUST fall
  back to the existing stat-callout scene type with the raw numbers.

- **FR-019**: All new external service integrations (memory store,
  agentic browser, data generation) MUST be wrapped as MCP-
  compatible clients with graceful fallbacks per Constitution
  Principle XII.

- **FR-020**: The Troll Agent's critique MUST include a numerical
  retention score (0-100) for each draft to enable objective
  comparison across debate rounds.

### Key Entities

- **Debate Round**: A single cycle of the writer-critique loop,
  containing the draft text, the Troll Agent's critique with
  line-level feedback, a numerical retention score, and whether
  the draft was approved.

- **Video Memory Entry**: A persistent record of a completed video,
  containing the topic, title, publication date, key claims (3-5
  bullet points), editorial stance, and related topic tags for
  similarity search.

- **Chart Dataset**: A structured representation of statistical data
  extracted from script content, containing a chart type (bar or
  line), a title, and an ordered array of labeled data points with
  numerical values.

- **Agentic Capture Session**: A browser automation session that
  includes the target URL, the search objective (what content to
  find), the sequence of navigation actions performed, the final
  screenshot result (or failure reason), and the total elapsed time.

## Assumptions

- **Debate round limit**: 3 rounds maximum before force-selecting
  the best draft. This balances quality improvement against pipeline
  latency and API costs.

- **Memory store**: A local-first approach (consistent with
  Principle V — Dual-Mode Operation) that works without cloud
  services. Vector similarity search is used for topic matching.
  All entries are retained indefinitely (no eviction or TTL).

- **Agentic browser activation**: Fallback only — the static CSS
  selector approach remains the primary capture method. The agentic
  browser only activates when the static method fails.

- **Chart trigger threshold**: Only segments with 2+ explicit
  numerical values in a comparative context trigger chart
  generation. Single numbers continue to use stat-callout.

- **Memory retrieval limit**: Maximum 5 most relevant past video
  entries are retrieved per query to control context window size.

- **Channel lore density**: Maximum 2 channel lore references per
  video to keep callbacks natural and avoid over-referencing.

## Clarifications

### Session 2026-02-22

- Q: What are the agentic browser's navigation boundaries? → A: Same-domain + one cross-domain redirect hop allowed (e.g., CDN, docs subdomain). No unrestricted cross-domain navigation.
- Q: What is the memory store retention policy? → A: Keep all entries forever. No eviction or TTL. Retrieval limit (5 per query) handles relevance filtering.
- Q: What is the agentic browser per-page timeout? → A: 30 seconds per capture attempt, aligned with Constitution XII critical MCP timeout. Allows 2-3 navigation actions before abort.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scripts produced with the debate loop active have
  fewer than 1 segment exceeding 15 seconds without a hook or
  payoff, compared to the current average of 3-4 such segments.

- **SC-002**: The average retention score (as rated by the Troll
  Agent) of final approved scripts is above 70/100.

- **SC-003**: At least 80% of chart-eligible scenes (those with
  comparative numerical data) render as animated charts with correct
  data values in the final video.

- **SC-004**: Visual capture success rate for scenes that previously
  failed static screenshot capture improves by at least 40% when
  the agentic browser fallback is enabled.

- **SC-005**: After 5 pipeline runs on related topics, at least 60%
  of subsequent videos contain at least one natural channel lore
  reference that was sourced from the memory store.

- **SC-006**: No new external service integration (memory, browser,
  data generation) causes the pipeline to fail when that service is
  unavailable. All fallback paths produce valid video output.

- **SC-007**: The debate loop adds no more than 90 seconds of
  additional pipeline execution time on average (across all debate
  rounds).

- **SC-008**: Chart animations complete rendering without errors for
  datasets containing between 2 and 12 data points.
