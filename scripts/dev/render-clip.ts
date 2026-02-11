#!/usr/bin/env tsx
/**
 * render-clip.ts — Render a minimal 10-second test clip for quick visual verification.
 * Usage: npx tsx scripts/dev/render-clip.ts
 *
 * Creates a 3-scene video (intro + stat-callout + outro) at 300 frames (10s @ 30fps).
 * Output: ./output/test-clip/video.mp4
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'output', 'test-clip');
const ENTRY = join(ROOT, 'apps', 'video-studio', 'src', 'index.ts');
const PUBLIC_DIR = join(ROOT, 'apps', 'video-studio', 'public');

const FPS = 30;
const TOTAL_FRAMES = 300; // 10 seconds

const testScenes = [
  {
    type: 'intro',
    narration: 'Welcome to Nexus AI test render.',
    startFrame: 0,
    durationInFrames: 90,
    visualData: { episodeNumber: 0, episodeTitle: 'Render Test' },
    pacing: 'normal',
    transition: 'cut',
  },
  {
    type: 'stat-callout',
    narration: 'This test verifies that all visual layers render correctly.',
    startFrame: 90,
    durationInFrames: 120,
    visualData: { number: '16', label: 'Scene Types', suffix: '', countUp: true },
    pacing: 'punch',
    transition: 'crossfade',
  },
  {
    type: 'outro',
    narration: 'Render test complete.',
    startFrame: 210,
    durationInFrames: 90,
    visualData: { nextTopicTeaser: 'Next: full pipeline test' },
    pacing: 'normal',
    transition: 'dissolve',
  },
];

async function main(): Promise<void> {
  console.log('Render Clip Test');
  console.log('='.repeat(40));
  console.log(`Scenes: ${testScenes.length}`);
  console.log(`Duration: ${TOTAL_FRAMES / FPS}s (${TOTAL_FRAMES} frames @ ${FPS}fps)`);
  console.log('');

  if (!existsSync(ENTRY)) {
    console.error(`Entry not found: ${ENTRY}`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Bundling video-studio...');
  const bundled = await bundle({
    entryPoint: ENTRY,
    publicDir: PUBLIC_DIR,
  });
  console.log('Bundle complete.\n');

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'TechExplainer',
    inputProps: {
      scenes: testScenes,
      meta: { title: 'Render Test', topic: 'test' },
    },
  });
  console.log(`Composition: ${composition.id}, ${composition.durationInFrames} frames\n`);

  const outputPath = join(OUTPUT_DIR, 'video.mp4');
  console.log('Rendering...');
  await renderMedia({
    composition: { ...composition, durationInFrames: TOTAL_FRAMES },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      scenes: testScenes,
      meta: { title: 'Render Test', topic: 'test' },
    },
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 25 === 0) {
        process.stdout.write(`  ${Math.round(progress * 100)}%\r`);
      }
    },
  });

  console.log(`\nDone! Output: ${outputPath}`);

  const { size } = await import('fs').then((fs) => fs.statSync(outputPath));
  console.log(`File size: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error('Render failed:', err.message);
  process.exit(1);
});
