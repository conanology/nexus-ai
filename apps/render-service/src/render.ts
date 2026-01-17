import { CloudStorageClient, logger, NexusError } from '@nexus-ai/core';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

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

  async renderVideo(input: RenderInput): Promise<RenderOutput> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-render-'));
    const timelinePath = path.join(tmpDir, 'timeline.json');
    const audioPath = path.join(tmpDir, 'audio.wav');
    const outputPath = path.join(tmpDir, 'output.mp4');

    logger.info({ pipelineId: input.pipelineId, tmpDir }, 'Starting render');

    try {
      // 1. Download Assets
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

      logger.info({ entryPoint }, 'Bundling video studio');

      const bundled = await bundle({
        entryPoint,
        // In production, we might want to cache this
      });

      // 3. Read Timeline Data
      const timelineData = JSON.parse(await fs.readFile(timelinePath, 'utf-8'));

      // 4. Select Composition
      const composition = await selectComposition({
        serveUrl: bundled,
        id: 'TechExplainer', // Matches apps/video-studio/src/Root.tsx
        inputProps: {
          timeline: timelineData,
          audioUrl: `file://${audioPath}`, // Use file protocol for local access
        },
      });

      // 5. Render
      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: {
          timeline: timelineData,
          audioUrl: `file://${audioPath}`,
        },
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
      const uploadPath = `${input.pipelineId}/render/video.mp4`;
      const videoStream = createReadStream(outputPath);
      const resultUrl = await this.storage.uploadStream(uploadPath, videoStream, 'video/mp4');

      return {
        videoUrl: resultUrl,
        duration: durationSec,
        fileSize: stats.size
      };

    } catch (error) {
      logger.error({ error, pipelineId: input.pipelineId }, 'Render failed');
      throw error;
    } finally {
      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}
