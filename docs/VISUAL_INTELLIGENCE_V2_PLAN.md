# Visual Intelligence V2 — Research + Comprehensive Plan

Date: 2026-02-28
Owner: Nexus-AI Visual Pipeline

## Objective
Upgrade Nexus-AI from generic asset automation to elite, evidence-first visual storytelling suitable for top-tier tech/news channels.

## Research summary (internet + benchmark + codebase)

### Internet/industry findings
- YouTube retention guidance consistently emphasizes first-30-second hook density and frequent pattern breaks.
- High-performing explainers use fast context switches in hook segments, then controlled pacing in exposition segments.
- Evidence visuals (source screenshots, repos, tweets, product UIs) increase trust versus abstract filler backgrounds.
- Accessibility standards (WCAG contrast/readability) are relevant for on-screen citation and callout overlays.

### Quant benchmark (our browser instrumentation)
- Fireship sample: ~32 cuts/min in first 45s, high visual delta.
- ColdFusion sample: ~33.3 cuts/min in first 45s.
- MKBHD sample: ~18.7 cuts/min in first 45s (cleaner, less frenetic pacing).
- Theo/t3 sample: low cut cadence, commentary-focused style (~4 cuts/min).

### Codebase findings
- Current visual pipeline already has multiple enrichers and a cascade in `packages/visual-gen/src/asset-fetcher.ts`.
- `source-screenshot-enricher.ts` and `content-screenshot-enricher.ts` currently block `twitter.com` and `x.com`.
- Scene overlays exist (`SourceCitation`, `SourceBadge`) but source-type semantics are still limited.
- There is no unified URL intelligence layer for tweet/repo/app/article-specific capture strategy.

## Core gap
Current system is automation-strong but asset-semantic-light. It captures screenshots, but does not fully reason about source type and best presentation strategy per source class.

## V2 architecture plan

### Layer 1 — Asset Intelligence (new)
Introduce a URL intelligence module that classifies and normalizes source URLs into:
- tweet/x-post
- repository
- app/product website
- article/news source
- generic webpage

For each class, produce capture strategy:
- normalized URL (e.g., x.com -> vxtwitter for capturable rendering),
- wait budget,
- default selector hints,
- foreground/background display recommendation,
- credibility metadata hooks.

### Layer 2 — Enricher integration
- Integrate Asset Intelligence into source/content screenshot enrichers.
- Remove blanket twitter/x blocking and replace with safe normalization + fallback strategy.
- Ensure scene-level display modes are decided by source class + content intent.

### Layer 3 — Scene semantics for evidence visuals
- Add source-type-aware scene data paths for tweet/repo/app/article cards.
- Prioritize evidence visuals over generic/generated backgrounds where relevant.

### Layer 4 — Quality gates (next milestone)
- Enforce minimum evidence coverage per video.
- Enforce cadence envelope by segment (hook vs exposition).
- Reject publish when visual trust metrics fail thresholds.

## Development phases

### Phase A (now)
1. Build `asset-intelligence.ts` with URL classification + strategy generation.
2. Wire into `source-screenshot-enricher.ts` and `content-screenshot-enricher.ts`.
3. Add tests validating URL classification/normalization and source strategy behavior.

### Phase B
1. Add dedicated tweet/repo/app visual scene templates in video-studio.
2. Add metadata extraction (GitHub repo stats, tweet context) where API access exists.
3. Add strategy-aware overlays (source authority, timestamp, context tags).

### Phase C
1. Add visual quality scoring (evidence coverage + pacing + density).
2. Feed score into orchestrator publish gate.
3. Add weekly benchmark drift report against target channels.

## Acceptance criteria for Phase A
- Tweet/X sources can be processed through normalized capture flow.
- GitHub repo URLs use repo-oriented capture strategy defaults.
- Enrichers consume strategy outputs and set scene display mode consistently.
- Unit tests pass for URL intelligence core logic.

## Risks and controls
- Third-party platform anti-bot changes -> keep agentic browser fallback enabled.
- API quotas for source metadata -> design with optional metadata adapters + fallbacks.
- Overfitting to one channel style -> keep benchmark profiles configurable by channel mode.

