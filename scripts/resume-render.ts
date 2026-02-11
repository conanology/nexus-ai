#!/usr/bin/env tsx
/**
 * Resume render from existing pipeline artifacts.
 * Loads scenes-enriched.json, starts file server, materializes images,
 * and runs the Remotion render step only.
 */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const _require = createRequire(
  path.join(PROJECT_ROOT, 'apps', 'render-service', 'package.json'),
);
const { bundle } = _require('@remotion/bundler') as typeof import('@remotion/bundler');
const { renderMedia, selectComposition } = _require(
  '@remotion/renderer',
) as typeof import('@remotion/renderer');

const VIDEO_STUDIO_ENTRY = path.resolve(
  PROJECT_ROOT, 'apps', 'video-studio', 'src', 'index.ts',
);
const FPS = 30;

const TOPIC_SLUG = process.argv[2] || 'claude-s-c-compiler-vs-gcc';
const LOCAL_STORAGE_DIR = path.resolve(PROJECT_ROOT, 'local-storage', TOPIC_SLUG);
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'output', TOPIC_SLUG);

function header(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// File server
async function startFileServer(dir: string): Promise<{ url: string; port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '').replace(/^\/assets\//, ''));
      const filePath = path.join(dir, urlPath);

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const stat = statSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.wav': 'audio/wav', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

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

// Materialize data-URI images to disk
async function materializeImages(
  scenes: any[],
  localStorageDir: string,
  serverUrl: string,
): Promise<number> {
  const imagesDir = path.join(localStorageDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  let count = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.backgroundImage && scene.backgroundImage.startsWith('data:')) {
      const match = scene.backgroundImage.match(
        /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/,
      );
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `bg-${i}.${ext}`;
        const filePath = path.join(imagesDir, filename);
        if (!existsSync(filePath)) {
          await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
        }
        scene.backgroundImage = `${serverUrl}/assets/images/${filename}`;
        count++;
      }
    }
    if (scene.screenshotImage && scene.screenshotImage.startsWith('data:')) {
      const match = scene.screenshotImage.match(
        /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/,
      );
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `ss-${i}.${ext}`;
        const filePath = path.join(imagesDir, filename);
        if (!existsSync(filePath)) {
          await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
        }
        scene.screenshotImage = `${serverUrl}/assets/images/${filename}`;
        count++;
      }
    }
  }
  return count;
}

async function main() {
  header('Resume Render');
  console.log(`  Topic slug: ${TOPIC_SLUG}`);
  console.log(`  Local storage: ${LOCAL_STORAGE_DIR}`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);

  // Load enriched scenes
  const enrichedPath = path.join(LOCAL_STORAGE_DIR, 'scenes-enriched.json');
  if (!existsSync(enrichedPath)) {
    throw new Error(`No enriched scenes found at ${enrichedPath}`);
  }
  const enrichedPayload = JSON.parse(await fs.readFile(enrichedPath, 'utf8'));
  const scenes = enrichedPayload.scenes;
  const totalFrames = enrichedPayload.totalDurationFrames;

  console.log(`  Scenes: ${scenes.length}`);
  console.log(`  Total frames: ${totalFrames} (${(totalFrames / FPS).toFixed(1)}s)`);

  // Scene type distribution
  const types: Record<string, number> = {};
  for (const s of scenes) types[s.type] = (types[s.type] ?? 0) + 1;
  for (const [t, c] of Object.entries(types).sort()) console.log(`    ${t} x${c}`);

  // Start file server
  const server = await startFileServer(LOCAL_STORAGE_DIR);
  const audioUrl = `${server.url}/assets/audio.wav`;
  console.log(`\n  File server: ${server.url}`);
  console.log(`  Audio URL: ${audioUrl}`);

  // Verify audio
  try {
    const testRes = await fetch(audioUrl);
    if (!testRes.ok) {
      console.error(`  WARNING: Audio not accessible: HTTP ${testRes.status}`);
    } else {
      console.log(`  Audio verified: ${testRes.headers.get('content-length')} bytes`);
    }
  } catch (err: any) {
    console.error(`  WARNING: Audio unreachable: ${err.message}`);
  }

  // Materialize images
  const imageCount = await materializeImages(scenes, LOCAL_STORAGE_DIR, server.url);
  console.log(`  Materialized ${imageCount} images`);

  // Check a sample image URL
  if (scenes[0]?.backgroundImage) {
    console.log(`  Sample image URL: ${scenes[0].backgroundImage}`);
    try {
      const imgRes = await fetch(scenes[0].backgroundImage);
      console.log(`  Sample image fetch: ${imgRes.status} (${imgRes.headers.get('content-length')} bytes)`);
    } catch (err: any) {
      console.error(`  Sample image fetch FAILED: ${err.message}`);
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const videoPath = path.join(OUTPUT_DIR, 'video.mp4');

  try {
    header('Bundling');
    console.log(`  Entry: ${VIDEO_STUDIO_ENTRY}`);
    const bundled = await bundle({
      entryPoint: VIDEO_STUDIO_ENTRY,
      publicDir: path.resolve(PROJECT_ROOT, 'apps', 'video-studio', 'public'),
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
    console.log(`  Bundle: ${bundled}`);

    header('Select Composition');
    const inputProps = {
      scenes,
      totalDurationFrames: totalFrames,
      audioUrl,
    };
    console.log(`  inputProps JSON size: ${formatBytes(JSON.stringify(inputProps).length)}`);

    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'TechExplainer',
      inputProps,
    });
    console.log(`  Composition: ${composition.durationInFrames} frames, ${composition.fps}fps, ${composition.width}x${composition.height}`);

    header('Render');
    console.log(`  Output: ${videoPath}`);
    const renderStart = Date.now();
    let lastLoggedPct = 0;

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      audioCodec: 'aac',
      outputLocation: videoPath,
      inputProps,
      timeoutInMilliseconds: 30 * 60 * 1000,
      onProgress: ({ progress }: { progress: number }) => {
        const pct = Math.round(progress * 100);
        if (pct >= lastLoggedPct + 5) {
          const elapsed = ((Date.now() - renderStart) / 1000).toFixed(0);
          console.log(`  Render: ${pct}% (${elapsed}s elapsed)`);
          lastLoggedPct = pct;
        }
      },
    });

    const totalElapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
    const stats = statSync(videoPath);
    console.log(`\n  Render complete in ${totalElapsed}s`);
    console.log(`  File size: ${formatBytes(stats.size)}`);
    console.log(`  Duration: ${(totalFrames / FPS).toFixed(1)}s`);
    console.log(`  Video ready: ${videoPath}`);

  } catch (err) {
    console.error('\n  RENDER FAILED:');
    console.error(err);
    throw err;
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
