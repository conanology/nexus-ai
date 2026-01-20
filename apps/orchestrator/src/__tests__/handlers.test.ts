import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleHealthCheck } from '../handlers/health.js';
import { handleScheduledTrigger } from '../handlers/scheduled.js';
import { handleManualTrigger, handleResumeTrigger } from '../handlers/manual.js';

// Mock the pipeline module
vi.mock('../pipeline.js', () => ({
  executePipeline: vi.fn().mockResolvedValue({
    success: true,
    pipelineId: '2026-01-19',
    status: 'completed',
    stageOutputs: {},
    completedStages: ['news-sourcing', 'research'],
    skippedStages: [],
    qualityContext: { degradedStages: [], fallbacksUsed: [], flags: [] },
    totalDurationMs: 1000,
    totalCost: 0.5,
  }),
  resumePipeline: vi.fn().mockResolvedValue({
    success: true,
    pipelineId: '2026-01-19',
    status: 'completed',
    stageOutputs: {},
    completedStages: ['script-gen', 'pronunciation'],
    skippedStages: [],
    qualityContext: { degradedStages: [], fallbacksUsed: [], flags: [] },
    totalDurationMs: 500,
    totalCost: 0.3,
  }),
}));

// Mock logger
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

describe('Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check Handler', () => {
    it('should return 200 with healthy status', async () => {
      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleHealthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
        })
      );
    });

    it('should include version in response', async () => {
      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleHealthCheck(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: expect.any(String),
        })
      );
    });
  });

  describe('Scheduled Trigger Handler', () => {
    it('should return 401 when no auth header', async () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleScheduledTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 401 when auth header format is invalid', async () => {
      const req = {
        headers: {
          authorization: 'Basic user:pass',
        },
        ip: '127.0.0.1',
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleScheduledTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 202 Accepted when authorized', async () => {
      const req = {
        headers: {
          authorization: 'Bearer fake-token',
        },
        ip: '127.0.0.1',
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleScheduledTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pipeline execution started',
          pipelineId: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          status: 'accepted',
        })
      );
    });
  });

  describe('Manual Trigger Handler', () => {
    it('should return 202 for async execution', async () => {
      const req = {
        body: {
          date: '2026-01-19',
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleManualTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: '2026-01-19',
          status: 'accepted',
        })
      );
    });

    it('should use current date when no date provided', async () => {
      const req = {
        body: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleManualTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });

    it('should reject invalid date format', async () => {
      const req = {
        body: {
          date: 'invalid-date',
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleManualTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid date format'),
        })
      );
    });

    it('should wait for completion when wait=true', async () => {
      const { executePipeline } = await import('../pipeline.js');

      const req = {
        body: {
          date: '2026-01-19',
          wait: true,
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleManualTrigger(req, res);

      // Should call executePipeline and wait for result
      expect(executePipeline).toHaveBeenCalledWith('2026-01-19');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pipeline completed',
          status: 'completed',
        })
      );
    });
  });

  describe('Resume Trigger Handler', () => {
    it('should return 400 when no pipeline ID provided', async () => {
      const req = {
        body: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleResumeTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('pipelineId required'),
        })
      );
    });

    it('should return 400 for invalid pipeline ID format', async () => {
      const req = {
        body: {
          pipelineId: 'invalid',
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleResumeTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 202 for async resume', async () => {
      const req = {
        body: {
          pipelineId: '2026-01-19',
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleResumeTrigger(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pipeline resume started',
          pipelineId: '2026-01-19',
          status: 'accepted',
        })
      );
    });

    it('should accept optional fromStage parameter', async () => {
      const { resumePipeline } = await import('../pipeline.js');

      const req = {
        body: {
          pipelineId: '2026-01-19',
          fromStage: 'script-gen',
          wait: true,
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await handleResumeTrigger(req, res);

      expect(resumePipeline).toHaveBeenCalledWith('2026-01-19', 'script-gen');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
