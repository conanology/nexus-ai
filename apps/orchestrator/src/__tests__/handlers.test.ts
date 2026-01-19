import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { handleHealthCheck } from '../handlers/health.js';
import { handleScheduledTrigger } from '../handlers/scheduled.js';
import { handleManualTrigger } from '../handlers/manual.js';

describe('Handlers', () => {
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

    it('should return 200 with pipeline ID when authorized', async () => {
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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          pipelineId: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });
  });

  describe('Manual Trigger Handler', () => {
    it('should accept valid date format', async () => {
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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: '2026-01-19',
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

      expect(res.status).toHaveBeenCalledWith(200);
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
  });
});
