/**
 * Render Test V2 — validates the Director Bridge pipeline
 *
 * Calls generateDirectorScenes() from @nexus-ai/visual-gen,
 * then validates the V2 JSON payload structure without performing
 * an actual Remotion render.
 *
 * Requires: NEXUS_GEMINI_API_KEY env var (or GCP Secret Manager access)
 *
 * Usage: npx tsx scripts/render-test-v2.ts
 */

import { generateDirectorScenes } from '../packages/visual-gen/src/director-bridge.js';
import type { DirectorBridgeInput } from '../packages/visual-gen/src/director-bridge.js';
import { SCENE_TYPES } from '../packages/director-agent/src/index.js';

const SAMPLE_SCRIPT = `
Artificial intelligence is transforming the healthcare industry at an unprecedented pace.
Machine learning algorithms can now detect diseases from medical images with accuracy rivaling trained radiologists.

Recent studies show that AI-assisted diagnostics reduce error rates by up to 30 percent.
This is particularly impactful in areas like cancer screening, where early detection saves lives.

But challenges remain. Data privacy concerns, regulatory hurdles, and the need for clinical validation
create significant barriers to adoption. Healthcare systems must balance innovation with patient safety.

Looking forward, the integration of AI with electronic health records promises to unlock
personalized medicine at scale. The future of healthcare is intelligent, automated, and patient-centered.
`.trim();

const AUDIO_DURATION_SEC = 60; // 1 minute
const FPS = 30;

async function main() {
  console.log('=== V2 Director Bridge Render Test ===\n');

  const input: DirectorBridgeInput = {
    script: SAMPLE_SCRIPT,
    audioDurationSec: AUDIO_DURATION_SEC,
    fps: FPS,
    metadata: {
      topic: 'AI in Healthcare',
      title: 'AI Healthcare Revolution',
    },
  };

  console.log(`Script: ${SAMPLE_SCRIPT.length} chars`);
  console.log(`Duration: ${AUDIO_DURATION_SEC}s at ${FPS}fps\n`);

  console.log('Calling generateDirectorScenes()...\n');
  const result = await generateDirectorScenes(input);

  // Build V2 payload (same as visual-gen.ts does)
  const totalDurationFrames = Math.ceil(AUDIO_DURATION_SEC * FPS);
  const v2Payload = {
    version: 'v2-director' as const,
    totalDurationFrames,
    scenes: result.scenes,
  };

  // Test JSON round-trip
  const json = JSON.stringify(v2Payload, null, 2);
  const parsed = JSON.parse(json);

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

  console.log('--- Payload Structure ---');
  check('version is v2-director', parsed.version === 'v2-director');
  check('totalDurationFrames is number', typeof parsed.totalDurationFrames === 'number');
  check('scenes is array', Array.isArray(parsed.scenes));
  check('Has scenes', parsed.scenes.length > 0, `${parsed.scenes.length} scenes`);

  console.log('\n--- JSON Round-trip ---');
  check('JSON round-trip preserves scene count', parsed.scenes.length === result.scenes.length);
  check('JSON round-trip preserves version', parsed.version === v2Payload.version);

  console.log('\n--- Scene Validation ---');
  const validTypes = new Set<string>(SCENE_TYPES);

  for (const scene of parsed.scenes) {
    // Required fields
    check(`Scene ${scene.id} has id`, typeof scene.id === 'string');
    check(`Scene ${scene.id} has valid type`, validTypes.has(scene.type), `type: "${scene.type}"`);
    check(`Scene ${scene.id} has startFrame`, typeof scene.startFrame === 'number');
    check(`Scene ${scene.id} has endFrame`, typeof scene.endFrame === 'number');
    check(`Scene ${scene.id} has content`, typeof scene.content === 'string' && scene.content.length > 0);
    check(`Scene ${scene.id} has visualData object`, typeof scene.visualData === 'object' && scene.visualData !== null);
    check(`Scene ${scene.id} has positive duration`, scene.endFrame > scene.startFrame,
      `${scene.endFrame - scene.startFrame} frames`);
  }

  console.log('\n--- Frame Coverage ---');
  const firstScene = parsed.scenes[0];
  const lastScene = parsed.scenes[parsed.scenes.length - 1];

  check('First scene is intro', firstScene?.type === 'intro', `got "${firstScene?.type}"`);
  check('Last scene is outro', lastScene?.type === 'outro', `got "${lastScene?.type}"`);

  const coverage = lastScene ? lastScene.endFrame / totalDurationFrames : 0;
  check('Frame coverage within 2%', Math.abs(1 - coverage) < 0.02,
    `${(coverage * 100).toFixed(1)}% (${lastScene?.endFrame}/${totalDurationFrames})`);

  // Check max scene duration (no single scene > 30s at 30fps = 900 frames)
  const maxFrames = Math.max(...parsed.scenes.map((s: any) => s.endFrame - s.startFrame));
  const maxSec = maxFrames / FPS;
  check('Max scene duration <= 30s', maxSec <= 30, `${maxSec.toFixed(1)}s (${maxFrames} frames)`);

  console.log('\n--- Bridge Metrics ---');
  console.log(`  Scene count: ${result.sceneCount}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log(`  Type distribution: ${JSON.stringify(result.sceneTypeDistribution)}`);
  check('sceneCount matches scenes.length', result.sceneCount === result.scenes.length);
  check('No critical warnings', result.warnings.length === 0,
    result.warnings.length > 0 ? result.warnings.join('; ') : undefined);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  console.log(`\nV2 JSON payload size: ${json.length} bytes`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('V2 render test failed:', err);
  process.exit(1);
});
