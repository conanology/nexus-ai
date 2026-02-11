import express from 'express';
import { logger } from '@nexus-ai/core';
import { RenderService } from './render.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// Startup validation: check for GEMINI_API_KEY (required for V2 Director Agent)
const geminiKeyAvailable = !!process.env.GEMINI_API_KEY || !!process.env.NEXUS_GEMINI_API_KEY;
if (!geminiKeyAvailable) {
  logger.warn(
    'GEMINI_API_KEY not set — V2 Director Agent unavailable, falling back to legacy SceneMapper mode. ' +
    'Set GEMINI_API_KEY or NEXUS_GEMINI_API_KEY to enable V2 Director rendering.'
  );
}

const renderService = new RenderService();

// Job store for async renders
interface RenderJob {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: string;
  result?: {
    videoUrl: string;
    duration: number;
    fileSize: number;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobStore = new Map<string, RenderJob>();

// Cleanup old jobs (> 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobStore.entries()) {
    if (job.updatedAt.getTime() < oneHourAgo) {
      jobStore.delete(id);
      logger.info({ jobId: id }, 'Cleaned up old render job');
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Auth Middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.NEXUS_SECRET;
  const authHeader = req.headers['x-nexus-secret'];

  // If secret is configured, require it
  if (secret && authHeader !== secret) {
    logger.warn({ ip: req.ip }, 'Unauthorized request attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

const renderSchema = z.object({
  pipelineId: z.string(),
  timelineUrl: z.string(),
  audioUrl: z.string(),
  resolution: z.string().optional().default('1080p'),
});

// Synchronous render (legacy - may timeout for long renders)
app.post('/render', authMiddleware, async (req, res) => {
  try {
    const input = renderSchema.parse(req.body);

    logger.info({ input }, 'Received render request (sync)');

    const result = await renderService.renderVideo(input);

    res.status(200).json(result);
  } catch (error) {
    // Log error with full details (Error objects don't serialize well by default)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({
      errorMessage,
      errorStack,
      errorName: error instanceof Error ? error.name : 'Unknown',
    }, 'Render request failed');

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage
      });
    }
  }
});

// Async render - returns immediately with job ID
app.post('/render/async', authMiddleware, async (req, res) => {
  try {
    const input = renderSchema.parse(req.body);
    const jobId = randomUUID();

    const job: RenderJob = {
      id: jobId,
      pipelineId: input.pipelineId,
      status: 'pending',
      progress: 'Job queued',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jobStore.set(jobId, job);

    logger.info({ jobId, input }, 'Received async render request');

    // Start render in background (don't await)
    (async () => {
      try {
        job.status = 'running';
        job.progress = 'Starting render';
        job.updatedAt = new Date();

        const result = await renderService.renderVideo(input, (progress) => {
          job.progress = progress;
          job.updatedAt = new Date();
        });

        job.status = 'completed';
        job.result = result;
        job.progress = 'Render complete';
        job.updatedAt = new Date();

        logger.info({ jobId, result }, 'Async render completed');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        job.status = 'failed';
        job.error = errorMessage;
        job.progress = 'Render failed';
        job.updatedAt = new Date();

        logger.error({ jobId, errorMessage }, 'Async render failed');
      }
    })();

    // Return immediately with job ID
    res.status(202).json({
      jobId,
      status: 'pending',
      message: 'Render job started. Poll /render/status/:jobId for progress.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ errorMessage }, 'Failed to start async render');

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage
      });
    }
  }
});

// Get render job status
app.get('/render/status/:jobId', authMiddleware, (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response: any = {
    jobId: job.id,
    pipelineId: job.pipelineId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  if (job.status === 'completed' && job.result) {
    response.result = job.result;
  }

  if (job.status === 'failed' && job.error) {
    response.error = job.error;
  }

  return res.status(200).json(response);
});

const port = process.env.PORT || 8080;

// Export app and jobStore for testing
export { app, jobStore };

// Start server if main module or not test
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info({ port }, 'Render Service listening');
  });
}
