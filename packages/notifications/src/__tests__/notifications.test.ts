/**
 * Notifications stage function tests
 *
 * @module notifications/__tests__/notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeNotifications } from '../notifications.js';
import type { StageInput, NotificationsInput } from '../types.js';

// Mock dependencies
vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  CostTracker: vi.fn().mockImplementation(() => ({
    getSummary: () => ({
      stage: 'notifications',
      totalCost: 0,
      breakdown: [],
      timestamp: new Date().toISOString(),
    }),
  })),
}));

vi.mock('../discord.js', () => ({
  sendDiscordSummary: vi.fn().mockResolvedValue('discord-msg-id'),
}));

vi.mock('../email.js', () => ({
  sendDigestEmail: vi.fn().mockResolvedValue('email-msg-id'),
}));

vi.mock('../digest.js', () => ({
  collectDigestData: vi.fn().mockResolvedValue({
    video: null,
    pipeline: { pipelineId: 'test', status: 'success', duration: '1h', cost: '$0.50', stages: [] },
    health: { buffersRemaining: 3, budgetRemaining: '$250.00', daysOfRunway: 30 },
    alerts: [],
  }),
}));

vi.mock('../metrics.js', () => ({
  trackNotificationMetrics: vi.fn(),
  logNotificationResults: vi.fn().mockResolvedValue(undefined),
}));

import { sendDiscordSummary } from '../discord.js';
import { sendDigestEmail } from '../email.js';
import { trackNotificationMetrics, logNotificationResults } from '../metrics.js';

describe('executeNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createInput = (overrides = {}): StageInput<NotificationsInput> => ({
    pipelineId: '2026-01-22',
    previousStage: 'youtube',
    data: {
      pipelineId: '2026-01-22',
      pipelineResult: {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.50,
        stages: [],
      },
      ...overrides,
    },
    config: {
      timeout: 60000,
      retries: 3,
    },
  });

  it('should execute notifications stage successfully', async () => {
    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(output.data.discord.sent).toBe(true);
    expect(output.data.email.sent).toBe(true);
    expect(output.data.digest).toBeDefined();
    expect(output.provider.name).toBe('notifications');
    expect(output.provider.tier).toBe('primary');
  });

  it('should call Discord and email in parallel', async () => {
    const input = createInput();
    await executeNotifications(input);

    expect(sendDiscordSummary).toHaveBeenCalledWith(
      '2026-01-22',
      expect.objectContaining({ status: 'success' })
    );
    expect(sendDigestEmail).toHaveBeenCalledWith(
      '2026-01-22',
      expect.anything()
    );
  });

  it('should track notification metrics', async () => {
    const input = createInput();
    await executeNotifications(input);

    expect(trackNotificationMetrics).toHaveBeenCalledWith(
      '2026-01-22',
      expect.arrayContaining([
        expect.objectContaining({ channel: 'discord', sent: true }),
        expect.objectContaining({ channel: 'email', sent: true }),
      ])
    );
  });

  it('should log notification results to Firestore', async () => {
    const input = createInput();
    await executeNotifications(input);

    expect(logNotificationResults).toHaveBeenCalledWith(
      '2026-01-22',
      expect.objectContaining({ sent: true }),
      expect.objectContaining({ sent: true })
    );
  });

  it('should succeed even when Discord fails', async () => {
    vi.mocked(sendDiscordSummary).mockRejectedValueOnce(new Error('Discord error'));

    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(output.data.discord.sent).toBe(false);
    expect(output.data.discord.error).toContain('Discord error');
    expect(output.data.email.sent).toBe(true);
    expect(output.warnings).toContain('Discord notification failed: Discord error');
  });

  it('should succeed even when email fails', async () => {
    vi.mocked(sendDigestEmail).mockRejectedValueOnce(new Error('Email error'));

    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(output.data.discord.sent).toBe(true);
    expect(output.data.email.sent).toBe(false);
    expect(output.data.email.error).toContain('Email error');
    expect(output.warnings).toContain('Email notification failed: Email error');
  });

  it('should succeed even when both channels fail', async () => {
    vi.mocked(sendDiscordSummary).mockRejectedValueOnce(new Error('Discord error'));
    vi.mocked(sendDigestEmail).mockRejectedValueOnce(new Error('Email error'));

    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(output.data.discord.sent).toBe(false);
    expect(output.data.email.sent).toBe(false);
    expect(output.warnings).toHaveLength(2);
  });

  it('should track quality metrics correctly', async () => {
    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.quality.measurements.notificationsSent).toBe(2);
    expect(output.quality.measurements.notificationsFailed).toBe(0);
  });

  it('should track quality metrics when one channel fails', async () => {
    vi.mocked(sendDiscordSummary).mockRejectedValueOnce(new Error('Discord error'));

    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.quality.measurements.notificationsSent).toBe(1);
    expect(output.quality.measurements.notificationsFailed).toBe(1);
  });

  it('should include duration in output', async () => {
    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should not fail on logNotificationResults error', async () => {
    vi.mocked(logNotificationResults).mockRejectedValueOnce(new Error('Firestore error'));

    const input = createInput();
    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
  });

  it('should handle failed pipeline result', async () => {
    const input = createInput({
      pipelineResult: {
        status: 'failed',
        durationMs: 1800000,
        totalCost: 0.25,
        stages: [],
      },
    });

    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(sendDiscordSummary).toHaveBeenCalledWith(
      '2026-01-22',
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('should handle degraded pipeline result', async () => {
    const input = createInput({
      pipelineResult: {
        status: 'degraded',
        videoTitle: 'Degraded Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3000000,
        totalCost: 0.55,
        stages: [],
        qualityContext: {
          degradedStages: ['tts'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: [],
        },
      },
    });

    const output = await executeNotifications(input);

    expect(output.success).toBe(true);
    expect(sendDiscordSummary).toHaveBeenCalledWith(
      '2026-01-22',
      expect.objectContaining({ status: 'degraded' })
    );
  });
});
