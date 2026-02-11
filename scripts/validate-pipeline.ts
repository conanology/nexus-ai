/**
 * Validate Director Agent Pipeline
 *
 * Calls generateSceneDirection() directly with a sample script,
 * then validates the output: bookends, scene types, durations, and structure.
 *
 * Requires: NEXUS_GEMINI_API_KEY env var (or GCP Secret Manager access)
 *
 * Usage: npx tsx scripts/validate-pipeline.ts
 */

import { generateSceneDirection, SCENE_TYPES } from '../packages/director-agent/src/index.js';
import type { Scene, DirectorInput } from '../packages/director-agent/src/types.js';

const SAMPLE_SCRIPT = `
The SaaS revolution is fundamentally reshaping how businesses operate.
In the past decade, cloud-based software has grown from a niche offering to a dominant force in enterprise technology.

Companies like Salesforce, Slack, and Zoom have demonstrated that subscription-based models can scale rapidly.
Their combined market cap now exceeds 500 billion dollars, a staggering figure that would have been unthinkable just ten years ago.

But what exactly makes SaaS so disruptive?
First, the barrier to entry is dramatically lower. Traditional on-premise software required massive upfront investments.
With SaaS, teams can start with a free tier and scale as needed.

Second, continuous updates mean customers always have the latest features.
Gone are the days of annual upgrade cycles and painful migrations.
The software improves automatically, often without users even noticing.

Third, data analytics built into SaaS platforms give businesses unprecedented visibility.
Real-time dashboards, usage metrics, and predictive analytics are now table stakes.
Companies that don't leverage these insights risk falling behind their competitors.

Looking ahead, AI-powered SaaS tools will define the next wave of innovation.
From automated customer support to intelligent document processing, the possibilities are limitless.
The question isn't whether SaaS will continue to grow — it's how fast.
`.trim();

const FPS = 30;
const AUDIO_DURATION_SEC = 120; // 2 minutes
const TOTAL_DURATION_FRAMES = AUDIO_DURATION_SEC * FPS;

async function main() {
  console.log('=== Director Agent Pipeline Validation ===\n');
  console.log(`Script length: ${SAMPLE_SCRIPT.length} chars`);
  console.log(`Audio duration: ${AUDIO_DURATION_SEC}s (${TOTAL_DURATION_FRAMES} frames at ${FPS}fps)\n`);

  const input: DirectorInput = {
    script: SAMPLE_SCRIPT,
    totalDurationFrames: TOTAL_DURATION_FRAMES,
    fps: FPS,
    metadata: {
      topic: 'SaaS Disruption',
      title: 'The SaaS Revolution',
    },
  };

  console.log('Calling generateSceneDirection()...\n');
  const result = await generateSceneDirection(input);

  // Print storyboard
  console.log('--- Storyboard ---');
  for (const scene of result.scenes) {
    const durFrames = scene.endFrame - scene.startFrame;
    const durSec = (durFrames / FPS).toFixed(1);
    console.log(
      `  [${scene.id}] ${scene.type.padEnd(18)} ` +
      `frames ${scene.startFrame}-${scene.endFrame} (${durSec}s)  ` +
      `"${scene.content.slice(0, 60)}..."`
    );
  }
  console.log();

  // Warnings
  if (result.warnings.length > 0) {
    console.log('--- Warnings ---');
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
    console.log();
  }

  // Validation checks
  let passed = 0;
  let failed = 0;

  function check(label: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  PASS: ${label}`);
      passed++;
    } else {
      console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  console.log('--- Validation ---');

  // 1. Has scenes
  check('Has scenes', result.scenes.length > 0, `got ${result.scenes.length}`);

  // 2. Bookends: first scene is intro, last is outro
  const first = result.scenes[0];
  const last = result.scenes[result.scenes.length - 1];
  check('First scene is intro', first?.type === 'intro', `got "${first?.type}"`);
  check('Last scene is outro', last?.type === 'outro', `got "${last?.type}"`);

  // 3. All scene types are valid
  const validTypes = new Set<string>(SCENE_TYPES);
  const invalidScenes = result.scenes.filter((s) => !validTypes.has(s.type));
  check('All scene types valid', invalidScenes.length === 0,
    invalidScenes.length > 0 ? `invalid: ${invalidScenes.map((s) => s.type).join(', ')}` : undefined);

  // 4. Frames are contiguous (no gaps > 1 frame, no overlaps)
  let contiguous = true;
  for (let i = 1; i < result.scenes.length; i++) {
    const prev = result.scenes[i - 1];
    const curr = result.scenes[i];
    const gap = curr.startFrame - prev.endFrame;
    if (Math.abs(gap) > 1) {
      contiguous = false;
      check(`Scene ${i} contiguous`, false, `gap of ${gap} frames between ${prev.id} and ${curr.id}`);
      break;
    }
  }
  if (contiguous) {
    check('Scenes are contiguous (no gaps/overlaps)', true);
  }

  // 5. Total frame coverage matches totalDurationFrames (within 2%)
  const lastEndFrame = last?.endFrame ?? 0;
  const coverageRatio = lastEndFrame / TOTAL_DURATION_FRAMES;
  check(
    'Frame coverage within 2% of target',
    Math.abs(1 - coverageRatio) < 0.02,
    `coverage: ${(coverageRatio * 100).toFixed(1)}% (${lastEndFrame}/${TOTAL_DURATION_FRAMES} frames)`
  );

  // 6. Each scene has a positive duration
  const zeroDuration = result.scenes.filter((s) => s.endFrame <= s.startFrame);
  check('All scenes have positive duration', zeroDuration.length === 0,
    zeroDuration.length > 0 ? `${zeroDuration.length} scenes with zero/negative duration` : undefined);

  // 7. Scene type distribution has variety
  const typeDistribution = new Map<string, number>();
  for (const s of result.scenes) {
    typeDistribution.set(s.type, (typeDistribution.get(s.type) ?? 0) + 1);
  }
  const uniqueTypes = typeDistribution.size;
  check('Scene type variety (>= 4 types)', uniqueTypes >= 4, `${uniqueTypes} unique types`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Pipeline validation failed:', err);
  process.exit(1);
});
