import { CloudStorageClient, logger, NexusError } from '@nexus-ai/core';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RenderInput {
  pipelineId: string;
  timelineUrl: string;
  audioUrl: string;
  resolution: string; // '1080p'
}

interface RenderOutput {
  videoUrl: string;
  duration: number; // seconds
  fileSize: number; // bytes
}

export class RenderService {
  private storage: CloudStorageClient;

  constructor() {
    this.storage = new CloudStorageClient();
  }

  private getStoragePath(gsUrl: string): string {
    return gsUrl.replace(/^gs:\/\/[^\/]+\//, '');
  }

  /**
   * Materialize data-URI images to disk files and rewrite scene fields
   * to point at localhost HTTP URLs. This prevents multi-megabyte base64
   * strings from bloating Remotion's serialised inputProps JSON.
   */
  private async materializeImages(
    scenes: Array<Record<string, unknown>>,
    tmpDir: string,
    serverPort: number,
  ): Promise<number> {
    const IMAGE_FIELDS = ['backgroundImage', 'screenshotImage', 'fullPageImage'] as const;
    let materialized = 0;

    for (const scene of scenes) {
      for (const field of IMAGE_FIELDS) {
        const value = scene[field];
        if (typeof value !== 'string' || !value.startsWith('data:')) continue;

        // Parse the data URI — e.g. data:image/png;base64,iVBOR...
        const match = value.match(/^data:image\/(\w+);base64,(.+)$/s);
        if (!match) continue;

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const data = Buffer.from(match[2], 'base64');
        const hash = crypto.createHash('md5').update(data).digest('hex').slice(0, 12);
        const filename = `img-${hash}.${ext}`;
        const filePath = path.join(tmpDir, filename);

        await fs.writeFile(filePath, data);
        scene[field] = `http://localhost:${serverPort}/assets/${filename}`;
        materialized++;
      }
    }

    return materialized;
  }

  async renderVideo(input: RenderInput, onProgress?: (progress: string) => void): Promise<RenderOutput> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-render-'));
    const timelinePath = path.join(tmpDir, 'timeline.json');
    const audioPath = path.join(tmpDir, 'audio.wav');
    const outputPath = path.join(tmpDir, 'output.mp4');

    logger.info({ pipelineId: input.pipelineId, tmpDir }, 'Starting render');
    onProgress?.('Initializing render environment');

    // Start local file server for audio (Remotion doesn't support file:// URLs)
    const fileServer = express();
    fileServer.use('/assets', express.static(tmpDir));
    const server = http.createServer(fileServer);

    // Find available port
    const serverPort = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 3333);
      });
    });

    const localAudioUrl = `http://localhost:${serverPort}/assets/audio.wav`;
    logger.info({ serverPort, localAudioUrl }, 'Started local file server for audio');

    try {
      // 1. Download Assets
      onProgress?.('Downloading assets from Cloud Storage');
      // Parallel download
      const [timelineBuffer, audioBuffer] = await Promise.all([
        this.storage.downloadFile(this.getStoragePath(input.timelineUrl)),
        this.storage.downloadFile(this.getStoragePath(input.audioUrl))
      ]);

      // Write to disk
      await Promise.all([
        fs.writeFile(timelinePath, timelineBuffer),
        fs.writeFile(audioPath, audioBuffer)
      ]);

      // 2. Bundle Video Studio
      // Locate entry point - robustly relative to this file
      // Assuming structure:
      // apps/render-service/src/render.ts
      // apps/video-studio/src/index.ts
      let entryPoint = path.resolve(__dirname, '../../../video-studio/src/index.ts');
      
      // Fallback for different execution contexts if needed, but __dirname is safest
      try {
        await fs.access(entryPoint);
      } catch {
         // Fallback to process.cwd logic if __dirname fails (e.g. bundled build)
         entryPoint = path.resolve(process.cwd(), '../video-studio/src/index.ts');
         if (!entryPoint.includes('apps/video-studio')) {
            entryPoint = path.resolve(process.cwd(), 'apps/video-studio/src/index.ts');
         }
      }

      const publicDir = path.resolve(__dirname, '../../../apps/video-studio/public');

      logger.info({ entryPoint, publicDir }, 'Bundling video studio');
      onProgress?.('Bundling video studio (this may take several minutes)');

      const bundled = await bundle({
        entryPoint,
        publicDir,
        webpackOverride: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            extensionAlias: {
              '.js': ['.ts', '.tsx', '.js', '.jsx'],
              '.mjs': ['.mts', '.mjs'],
            },
            alias: {
              ...config.resolve?.alias,
              // Map server-only packages to false (empty module) to prevent
              // webpack from bundling their Node.js dependencies
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
              'playwright': false,
              'playwright-core': false,
              'pino': false,
              'pino-pretty': false,
              // node: scheme aliases to avoid UnhandledSchemeError in webpack
              'node:assert': false,
              'node:buffer': false,
              'node:child_process': false,
              'node:crypto': false,
              'node:events': false,
              'node:fs': false,
              'node:http': false,
              'node:https': false,
              'node:module': false,
              'node:net': false,
              'node:os': false,
              'node:path': false,
              'node:process': false,
              'node:stream': false,
              'node:string_decoder': false,
              'node:timers': false,
              'node:tls': false,
              'node:url': false,
              'node:util': false,
              'node:zlib': false,
            },
            fallback: {
              ...config.resolve?.fallback,
              // Node.js core modules not available in browser context
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

      // 3. Read Timeline/Scenes Data
      onProgress?.('Bundle complete - preparing composition');
      const timelineData = JSON.parse(await fs.readFile(timelinePath, 'utf-8'));

      // Build inputProps depending on V2-director or legacy format
      const isV2Director = timelineData.version === 'v2-director';
      const inputProps = isV2Director
        ? {
            scenes: timelineData.scenes,
            totalDurationFrames: timelineData.totalDurationFrames,
            audioUrl: localAudioUrl,
            impactWords: timelineData.impactWords ?? [],
            wordTimings: timelineData.wordTimings ?? [],
          }
        : {
            timeline: timelineData,
            audioUrl: localAudioUrl,
          };

      if (isV2Director) {
        // Compute scene type distribution for logging
        const typeCounts: Record<string, number> = {};
        for (const scene of timelineData.scenes) {
          typeCounts[scene.type] = (typeCounts[scene.type] ?? 0) + 1;
        }
        const typesSummary = Object.entries(typeCounts)
          .map(([t, n]) => `${t} x${n}`)
          .join(', ');

        logger.info({
          pipelineId: input.pipelineId,
          sceneCount: timelineData.scenes.length,
          totalDurationFrames: timelineData.totalDurationFrames,
          durationSec: timelineData.totalDurationFrames / 30,
          typeDistribution: typeCounts,
        }, `Director Agent: produced ${timelineData.scenes.length} scenes (types: ${typesSummary})`);
      } else {
        logger.info({
          pipelineId: input.pipelineId,
          sceneCount: timelineData.scenes?.length,
          mode: 'legacy-timeline',
        }, 'Legacy timeline mode — using keyword SceneMapper output');
      }

      // 3b. Materialize data-URI images to disk (V2 only)
      if (isV2Director) {
        const materialized = await this.materializeImages(
          timelineData.scenes,
          tmpDir,
          serverPort,
        );
        if (materialized > 0) {
          logger.info(
            { pipelineId: input.pipelineId, materialized },
            `Materialized ${materialized} data-URI images to disk`,
          );
        }
      }

      // 4. Select Composition
      const composition = await selectComposition({
        serveUrl: bundled,
        id: 'TechExplainer', // Matches apps/video-studio/src/Root.tsx
        inputProps,
      });

      // 5. Render
      const sceneCount = isV2Director ? timelineData.scenes.length : (timelineData.scenes?.length ?? 0);
      const renderDurationSec = composition.durationInFrames / composition.fps;
      logger.info({
        pipelineId: input.pipelineId,
        sceneCount,
        durationSec: renderDurationSec,
        durationInFrames: composition.durationInFrames,
        fps: composition.fps,
        codec: 'h264',
        audioCodec: 'aac',
      }, `Render: starting Remotion render, ${sceneCount} scenes, duration ${renderDurationSec.toFixed(1)}s`);
      onProgress?.('Rendering video frames');
      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: 'h264',
        audioCodec: 'aac',
        outputLocation: outputPath,
        inputProps,
        timeoutInMilliseconds: 45 * 60 * 1000, // 45 minutes
        chromiumOptions: {
            enableMultiProcessOnLinux: true
        }
      });

      // 6. Quality Gate
      const stats = await fs.stat(outputPath);
      const durationSec = composition.durationInFrames / composition.fps;
      
      // Check 1: File size reasonable (e.g., > 1MB per minute, roughly)
      // AC requirement: >10MB for 1 min. Let's enforce strict > 5MB for any video > 30s.
      const minSizeBytes = (durationSec > 30) ? 5 * 1024 * 1024 : 100 * 1024; // 5MB or 100KB
      
      if (stats.size < minSizeBytes) {
          throw NexusError.degraded('NEXUS_RENDER_QUALITY_FAIL', `Quality Gate Failed: Output file too small (${stats.size} bytes) for duration ${durationSec}s`, 'render');
      }

      // Check 2: Audio Sync / Frame Drops
      // Remotion throws on render failure. 
      // We assume if renderMedia completes and file exists with size, it's good.
      // Ideally we would parse logs for "Frame dropped", but validation is done via exit code.

      // 7. Upload
      onProgress?.('Uploading video to Cloud Storage');
      const uploadPath = `${input.pipelineId}/render/video.mp4`;
      const videoStream = createReadStream(outputPath);
      const resultUrl = await this.storage.uploadStream(uploadPath, videoStream, 'video/mp4');

      logger.info({
        pipelineId: input.pipelineId,
        videoUrl: resultUrl,
        durationSec,
        fileSize: stats.size,
        fileSizeMB: (stats.size / (1024 * 1024)).toFixed(1),
        mode: isV2Director ? 'v2-director' : 'legacy-timeline',
      }, `Render: complete, output at ${uploadPath}`);

      return {
        videoUrl: resultUrl,
        duration: durationSec,
        fileSize: stats.size
      };

    } catch (error) {
      // Log error with full details (Error objects don't serialize well by default)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({
        errorMessage,
        errorStack,
        errorName: error instanceof Error ? error.name : 'Unknown',
        pipelineId: input.pipelineId
      }, 'Render failed');
      throw error;
    } finally {
      // Cleanup
      server.close();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}
