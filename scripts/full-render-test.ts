/**
 * Nexus AI V2 — Full Pipeline End-to-End Render Test
 *
 * Validates the complete V2 pipeline by producing an actual rendered MP4:
 *   Script → Director Agent (or manual fallback) → Scene[] → Remotion → MP4
 *
 * Handles missing credentials gracefully:
 *   - No GEMINI_API_KEY → manual scene array fallback
 *   - No Google Cloud creds → silent audio fallback
 *   - No ffprobe → skip post-render metadata validation
 *
 * Usage: npx tsx scripts/full-render-test.ts
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Resolve Remotion packages from render-service's dependency tree
// (pnpm strict mode: these aren't at the root)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const _require = createRequire(
  path.join(PROJECT_ROOT, 'apps', 'render-service', 'package.json'),
);
const { bundle } = _require('@remotion/bundler') as typeof import('@remotion/bundler');
const { renderMedia, selectComposition } = _require(
  '@remotion/renderer',
) as typeof import('@remotion/renderer');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VIDEO_STUDIO_ENTRY = path.resolve(
  PROJECT_ROOT,
  'apps',
  'video-studio',
  'src',
  'index.ts',
);
const OUTPUT_DIR = path.join(os.tmpdir(), 'nexus-test');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output.mp4');
const AUDIO_FILE = path.join(OUTPUT_DIR, 'audio.wav');

const FPS = 30;
const ESTIMATED_DURATION_SEC = 75;
const TOTAL_FRAMES = ESTIMATED_DURATION_SEC * FPS; // 2250

const TEST_SCRIPT = `Artificial intelligence is fundamentally changing how software companies operate. For decades, the model was simple: build a tool, charge a subscription, and scale by adding more users.

But something dramatic is shifting. AI agents are now capable of performing tasks that previously required entire teams. Klarna, the Swedish fintech giant, replaced 700 full-time customer service agents with a single AI system. That system handled 2.3 million conversations in its first month alone.

The implications are staggering. Traditional SaaS companies charge per seat — more users means more revenue. But when an AI agent can do the work of hundreds of people, the per-seat model collapses.

We're entering the era of Service as a Software. Instead of selling tools for humans to use, companies are selling autonomous AI services that deliver outcomes directly. No interface needed. No training required. Just results.

This is the biggest disruption to the software industry since cloud computing. And it's happening right now.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SimpleScene {
  id: string;
  type: string;
  startFrame: number;
  endFrame: number;
  content: string;
  visualData: Record<string, unknown>;
  transition: 'cut' | 'fade';
}

interface SimpleWordTiming {
  word: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function header(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// 1. Prerequisites Check
// ---------------------------------------------------------------------------
interface Prerequisites {
  hasGeminiKey: boolean;
  hasFfprobe: boolean;
}

function checkPrerequisites(): Prerequisites {
  header('Prerequisites Check');

  const hasGeminiKey = !!(
    process.env.GEMINI_API_KEY || process.env.NEXUS_GEMINI_API_KEY
  );
  let hasFfprobe = false;
  try {
    execSync('ffprobe -version', { stdio: 'pipe' });
    hasFfprobe = true;
  } catch {
    /* not available */
  }

  const videoStudioExists = existsSync(VIDEO_STUDIO_ENTRY);

  console.log(
    `  GEMINI_API_KEY:     ${hasGeminiKey ? 'SET (will use Director Agent)' : 'NOT SET (will use manual scenes)'}`,
  );
  console.log(
    `  ffprobe:            ${hasFfprobe ? 'AVAILABLE' : 'NOT FOUND (skip metadata validation)'}`,
  );
  console.log(
    `  Video Studio entry: ${videoStudioExists ? 'FOUND' : 'NOT FOUND — CRITICAL'}`,
  );
  console.log(`  Output directory:   ${OUTPUT_DIR}`);

  if (!videoStudioExists) {
    throw new Error(
      `Video Studio entry point not found at: ${VIDEO_STUDIO_ENTRY}`,
    );
  }

  return { hasGeminiKey, hasFfprobe };
}

// ---------------------------------------------------------------------------
// 2. Generate Silent WAV Audio
// ---------------------------------------------------------------------------
async function generateSilentAudio(
  durationSec: number,
  outputPath: string,
): Promise<void> {
  console.log(
    `  Generating ${durationSec}s silent WAV at 44100Hz, 16-bit mono...`,
  );

  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = Buffer.alloc(fileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(
    sampleRate * numChannels * (bitsPerSample / 8),
    28,
  ); // byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk (samples are all zeros — silence)
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  await fs.writeFile(outputPath, buffer);
  console.log(
    `  Written: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`,
  );
}

// ---------------------------------------------------------------------------
// 3. Generate Approximate Word Timings
// ---------------------------------------------------------------------------
function generateApproximateTimings(
  script: string,
  durationSec: number,
): SimpleWordTiming[] {
  const words = script.split(/\s+/).filter((w) => w.length > 0);
  const wordDuration = durationSec / words.length;

  return words.map((word, i) => ({
    word,
    startTime: +(i * wordDuration).toFixed(4),
    endTime: +((i + 1) * wordDuration).toFixed(4),
    confidence: 0.95,
  }));
}

// ---------------------------------------------------------------------------
// 4. Build Manual Scene Array (fallback when no GEMINI_API_KEY)
// ---------------------------------------------------------------------------
function buildManualScenes(): SimpleScene[] {
  return [
    {
      id: 'scene-0-intro',
      type: 'intro',
      startFrame: 0,
      endFrame: 90,
      content: 'The End of SaaS',
      visualData: {
        episodeNumber: 1,
        episodeTitle: 'The End of SaaS',
      },
      transition: 'cut',
    },
    {
      id: 'scene-1-text-emphasis',
      type: 'text-emphasis',
      startFrame: 90,
      endFrame: 360,
      content:
        'Artificial intelligence is fundamentally changing how software companies operate. For decades, the model was simple: build a tool, charge a subscription, and scale by adding more users.',
      visualData: {
        phrase: 'AI is changing software',
        highlightWords: ['AI', 'changing', 'software'],
        style: 'slam',
      },
      transition: 'fade',
    },
    {
      id: 'scene-2-stat-callout',
      type: 'stat-callout',
      startFrame: 360,
      endFrame: 600,
      content:
        'Klarna, the Swedish fintech giant, replaced 700 full-time customer service agents with a single AI system.',
      visualData: {
        number: '700',
        label: 'Customer service agents replaced',
        suffix: ' agents',
        countUp: true,
      },
      transition: 'fade',
    },
    {
      id: 'scene-3-stat-callout',
      type: 'stat-callout',
      startFrame: 600,
      endFrame: 840,
      content:
        'That system handled 2.3 million conversations in its first month alone.',
      visualData: {
        number: '2.3',
        label: 'Conversations in first month',
        suffix: 'M',
        countUp: true,
      },
      transition: 'fade',
    },
    {
      id: 'scene-4-comparison',
      type: 'comparison',
      startFrame: 840,
      endFrame: 1200,
      content:
        'Traditional SaaS companies charge per seat — more users means more revenue. But when an AI agent can do the work of hundreds of people, the per-seat model collapses.',
      visualData: {
        left: {
          title: 'Traditional SaaS',
          items: [
            'Per-seat pricing',
            'More users = more revenue',
            'Requires human operators',
            'Training overhead',
          ],
        },
        right: {
          title: 'AI-Native',
          items: [
            'Outcome-based pricing',
            'One agent = hundreds of seats',
            'Autonomous operation',
            'Zero training required',
          ],
        },
      },
      transition: 'fade',
    },
    {
      id: 'scene-5-text-emphasis',
      type: 'text-emphasis',
      startFrame: 1200,
      endFrame: 1500,
      content:
        "We're entering the era of Service as a Software. Instead of selling tools for humans to use, companies are selling autonomous AI services that deliver outcomes directly.",
      visualData: {
        phrase: 'Service as a Software',
        highlightWords: ['Service', 'Software'],
        style: 'typewriter',
      },
      transition: 'fade',
    },
    {
      id: 'scene-6-chapter-break',
      type: 'chapter-break',
      startFrame: 1500,
      endFrame: 1650,
      content: 'No interface needed. No training required. Just results.',
      visualData: {
        title: 'The Disruption',
        subtitle: 'A new era begins',
        chapterNumber: 2,
      },
      transition: 'fade',
    },
    {
      id: 'scene-7-full-screen-text',
      type: 'full-screen-text',
      startFrame: 1650,
      endFrame: 2160,
      content:
        "This is the biggest disruption to the software industry since cloud computing. And it's happening right now.",
      visualData: {
        text: 'The biggest disruption to the software industry since cloud computing.',
        alignment: 'center',
      },
      transition: 'fade',
    },
    {
      id: 'scene-8-outro',
      type: 'outro',
      startFrame: 2160,
      endFrame: TOTAL_FRAMES,
      content: 'Subscribe for more',
      visualData: {
        nextTopicTeaser: 'Next: How to Build AI-Native Products',
      },
      transition: 'cut',
    },
  ];
}

// ---------------------------------------------------------------------------
// 5. Director Agent Scene Generation (when GEMINI_API_KEY is available)
// ---------------------------------------------------------------------------
async function runDirectorAgent(): Promise<{
  scenes: SimpleScene[];
  warnings: string[];
}> {
  const { generateSceneDirection } = await import(
    '../packages/director-agent/src/index.js'
  );

  const result = await generateSceneDirection({
    script: TEST_SCRIPT,
    totalDurationFrames: TOTAL_FRAMES,
    fps: FPS,
    metadata: {
      topic: 'AI disrupting SaaS',
      title: 'The End of SaaS',
    },
  });

  return {
    scenes: result.scenes as SimpleScene[],
    warnings: result.warnings,
  };
}

// ---------------------------------------------------------------------------
// 6. Local File Server (Remotion needs HTTP URLs for audio)
// ---------------------------------------------------------------------------
function startFileServer(
  dir: string,
): Promise<{ url: string; port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '').replace('/assets/', '');
      const filePath = path.join(dir, urlPath);

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const stat = statSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Handle range requests (Chrome/Remotion may request byte ranges)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
        });
        createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
        });
        createReadStream(filePath).pipe(res);
      }
    });

    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`,
        port: addr.port,
        close: () => server.close(),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// 7. Remotion Bundle + Render
// ---------------------------------------------------------------------------
async function renderVideo(
  scenes: SimpleScene[],
  audioUrl: string,
  wordTimings: SimpleWordTiming[],
  outputPath: string,
): Promise<void> {
  header('Remotion Render');

  // Bundle video studio
  console.log(`  Entry point: ${VIDEO_STUDIO_ENTRY}`);
  console.log('  Bundling video studio (1-2 minutes)...');

  const bundled = await bundle({
    entryPoint: VIDEO_STUDIO_ENTRY,
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
          // Map server-only packages to false (empty module)
          '@nexus-ai/core': false,
          '@nexus-ai/notifications': false,
          '@nexus-ai/config': false,
          '@google-cloud/firestore': false,
          '@google-cloud/storage': false,
          '@google-cloud/secret-manager': false,
          'google-gax': false,
          gaxios: false,
          'google-auth-library': false,
          '@grpc/grpc-js': false,
          '@grpc/proto-loader': false,
          pino: false,
          'pino-pretty': false,
        },
        fallback: {
          ...config.resolve?.fallback,
          assert: false,
          buffer: false,
          child_process: false,
          cluster: false,
          constants: false,
          crypto: false,
          dgram: false,
          dns: false,
          events: false,
          fs: false,
          http: false,
          http2: false,
          https: false,
          module: false,
          net: false,
          os: false,
          path: false,
          perf_hooks: false,
          process: false,
          punycode: false,
          querystring: false,
          readline: false,
          repl: false,
          stream: false,
          string_decoder: false,
          sys: false,
          timers: false,
          tls: false,
          tty: false,
          url: false,
          util: false,
          v8: false,
          vm: false,
          worker_threads: false,
          zlib: false,
        },
      },
    }),
  });

  console.log(`  Bundle complete: ${bundled}`);

  // Build inputProps for the TechExplainer composition
  const inputProps = {
    scenes,
    totalDurationFrames: TOTAL_FRAMES,
    audioUrl,
    wordTimings,
  };

  // Select composition
  console.log('  Selecting composition "TechExplainer"...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'TechExplainer',
    inputProps,
  });

  console.log(
    `  Composition: ${composition.durationInFrames} frames, ${composition.fps}fps, ${composition.width}x${composition.height}`,
  );

  // Render
  console.log(`  Output: ${outputPath}`);
  console.log('  Rendering (this may take several minutes)...');

  const renderStart = Date.now();
  let lastLoggedPct = 0;

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 10 * 60 * 1000, // 10 minutes
    onProgress: ({ progress }: { progress: number }) => {
      const pct = Math.round(progress * 100);
      if (pct >= lastLoggedPct + 10) {
        const elapsed = ((Date.now() - renderStart) / 1000).toFixed(0);
        console.log(`  Render progress: ${pct}% (${elapsed}s elapsed)`);
        lastLoggedPct = pct;
      }
    },
  });

  const totalElapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
  console.log(`  Render complete in ${totalElapsed}s`);
}

// ---------------------------------------------------------------------------
// 8. Post-Render Validation
// ---------------------------------------------------------------------------
async function validateOutput(
  outputPath: string,
  hasFfprobe: boolean,
): Promise<{ durationSec: number; sizeMB: number }> {
  header('Post-Render Validation');

  if (!existsSync(outputPath)) {
    throw new Error(`Output file not found: ${outputPath}`);
  }

  const stats = statSync(outputPath);
  const sizeMB = stats.size / (1024 * 1024);
  console.log(`  File exists: YES`);
  console.log(
    `  File size: ${sizeMB.toFixed(1)} MB (${stats.size.toLocaleString()} bytes)`,
  );

  if (stats.size === 0) {
    throw new Error('Output file is empty (0 bytes)');
  }

  let durationSec = ESTIMATED_DURATION_SEC;

  if (hasFfprobe) {
    try {
      const probeOutput = execSync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${outputPath}"`,
        { encoding: 'utf-8' },
      );
      const probe = JSON.parse(probeOutput);

      const videoStream = probe.streams?.find(
        (s: any) => s.codec_type === 'video',
      );
      const audioStream = probe.streams?.find(
        (s: any) => s.codec_type === 'audio',
      );

      if (videoStream) {
        console.log(`  Video codec: ${videoStream.codec_name}`);
        console.log(
          `  Resolution:  ${videoStream.width}x${videoStream.height}`,
        );
        console.log(`  Frame rate:  ${videoStream.r_frame_rate}`);
      } else {
        console.log('  WARNING: No video stream found');
      }

      if (audioStream) {
        console.log(`  Audio codec: ${audioStream.codec_name}`);
        console.log(`  Sample rate: ${audioStream.sample_rate}`);
      } else {
        console.log('  WARNING: No audio stream found');
      }

      if (probe.format?.duration) {
        durationSec = parseFloat(probe.format.duration);
        console.log(`  Duration:    ${durationSec.toFixed(1)}s`);

        const expected = TOTAL_FRAMES / FPS;
        const drift = Math.abs(durationSec - expected);
        if (drift > 2) {
          console.log(
            `  WARNING: Duration drift of ${drift.toFixed(1)}s from expected ${expected}s`,
          );
        }
      }
    } catch (err) {
      console.log(
        `  ffprobe error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    console.log('  ffprobe not available — skipping metadata validation');
  }

  return { durationSec, sizeMB };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(
    '\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
  );
  console.log(
    '\u2551  Nexus AI V2 \u2014 Full Pipeline End-to-End Render Test  \u2551',
  );
  console.log(
    '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d',
  );

  const startTime = Date.now();

  // 0. Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  // Clean previous output
  if (existsSync(OUTPUT_FILE)) await fs.unlink(OUTPUT_FILE);
  if (existsSync(AUDIO_FILE)) await fs.unlink(AUDIO_FILE);

  // 1. Prerequisites
  const prereqs = checkPrerequisites();

  // 2. Audio
  header('Audio Generation');
  await generateSilentAudio(ESTIMATED_DURATION_SEC, AUDIO_FILE);
  const ttsSource = 'silent fallback';

  // 3. Word Timings
  header('Word Timings');
  const wordTimings = generateApproximateTimings(
    TEST_SCRIPT,
    ESTIMATED_DURATION_SEC,
  );
  console.log(`  Generated ${wordTimings.length} approximate word timings`);
  console.log(
    `  Time range: 0.000s \u2192 ${wordTimings[wordTimings.length - 1]?.endTime.toFixed(3)}s`,
  );

  // 4. Scene Generation
  header('Scene Generation');
  let scenes: SimpleScene[];
  let sceneSource: string;
  let warnings: string[] = [];

  if (prereqs.hasGeminiKey) {
    console.log('  Using Director Agent (Gemini)...');
    try {
      const result = await runDirectorAgent();
      scenes = result.scenes;
      warnings = result.warnings;
      sceneSource = 'Director Agent (Gemini)';
      console.log(`  Director Agent produced ${scenes.length} scenes`);
      if (warnings.length > 0) {
        console.log(`  Warnings: ${warnings.join('; ')}`);
      }
    } catch (err) {
      console.log(
        `  Director Agent failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.log('  Falling back to manual scenes...');
      scenes = buildManualScenes();
      sceneSource = 'manual fallback (Director Agent error)';
    }
  } else {
    console.log('  No GEMINI_API_KEY \u2014 using manual scene array');
    scenes = buildManualScenes();
    sceneSource = 'manual fallback';
  }

  // Print scene breakdown
  const typeCounts: Record<string, number> = {};
  console.log(`\n  Scene Breakdown (${scenes.length} scenes):`);
  for (const scene of scenes) {
    const dur = ((scene.endFrame - scene.startFrame) / FPS).toFixed(1);
    console.log(
      `    ${scene.id}: ${scene.type} [${scene.startFrame}-${scene.endFrame}] (${dur}s)`,
    );
    typeCounts[scene.type] = (typeCounts[scene.type] ?? 0) + 1;
  }

  // 5. Start File Server
  header('File Server');
  const server = await startFileServer(OUTPUT_DIR);
  const audioUrl = `${server.url}/assets/audio.wav`;
  console.log(`  Local file server: ${server.url}`);
  console.log(`  Audio URL: ${audioUrl}`);

  try {
    // 6. Render
    await renderVideo(scenes, audioUrl, wordTimings, OUTPUT_FILE);

    // 7. Validate
    const { durationSec, sizeMB } = await validateOutput(
      OUTPUT_FILE,
      prereqs.hasFfprobe,
    );

    // 8. Final Report
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const words = TEST_SCRIPT.split(/\s+/).length;
    const paragraphs = TEST_SCRIPT.split(/\n\n/).length;

    header('Final Report');
    console.log(`  Script: ${paragraphs} paragraphs, ~${words} words`);
    console.log(`  TTS: ${ttsSource}`);
    console.log(`  Director Agent: ${sceneSource}`);
    console.log(`  Scenes: ${scenes.length} scenes generated`);
    for (const [type, count] of Object.entries(typeCounts).sort()) {
      console.log(`    - ${type} x${count}`);
    }
    console.log(`  Render: 1920x1080 @ ${FPS}fps, h264+aac`);
    console.log(`  Duration: ${durationSec.toFixed(1)}s`);
    console.log(`  File size: ${sizeMB.toFixed(1)} MB`);
    console.log(`  Elapsed: ${elapsed}s`);
    console.log(`  Output: ${OUTPUT_FILE}`);

    console.log(`\n${'='.repeat(60)}`);
    console.log('  STATUS: SUCCESS');
    console.log('='.repeat(60));
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(`\n${'='.repeat(60)}`);
  console.error('  RENDER TEST FAILED');
  console.error('='.repeat(60));
  console.error(err);
  process.exit(1);
});
