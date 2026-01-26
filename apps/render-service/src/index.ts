import express from 'express';
import { logger } from '@nexus-ai/core';
import { RenderService } from './render.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const renderService = new RenderService();

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

app.post('/render', authMiddleware, async (req, res) => {
  try {
    const input = renderSchema.parse(req.body);

    logger.info({ input }, 'Received render request');

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

const port = process.env.PORT || 8080;

// Export app for testing
export { app };

// Start server if main module or not test
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info({ port }, 'Render Service listening');
  });
}
