/**
 * Tests for structured logger implementation.
 *
 * Tests cover:
 * - Base logger configuration
 * - Child logger creation and naming
 * - Pipeline logger creation
 * - Log level configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('observability/logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to get fresh logger instances
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('logger', () => {
    it('should export a base logger instance', async () => {
      const { logger } = await import('../logger.js');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should have empty base bindings (name set via createLogger)', async () => {
      const { logger } = await import('../logger.js');
      // Base logger has no name binding to avoid duplicates with child loggers
      const bindings = logger.bindings();
      expect(bindings.name).toBeUndefined();
    });

    it('should default to silent in test mode when NEXUS_LOG_LEVEL not set', async () => {
      delete process.env.NEXUS_LOG_LEVEL;
      // VITEST env var is set by vitest, so we're in test mode
      const { logger } = await import('../logger.js');
      expect(logger.level).toBe('silent');
    });

    it('should respect NEXUS_LOG_LEVEL environment variable (overrides test mode)', async () => {
      process.env.NEXUS_LOG_LEVEL = 'debug';
      const { logger } = await import('../logger.js');
      expect(logger.level).toBe('debug');
    });

    it('should use info level when NEXUS_LOG_LEVEL not set and not in test mode', async () => {
      delete process.env.NEXUS_LOG_LEVEL;
      delete process.env.VITEST;
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../logger.js');
      expect(logger.level).toBe('info');
    });
  });

  describe('createLogger', () => {
    it('should create a child logger with nexus.{name} format', async () => {
      const { createLogger } = await import('../logger.js');
      const logger = createLogger('tts.gemini');
      const bindings = logger.bindings();
      expect(bindings.name).toBe('nexus.tts.gemini');
    });

    it('should create a logger that inherits parent level', async () => {
      process.env.NEXUS_LOG_LEVEL = 'warn';
      const { createLogger } = await import('../logger.js');
      const logger = createLogger('storage.firestore');
      expect(logger.level).toBe('warn');
    });

    it('should create a logger that can log messages', async () => {
      const { createLogger } = await import('../logger.js');
      const logger = createLogger('test.module');

      // Verify logger is functional (doesn't throw)
      expect(() => logger.info('test message')).not.toThrow();
      expect(() => logger.debug({ key: 'value' }, 'debug message')).not.toThrow();
      expect(() => logger.warn('warning')).not.toThrow();
      expect(() => logger.error('error')).not.toThrow();
    });
  });

  describe('createPipelineLogger', () => {
    it('should create a logger with pipelineId binding', async () => {
      const { createPipelineLogger } = await import('../logger.js');
      const logger = createPipelineLogger('2026-01-08');
      const bindings = logger.bindings();
      expect(bindings.pipelineId).toBe('2026-01-08');
    });

    it('should include stage binding when provided', async () => {
      const { createPipelineLogger } = await import('../logger.js');
      const logger = createPipelineLogger('2026-01-08', 'tts');
      const bindings = logger.bindings();
      expect(bindings.pipelineId).toBe('2026-01-08');
      expect(bindings.stage).toBe('tts');
    });

    it('should not include stage binding when not provided', async () => {
      const { createPipelineLogger } = await import('../logger.js');
      const logger = createPipelineLogger('2026-01-08');
      const bindings = logger.bindings();
      expect(bindings.pipelineId).toBe('2026-01-08');
      expect(bindings.stage).toBeUndefined();
    });

    it('should allow chaining child loggers', async () => {
      const { createPipelineLogger } = await import('../logger.js');
      const pipelineLogger = createPipelineLogger('2026-01-08');
      const stageLogger = pipelineLogger.child({ stage: 'script-gen' });

      const bindings = stageLogger.bindings();
      expect(bindings.pipelineId).toBe('2026-01-08');
      expect(bindings.stage).toBe('script-gen');
    });
  });

  describe('withContext', () => {
    it('should create a child logger with additional context', async () => {
      const { logger, withContext } = await import('../logger.js');
      const contextLogger = withContext(logger, {
        requestId: 'abc123',
        userId: 'user456',
      });

      const bindings = contextLogger.bindings();
      expect(bindings.requestId).toBe('abc123');
      expect(bindings.userId).toBe('user456');
    });

    it('should preserve parent bindings', async () => {
      const { createPipelineLogger, withContext } = await import('../logger.js');
      const pipelineLogger = createPipelineLogger('2026-01-08', 'tts');
      const contextLogger = withContext(pipelineLogger, { provider: 'gemini' });

      const bindings = contextLogger.bindings();
      expect(bindings.pipelineId).toBe('2026-01-08');
      expect(bindings.stage).toBe('tts');
      expect(bindings.provider).toBe('gemini');
    });
  });

  describe('log level values', () => {
    it('should export LOG_LEVEL_VALUES constant', async () => {
      const { LOG_LEVEL_VALUES } = await import('../types.js');
      expect(LOG_LEVEL_VALUES).toBeDefined();
      expect(LOG_LEVEL_VALUES.trace).toBe(10);
      expect(LOG_LEVEL_VALUES.debug).toBe(20);
      expect(LOG_LEVEL_VALUES.info).toBe(30);
      expect(LOG_LEVEL_VALUES.warn).toBe(40);
      expect(LOG_LEVEL_VALUES.error).toBe(50);
      expect(LOG_LEVEL_VALUES.fatal).toBe(60);
    });
  });

  describe('Logger type export', () => {
    it('should export Logger type from pino', async () => {
      // Type exports are verified at compile time
      // At runtime, we can only verify the module exports exist
      const module = await import('../logger.js');
      expect(module).toBeDefined();
      expect(module.logger).toBeDefined();
    });
  });
});
