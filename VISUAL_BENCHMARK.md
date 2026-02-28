# Visual Benchmark — Top Channel Frame Dynamics (Initial Pass)

Date: 2026-02-28
Method: YouTube browser instrumentation; sampled first 45s with 1s seek step and per-frame luma-difference scoring.

## Sampled videos

1. Fireship — "When open-sourcing your code goes wrong..."
- Duration: 398.3s
- Resolution: 1920x1080
- Avg frame diff: 30.12
- Max frame diff: 174.46
- Cut count (threshold>=18): 24 in 45s
- Cut rate: 32.00 cuts/min

2. ColdFusion — "OpenAI is Suddenly in Trouble"
- Duration: 1329.97s
- Resolution: 1920x1080
- Avg frame diff: 39.48
- Max frame diff: 144.30
- Cut count: 25 in 45s
- Cut rate: 33.33 cuts/min

3. Marques Brownlee — "Samsung Galaxy S26/Ultra Impressions: 1 Crazy Display Feature!"
- Duration: 549.54s
- Resolution: 1920x960
- Avg frame diff: 22.65
- Max frame diff: 184.30
- Cut count: 14 in 45s
- Cut rate: 18.67 cuts/min

4. Theo / t3.gg — "Trump actually threatened Anthropic (this is bad…)"
- Duration: 1335.30s
- Resolution: 854x480
- Avg frame diff: 9.82
- Max frame diff: 158.94
- Cut count: 3 in 45s
- Cut rate: 4.00 cuts/min

## What this means for Nexus-AI

If the target is "top-tier news-tech visual quality" (Fireship/MKBHD-like), Nexus-AI should not use low-motion long static stretches.

Target visual pacing envelope for first 45s:
- Hook window (0-15s): 35-60 cuts/min equivalent pace
- Exposition window (15-45s): 18-30 cuts/min with higher clarity overlays

Current Nexus gap (observed from architecture):
- Strong automation, weaker shot-level visual direction and rhythm control.
- Missing explicit shot grammar + on-screen narrative hierarchy + pattern-break logic.

## Recommended V2 visual targets

- Shot cadence controller with per-segment cadence presets.
- Pattern-break insertion every 4-7s.
- Scene blueprint with explicit type rotation:
  - face-cam / terminal / graph / product UI / headline / meme relief / CTA board.
- Overlay density policy: one key message per shot.
- Auto-reject render if visual metrics under threshold.

## Notes

This is the initial quantitative benchmark pass. Next pass should add:
- OCR text density per frame,
- subtitle alignment checks,
- motion vector magnitude,
- color/contrast profile clustering,
- retention-correlated pacing model.
