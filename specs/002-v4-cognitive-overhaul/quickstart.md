# Quickstart: V4 Cognitive Generation Overhaul

**Branch**: `002-v4-cognitive-overhaul` | **Date**: 2026-02-22

## Prerequisites

- Node >= 20, pnpm 10.x
- `NEXUS_GEMINI_API_KEY` set in `.env.local`
- `STORAGE_MODE=local` in `.env.local`
- (Optional) `@browserbasehq/stagehand` installed for agentic browsing

## Setup

```bash
# Switch to feature branch
git checkout 002-v4-cognitive-overhaul

# Install dependencies (includes new better-sqlite3)
pnpm install

# Optional: install Stagehand for agentic browser fallback
pnpm add -D @browserbasehq/stagehand --filter @nexus-ai/visual-gen
```

## Verify Changes

```bash
# Type-check affected packages
cd packages/script-gen && npx tsc --noEmit && cd ../..
cd packages/director-agent && npx tsc --noEmit && cd ../..
cd packages/visual-gen && npx tsc --noEmit && cd ../..
cd apps/video-studio && npx tsc --noEmit && cd ../..

# Run tests for affected packages
pnpm test --filter @nexus-ai/script-gen
pnpm test --filter @nexus-ai/director-agent
pnpm test --filter @nexus-ai/visual-gen

# Rebuild director-agent (required after scene type changes)
cd packages/director-agent && npx tsc && cd ../..
```

## Test Each Pillar Independently

### P1: Troll Agent Debate

```bash
# Run pipeline — observe debate loop in console output
pnpm run pipeline:local "Rust vs Go for microservices"

# Look for:
#   [Troll] Round 1: Score 45/100 — NOT APPROVED
#   [Writer] Revising draft based on critique...
#   [Troll] Round 2: Score 72/100 — APPROVED
#   [Optimizer] Using debate-winning draft
```

### P2: Dynamic Chart

```bash
# Use a topic with statistical comparisons
pnpm run pipeline:local "JavaScript framework benchmarks 2026"

# Look for:
#   [Director] Scene 12: dynamic-chart (bar) — "Framework Performance"
#   [Render] DynamicChart: 4 data points, sequential animation
```

### P3: Agentic Browser (requires Stagehand)

```bash
# Run pipeline with source screenshots enabled
pnpm run pipeline:local "OpenAI GPT-5 announcement"

# Look for:
#   [Screenshot] CSS selector failed for https://openai.com/...
#   [Agentic] Attempting autonomous capture...
#   [Agentic] Action: scrolled to "GPT-5" section
#   [Agentic] Captured screenshot (2.3s)
```

### P4: Channel Memory

```bash
# First run — no memory
pnpm run pipeline:local "Rust in production"
# Look for: [Memory] No past videos found (empty store)

# Second run — related topic
pnpm run pipeline:local "Rust vs C++ performance"
# Look for: [Memory] Found 1 related video: "Rust in production"
# Script should contain a channel lore reference
```

## Validation Checklist

- [ ] Debate loop runs and selects best draft (check console logs)
- [ ] Dynamic chart scenes render in final video (check MP4)
- [ ] Charts use Neon Green (#aaff00) on black background
- [ ] Memory store created at `local-storage/memory/channel-lore.db`
- [ ] Second pipeline run references first video's topic
- [ ] Pipeline completes without Stagehand installed (graceful skip)
- [ ] All fallback paths work when services are unavailable
