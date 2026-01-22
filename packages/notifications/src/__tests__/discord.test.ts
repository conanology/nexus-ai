/**
 * Discord webhook alert tests
 *
 * @module notifications/__tests__/discord
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscordAlertConfig, PipelineResultData, HealthCheckResultData } from '../types.js';
import { DISCORD_COLORS } from '../types.js';

// Use vi.hoisted to create mock functions that are available during vi.mock hoisting
const { mockGetSecret, mockFetch } = vi.hoisted(() => {
  return {
    mockGetSecret: vi.fn(),
    mockFetch: vi.fn(),
  };
});

// Stub fetch globally
vi.stubGlobal('fetch', mockFetch);

// Mock @nexus-ai/core with hoisted mock function
vi.mock('@nexus-ai/core', () => {
  return {
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    getSecret: mockGetSecret,
  };
});

// Import after mocks are set up
import {
  sendDiscordAlert,
  sendHealthCheckFailureAlert,
  sendDiscordSummary,
  formatCriticalAlert,
  formatWarningAlert,
  formatSuccessAlert,
  resetRateLimitState,
} from '../discord.js';

describe('Discord Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitState();
    mockFetch.mockReset();

    // Set up default mock responses
    mockGetSecret.mockResolvedValue('https://discord.com/api/webhooks/test/token');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Reset-After': '2',
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatCriticalAlert', () => {
    it('should create critical alert config with correct severity', () => {
      const alert = formatCriticalAlert('Test Title', 'Test Description');

      expect(alert.severity).toBe('CRITICAL');
      expect(alert.title).toBe('Test Title');
      expect(alert.description).toBe('Test Description');
      expect(alert.timestamp).toBeDefined();
    });

    it('should include optional fields', () => {
      const fields = [{ name: 'Field1', value: 'Value1' }];
      const alert = formatCriticalAlert('Title', 'Desc', fields);

      expect(alert.fields).toEqual(fields);
    });
  });

  describe('formatWarningAlert', () => {
    it('should create warning alert config with correct severity', () => {
      const alert = formatWarningAlert('Warning Title', 'Warning Description');

      expect(alert.severity).toBe('WARNING');
      expect(alert.title).toBe('Warning Title');
    });
  });

  describe('formatSuccessAlert', () => {
    it('should create success alert config with correct severity', () => {
      const alert = formatSuccessAlert('Success Title', 'Success Description');

      expect(alert.severity).toBe('SUCCESS');
      expect(alert.title).toBe('Success Title');
    });
  });

  describe('sendDiscordAlert', () => {
    it('should send alert successfully', async () => {
      const config: DiscordAlertConfig = {
        severity: 'CRITICAL',
        title: 'Test Alert',
        description: 'Test Description',
        timestamp: new Date().toISOString(),
      };

      const result = await sendDiscordAlert(config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should use correct color for severity level', async () => {
      const config: DiscordAlertConfig = {
        severity: 'CRITICAL',
        title: 'Critical Alert',
        timestamp: new Date().toISOString(),
      };

      await sendDiscordAlert(config);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.embeds[0].color).toBe(DISCORD_COLORS.CRITICAL);
    });

    it('should return error on fetch failure', async () => {
      // Use fake timers to speed up the retry delays
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new Error('Network error'));

      const config: DiscordAlertConfig = {
        severity: 'INFO',
        title: 'Test',
        timestamp: new Date().toISOString(),
      };

      // Start the operation
      const resultPromise = sendDiscordAlert(config);

      // Fast-forward through all the retry delays
      // Max 5 attempts: 2s + 4s + 8s + 16s delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(35000);
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');

      vi.useRealTimers();
    }, 10000);

    it('should handle rate limiting (429)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '0' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
        });

      const config: DiscordAlertConfig = {
        severity: 'INFO',
        title: 'Test',
        timestamp: new Date().toISOString(),
      };

      const result = await sendDiscordAlert(config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should handle client errors (4xx) without retry', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        text: () => Promise.resolve('Bad request'),
      });

      const config: DiscordAlertConfig = {
        severity: 'INFO',
        title: 'Test',
        timestamp: new Date().toISOString(),
      };

      const result = await sendDiscordAlert(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendHealthCheckFailureAlert', () => {
    it('should send health check failure alert with correct fields', async () => {
      const healthResult: HealthCheckResultData = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        criticalFailures: ['gemini', 'firestore'],
        warnings: [],
        totalDurationMs: 5000,
      };

      const result = await sendHealthCheckFailureAlert('2026-01-22', healthResult);

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.embeds[0].title).toBe('Health Check Failed - Pipeline Skipped');
      expect(body.embeds[0].color).toBe(DISCORD_COLORS.CRITICAL);
      expect(body.embeds[0].fields).toBeDefined();
    });
  });

  describe('sendDiscordSummary', () => {
    it('should send success summary with green color', async () => {
      const result: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 60000,
        totalCost: 0.50,
        stages: [],
      };

      await sendDiscordSummary('2026-01-22', result);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.embeds[0].color).toBe(DISCORD_COLORS.SUCCESS);
    });

    it('should send failure summary with red color', async () => {
      const result: PipelineResultData = {
        status: 'failed',
        durationMs: 30000,
        totalCost: 0.25,
        stages: [],
      };

      await sendDiscordSummary('2026-01-22', result);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.embeds[0].color).toBe(DISCORD_COLORS.CRITICAL);
      expect(body.embeds[0].title).toBe('Pipeline Failed');
    });

    it('should send degraded summary with yellow color', async () => {
      const result: PipelineResultData = {
        status: 'degraded',
        durationMs: 45000,
        totalCost: 0.40,
        stages: [],
        qualityContext: {
          degradedStages: ['tts'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: [],
        },
      };

      await sendDiscordSummary('2026-01-22', result);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.embeds[0].color).toBe(DISCORD_COLORS.WARNING);
    });

    it('should include quality context fields when present', async () => {
      const result: PipelineResultData = {
        status: 'degraded',
        durationMs: 45000,
        totalCost: 0.40,
        stages: [],
        qualityContext: {
          degradedStages: ['tts', 'thumbnail'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: ['word-count-low'],
        },
      };

      await sendDiscordSummary('2026-01-22', result);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const fields = body.embeds[0].fields;

      expect(fields.some((f: { name: string }) => f.name === 'Degraded Stages')).toBe(true);
      expect(fields.some((f: { name: string }) => f.name === 'Fallbacks Used')).toBe(true);
    });
  });
});
