// NEXUS-AI Orchestrator Service
import express from 'express';
import { logger, NEXUS_VERSION } from '@nexus-ai/core';
import { handleHealthCheck } from './handlers/health.js';
import { handleScheduledTrigger } from './handlers/scheduled.js';
import { handleManualTrigger, handleResumeTrigger } from './handlers/manual.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

/**
 * Creates and configures the Express HTTP server
 */
export function createServer(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.info({
      method: req.method,
      path: req.path,
      ip: req.ip,
    }, 'Request received');
    next();
  });

  // Routes
  app.get('/health', handleHealthCheck);
  app.post('/trigger/scheduled', handleScheduledTrigger);
  app.post('/trigger/manual', handleManualTrigger);
  app.post('/trigger/resume', handleResumeTrigger);

  // Backwards-compatible route: /trigger -> /trigger/manual
  // This supports older CLI versions or direct API calls
  app.post('/trigger', (req, res) => {
    logger.info({
      deprecation: 'Using /trigger is deprecated, use /trigger/manual instead',
    }, 'Deprecated trigger endpoint used');
    handleManualTrigger(req, res);
  });

  return app;
}

/**
 * Starts the HTTP server
 * Only runs when this file is executed directly (not imported)
 */
async function startServer(): Promise<void> {
  const app = createServer();

  const server = app.listen(PORT, () => {
    logger.info({
      port: PORT,
      version: NEXUS_VERSION,
      stage: 'orchestrator',
    }, 'Orchestrator service started');
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info({
      stage: 'orchestrator',
    }, 'Shutting down orchestrator service');

    server.close(() => {
      logger.info({ stage: 'orchestrator' }, 'Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error({
        stage: 'orchestrator',
      }, 'Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start server when this is the main module
// In bundled production builds, always start; in dev, check module path
const isBundled = import.meta.url.includes('server.mjs');
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isBundled || isMainModule) {
  startServer().catch((error) => {
    logger.error({
      stage: 'orchestrator',
      error,
    }, 'Failed to start server');
    process.exit(1);
  });
}

