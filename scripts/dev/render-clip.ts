#!/usr/bin/env tsx
/**
 * render-clip.ts — Render a minimal 10-second test clip for quick visual verification.
 * Usage: npx tsx scripts/dev/render-clip.ts
 *
 * Creates a multi-scene video covering key scene types at 450 frames (15s @ 30fps).
 * Output: ./output/test-clip/video.mp4
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'output', 'test-clip');
const ENTRY = join(ROOT, 'apps', 'video-studio', 'src', 'index.ts');
const PUBLIC_DIR = join(ROOT, 'apps', 'video-studio', 'public');

const FPS = 30;
const TOTAL_FRAMES = 450; // 15 seconds

const testScenes = [
  {
    id: 'scene-0-intro',
    type: 'intro',
    content: 'Welcome to Nexus AI test render.',
    startFrame: 0,
    endFrame: 60,
    visualData: { episodeNumber: 1, episodeTitle: 'Render Test' },
    pacing: 'normal',
    transition: 'cut',
  },
  {
    id: 'scene-1-stat',
    type: 'stat-callout',
    content: 'There are now sixteen different scene types available.',
    startFrame: 60,
    endFrame: 120,
    visualData: { number: '16', label: 'Scene Types', suffix: '', countUp: true },
    pacing: 'punch',
    transition: 'slam',
  },
  {
    id: 'scene-2-text',
    type: 'text-emphasis',
    content: 'The future of automated video production.',
    startFrame: 120,
    endFrame: 180,
    visualData: { phrase: 'Automated Video Production', highlightWords: ['Automated', 'Video'], style: 'slam' },
    pacing: 'punch',
    transition: 'slide-left',
  },
  {
    id: 'scene-3-comparison',
    type: 'comparison',
    content: 'Traditional editing takes hours while AI generates in minutes.',
    startFrame: 180,
    endFrame: 250,
    visualData: {
      left: { title: 'Manual Editing', items: ['Hours per video', 'Repetitive work', 'Expensive'] },
      right: { title: 'AI Pipeline', items: ['Minutes per video', 'Fully automated', 'Low cost'] },
    },
    pacing: 'dense',
    transition: 'slam',
  },
  {
    id: 'scene-4-list',
    type: 'list-reveal',
    content: 'The pipeline includes research, scripting, visuals, and rendering.',
    startFrame: 250,
    endFrame: 330,
    visualData: { title: 'Pipeline Steps', items: ['News Sourcing', 'Research', 'Script Generation', 'Visual Enrichment', 'Remotion Render'], style: 'numbered' },
    pacing: 'dense',
    transition: 'slide-left',
  },
  {
    id: 'scene-5-fullscreen',
    type: 'full-screen-text',
    content: 'This changes everything.',
    startFrame: 330,
    endFrame: 380,
    visualData: { text: 'This changes everything.', alignment: 'center' },
    pacing: 'punch',
    transition: 'cut',
  },
  {
    id: 'scene-6-outro',
    type: 'outro',
    content: 'Render test complete.',
    startFrame: 380,
    endFrame: 450,
    visualData: { nextTopicTeaser: 'Next: full pipeline test' },
    pacing: 'normal',
    transition: 'wipe-down',
  },
];

// Generate a minimal silent WAV (44100 Hz, 16-bit, mono, 15 seconds)
function generateSilentWav(durationSec: number): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(1, 22);  // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);  // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // samples are all zeros (silence)

  return buffer;
}

async function main(): Promise<void> {
  console.log('Render Clip Test — Multi-Scene');
  console.log('='.repeat(40));
  console.log(`Scenes: ${testScenes.length} (intro, stat, text-emphasis, comparison, list, fullscreen, outro)`);
  console.log(`Duration: ${TOTAL_FRAMES / FPS}s (${TOTAL_FRAMES} frames @ ${FPS}fps)`);
  console.log('');

  if (!existsSync(ENTRY)) {
    console.error(`Entry not found: ${ENTRY}`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Create silent audio and serve it via HTTP (Remotion requires HTTP URLs)
  const silentBuf = generateSilentWav(TOTAL_FRAMES / FPS);
  const audioPath = join(OUTPUT_DIR, 'silent.wav');
  writeFileSync(audioPath, silentBuf);

  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': silentBuf.length.toString() });
    res.end(silentBuf);
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const audioPort = (server.address() as any).port;
  const audioUrl = `http://localhost:${audioPort}/silent.wav`;
  console.log(`Audio server: ${audioUrl}`);

  console.log('Bundling video-studio...');
  const bundled = await bundle({
    entryPoint: ENTRY,
    publicDir: PUBLIC_DIR,
    webpackOverride: (config: any) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          '.js': ['.ts', '.tsx', '.js', '.jsx'],
          '.mjs': ['.mts', '.mjs'],
        },
        alias: {
          ...config.resolve?.alias,
          '@nexus-ai/core': false,
          '@nexus-ai/notifications': false,
          '@nexus-ai/config': false,
          '@google-cloud/firestore': false,
          '@google-cloud/storage': false,
          '@google-cloud/secret-manager': false,
          'google-gax': false,
          'gaxios': false,
          'google-auth-library': false,
          '@grpc/grpc-js': false,
          '@grpc/proto-loader': false,
          'pino': false,
          'pino-pretty': false,
          'playwright': false,
          'playwright-core': false,
          '@playwright/test': false,
        },
        fallback: {
          ...config.resolve?.fallback,
          assert: false, buffer: false, child_process: false, cluster: false,
          constants: false, crypto: false, dgram: false, dns: false,
          events: false, fs: false, http: false, http2: false, https: false,
          module: false, net: false, os: false, path: false, perf_hooks: false,
          process: false, punycode: false, querystring: false, readline: false,
          repl: false, stream: false, string_decoder: false, sys: false,
          timers: false, tls: false, tty: false, url: false, util: false,
          v8: false, vm: false, worker_threads: false, zlib: false,
        },
      },
    }),
  });
  console.log('Bundle complete.\n');

  const inputProps = {
    scenes: testScenes,
    totalDurationFrames: TOTAL_FRAMES,
    audioUrl,
  };

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'TechExplainer',
    inputProps,
  });
  console.log(`Composition: ${composition.id}, ${composition.durationInFrames} frames\n`);

  const outputPath = join(OUTPUT_DIR, 'video.mp4');
  console.log('Rendering...');
  await renderMedia({
    composition: { ...composition, durationInFrames: TOTAL_FRAMES },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }: { progress: number }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) {
        process.stdout.write(`  ${pct}%\r`);
      }
    },
  });

  server.close();

  console.log(`\nDone! Output: ${outputPath}`);

  const { statSync } = await import('fs');
  const { size } = statSync(outputPath);
  console.log(`File size: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error('Render failed:', err.message);
  process.exit(1);
});
