/**
 * SendGrid email service tests
 *
 * @module notifications/__tests__/email
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DigestData, EmailMessage, AlertEmailConfig } from '../types.js';

// Use vi.hoisted to create mock functions that are available during vi.mock hoisting
const { mockGetSecret, mockSend, mockSetApiKey } = vi.hoisted(() => {
  return {
    mockGetSecret: vi.fn(),
    mockSend: vi.fn(),
    mockSetApiKey: vi.fn(),
  };
});

// Mock SendGrid with hoisted mock functions
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: mockSetApiKey,
    send: mockSend,
  },
}));

// Mock @nexus-ai/core with hoisted mock functions
vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getSecret: mockGetSecret,
}));

// Import after mocks are set up
import { sendEmail, sendDigestEmail, sendAlertEmail, resetSendGridState } from '../email.js';
import sgMail from '@sendgrid/mail';

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSendGridState();

    // Set up default mock responses
    mockGetSecret.mockImplementation((name: string) => {
      const secrets: Record<string, string> = {
        'nexus-sendgrid-api-key': 'SG.test-api-key',
        'nexus-operator-email': 'operator@example.com',
      };
      return Promise.resolve(secrets[name]);
    });

    // Default SendGrid response
    mockSend.mockResolvedValue([
      { statusCode: 202, headers: { 'x-message-id': 'test-msg-id' } },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const msg: EmailMessage = {
        to: 'test@example.com',
        from: 'noreply@nexus-ai.app',
        subject: 'Test Subject',
        text: 'Test plain text',
        html: '<p>Test HTML</p>',
      };

      const result = await sendEmail(msg);

      expect(result.success).toBe(true);
      expect(mockSetApiKey).toHaveBeenCalledWith('SG.test-api-key');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should return error on SendGrid failure', async () => {
      mockSend.mockRejectedValue(new Error('SendGrid error'));

      const msg: EmailMessage = {
        to: 'test@example.com',
        from: 'noreply@nexus-ai.app',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      };

      const result = await sendEmail(msg);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid error');
    });

    it('should retry on transient failures', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([{ statusCode: 202, headers: {} }]);

      const msg: EmailMessage = {
        to: 'test@example.com',
        from: 'noreply@nexus-ai.app',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      };

      const result = await sendEmail(msg);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendDigestEmail', () => {
    it('should send digest email with all sections', async () => {
      const digest: DigestData = {
        video: {
          title: 'Test Video',
          url: 'https://youtube.com/test',
          topic: 'AI Technology',
          source: 'Hacker News',
          thumbnailVariant: 1,
        },
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'success',
          duration: '3h 42m',
          cost: '$0.47',
          stages: [
            { name: 'script-gen', status: 'completed', provider: 'gemini-3-pro', tier: 'primary' },
          ],
        },
        health: {
          buffersRemaining: 3,
          budgetRemaining: '$245.32',
          daysOfRunway: 30,
        },
        alerts: [],
      };

      await sendDigestEmail('2026-01-22', digest);

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.to).toBe('operator@example.com');
      expect(callArgs.subject).toContain('Daily Digest');
      expect(callArgs.html).toContain('Test Video');
      expect(callArgs.html).toContain('success');
    });

    it('should handle digest with no video', async () => {
      const digest: DigestData = {
        video: null,
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'failed',
          duration: '1h 23m',
          cost: '$0.25',
          stages: [],
        },
        health: {
          buffersRemaining: 2,
          budgetRemaining: '$200.00',
          daysOfRunway: 25,
        },
        alerts: [
          { type: 'critical', message: 'Pipeline failed at TTS stage', timestamp: new Date().toISOString() },
        ],
      };

      await sendDigestEmail('2026-01-22', digest);

      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.html).toContain('No video published today');
      expect(callArgs.html).toContain('Pipeline failed');
    });

    it('should include performance section when available', async () => {
      const digest: DigestData = {
        video: {
          title: 'Test',
          url: 'https://youtube.com/test',
          topic: 'Test',
          source: 'Test',
          thumbnailVariant: 1,
        },
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'success',
          duration: '2h',
          cost: '$0.40',
          stages: [],
        },
        health: {
          buffersRemaining: 5,
          budgetRemaining: '$300.00',
          daysOfRunway: 40,
        },
        alerts: [],
        performance: {
          day1Views: 1500,
          ctr: 0.065,
          avgViewDuration: '4m 32s',
          thumbnailVariant: 2,
        },
      };

      await sendDigestEmail('2026-01-22', digest);

      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.html).toContain('1,500');
      expect(callArgs.html).toContain('6.5%');
    });

    it('should include tomorrow section when available', async () => {
      const digest: DigestData = {
        video: null,
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'skipped',
          duration: '5m',
          cost: '$0.00',
          stages: [],
        },
        health: {
          buffersRemaining: 1,
          budgetRemaining: '$50.00',
          daysOfRunway: 10,
        },
        alerts: [],
        tomorrow: {
          queuedTopic: 'New AI breakthrough',
          expectedPublishTime: '14:00 UTC',
        },
      };

      await sendDigestEmail('2026-01-22', digest);

      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.html).toContain('Tomorrow');
      expect(callArgs.html).toContain('New AI breakthrough');
    });
  });

  describe('sendAlertEmail', () => {
    it('should send alert email with correct severity styling', async () => {
      const config: AlertEmailConfig = {
        subject: 'Critical Pipeline Failure',
        body: 'Pipeline failed at TTS stage due to API timeout.',
        severity: 'CRITICAL',
      };

      const result = await sendAlertEmail(config);

      expect(result.success).toBe(true);
      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.subject).toContain('Critical');
      expect(callArgs.html).toContain('CRITICAL ALERT');
    });

    it('should send warning email', async () => {
      const config: AlertEmailConfig = {
        subject: 'Low Buffer Warning',
        body: 'Buffer video count is below threshold.',
        severity: 'WARNING',
      };

      const result = await sendAlertEmail(config);

      expect(result.success).toBe(true);
      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.html).toContain('WARNING ALERT');
    });
  });
});
