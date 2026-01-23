/**
 * Digest generation tests
 *
 * @module notifications/__tests__/digest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDigest,
  collectDigestData,
  formatDigestEmail,
  formatDigestPlainText,
} from '../digest.js';
import type { PipelineResultData, DigestData } from '../types.js';

// Mock dependencies
vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Digest Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDigest', () => {
    it('should generate digest from successful pipeline result', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'AI News Today',
        videoUrl: 'https://youtube.com/watch?v=abc123',
        topic: 'Machine Learning',
        source: 'Hacker News',
        thumbnailVariant: 2,
        durationMs: 3600000, // 1 hour
        totalCost: 0.47,
        stages: [
          { name: 'script-gen', status: 'completed', provider: 'gemini-3-pro', tier: 'primary' },
          { name: 'tts', status: 'completed', provider: 'gemini-tts', tier: 'primary' },
        ],
      };

      const digest = await generateDigest(pipelineResult);

      expect(digest.video).not.toBeNull();
      expect(digest.video?.title).toBe('AI News Today');
      expect(digest.video?.url).toBe('https://youtube.com/watch?v=abc123');
      expect(digest.video?.topic).toBe('Machine Learning');
      expect(digest.pipeline.status).toBe('success');
      expect(digest.pipeline.duration).toBe('1h 0m');
      expect(digest.pipeline.cost).toBe('$0.47');
      expect(digest.alerts).toHaveLength(0);
    });

    it('should generate digest with null video for failed pipeline', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'failed',
        durationMs: 1800000, // 30 minutes
        totalCost: 0.25,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult);

      expect(digest.video).toBeNull();
      expect(digest.pipeline.status).toBe('failed');
      expect(digest.alerts.length).toBeGreaterThan(0);
      expect(digest.alerts[0].type).toBe('critical');
    });

    it('should include alerts for quality context issues', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'degraded',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 2700000,
        totalCost: 0.55,
        stages: [],
        qualityContext: {
          degradedStages: ['tts', 'thumbnail'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: ['word-count-low'],
        },
      };

      const digest = await generateDigest(pipelineResult);

      expect(digest.alerts.length).toBeGreaterThan(0);
      expect(digest.alerts.some(a => a.message.includes('degraded'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('Degraded stages'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('Fallback providers'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('word-count-low'))).toBe(true);
    });

    it('should include warnings from pipeline result', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.60,
        stages: [],
        warnings: ['High cost warning: exceeded $0.50 threshold'],
      };

      const digest = await generateDigest(pipelineResult);

      expect(digest.alerts.some(a => a.message.includes('High cost warning'))).toBe(true);
    });

    it('should include additional data when provided', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.45,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult, {
        performance: {
          day1Views: 500,
          ctr: 0.055,
          thumbnailVariant: 1,
        },
        tomorrow: {
          queuedTopic: 'Next AI Topic',
          expectedPublishTime: '14:00 UTC',
        },
      });

      expect(digest.performance).toBeDefined();
      expect(digest.performance?.day1Views).toBe(500);
      expect(digest.tomorrow).toBeDefined();
      expect(digest.tomorrow?.queuedTopic).toBe('Next AI Topic');
    });

    it('should use default health data when not provided', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        durationMs: 3600000,
        totalCost: 0.40,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult);

      expect(digest.health).toBeDefined();
      expect(digest.health.buffersRemaining).toBe(-1); // -1 indicates unknown
      expect(digest.health.budgetRemaining).toBe('Unknown');
    });

    it('should include AUTO_PUBLISH_WITH_WARNING alerts from qualityDecision', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.45,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult, {
        qualityDecision: {
          decision: 'AUTO_PUBLISH_WITH_WARNING',
          reasons: ['1 minor issue detected - publishing with warnings'],
          issues: [
            { code: 'tts-retry-high', severity: 'minor', stage: 'tts', message: 'TTS required 4 attempts' },
          ],
          metrics: {
            totalStages: 5,
            degradedStages: 0,
            fallbacksUsed: 0,
            totalWarnings: 1,
            scriptWordCount: 1500,
            visualFallbackPercent: 0,
            pronunciationUnknowns: 0,
            ttsProvider: 'gemini-2.5-pro-tts',
            thumbnailFallback: false,
          },
          timestamp: '2026-01-22T12:00:00.000Z',
        },
      });

      expect(digest.alerts.some(a => a.message.includes('AUTO_PUBLISH_WITH_WARNING'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('TTS required 4 attempts'))).toBe(true);
    });

    it('should include HUMAN_REVIEW alerts from qualityDecision', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.45,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult, {
        qualityDecision: {
          decision: 'HUMAN_REVIEW',
          reasons: ['1 major issue detected requiring human review'],
          issues: [
            { code: 'tts-provider-fallback', severity: 'major', stage: 'tts', message: 'TTS fallback provider used' },
          ],
          metrics: {
            totalStages: 5,
            degradedStages: 1,
            fallbacksUsed: 1,
            totalWarnings: 0,
            scriptWordCount: 1500,
            visualFallbackPercent: 0,
            pronunciationUnknowns: 0,
            ttsProvider: 'chirp3-hd',
            thumbnailFallback: false,
          },
          timestamp: '2026-01-22T12:00:00.000Z',
          reviewItemId: 'review-123',
        },
      });

      expect(digest.alerts.some(a => a.type === 'critical' && a.message.includes('HUMAN_REVIEW'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('TTS fallback provider used'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('review-123'))).toBe(true);
    });

    it('should include AUTO_PUBLISH info alert from qualityDecision', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.45,
        stages: [],
      };

      const digest = await generateDigest(pipelineResult, {
        qualityDecision: {
          decision: 'AUTO_PUBLISH',
          reasons: ['All checks passed'],
          issues: [],
          metrics: {
            totalStages: 5,
            degradedStages: 0,
            fallbacksUsed: 0,
            totalWarnings: 0,
            scriptWordCount: 1500,
            visualFallbackPercent: 0,
            pronunciationUnknowns: 0,
            ttsProvider: 'gemini-2.5-pro-tts',
            thumbnailFallback: false,
          },
          timestamp: '2026-01-22T12:00:00.000Z',
        },
      });

      expect(digest.alerts.some(a => a.type === 'info' && a.message.includes('AUTO_PUBLISH'))).toBe(true);
      expect(digest.alerts.some(a => a.message.includes('All checks passed'))).toBe(true);
    });
  });

  describe('collectDigestData', () => {
    it('should collect data from pipeline result', async () => {
      const pipelineResult: PipelineResultData = {
        status: 'success',
        videoTitle: 'Test Video',
        videoUrl: 'https://youtube.com/test',
        durationMs: 3600000,
        totalCost: 0.45,
        stages: [],
      };

      const digest = await collectDigestData('2026-01-22', pipelineResult);

      expect(digest.pipeline.pipelineId).toBeDefined();
      expect(digest.health).toBeDefined();
    });
  });

  describe('formatDigestEmail', () => {
    it('should format digest as HTML', () => {
      const digest: DigestData = {
        video: {
          title: 'Test Video',
          url: 'https://youtube.com/test',
          topic: 'AI',
          source: 'HN',
          thumbnailVariant: 1,
        },
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'success',
          duration: '2h 30m',
          cost: '$0.45',
          stages: [],
        },
        health: {
          buffersRemaining: 3,
          budgetRemaining: '$250.00',
          daysOfRunway: 30,
        },
        alerts: [],
      };

      const html = formatDigestEmail(digest);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Test Video');
      expect(html).toContain('SUCCESS');
      expect(html).toContain('$0.45');
      expect(html).toContain('Buffer Videos');
    });

    it('should include alerts section when alerts present', () => {
      const digest: DigestData = {
        video: null,
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'failed',
          duration: '1h',
          cost: '$0.20',
          stages: [],
        },
        health: {
          buffersRemaining: 2,
          budgetRemaining: '$200.00',
          daysOfRunway: 25,
        },
        alerts: [
          { type: 'critical', message: 'Pipeline failed', timestamp: new Date().toISOString() },
          { type: 'warning', message: 'Buffer low', timestamp: new Date().toISOString() },
        ],
      };

      const html = formatDigestEmail(digest);

      expect(html).toContain('Alerts');
      expect(html).toContain('Pipeline failed');
      expect(html).toContain('Buffer low');
      expect(html).toContain('alert-critical');
      expect(html).toContain('alert-warning');
    });

    it('should escape HTML in user content', () => {
      const digest: DigestData = {
        video: {
          title: '<script>alert("xss")</script>',
          url: 'https://youtube.com/test',
          topic: 'AI & ML',
          source: 'Test <b>Source</b>',
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
          buffersRemaining: 3,
          budgetRemaining: '$250.00',
          daysOfRunway: 30,
        },
        alerts: [],
      };

      const html = formatDigestEmail(digest);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('AI &amp; ML');
    });
  });

  describe('formatDigestPlainText', () => {
    it('should format digest as plain text', () => {
      const digest: DigestData = {
        video: {
          title: 'Test Video',
          url: 'https://youtube.com/test',
          topic: 'AI',
          source: 'HN',
          thumbnailVariant: 1,
        },
        pipeline: {
          pipelineId: '2026-01-22',
          status: 'success',
          duration: '2h 30m',
          cost: '$0.45',
          stages: [],
        },
        health: {
          buffersRemaining: 3,
          budgetRemaining: '$250.00',
          daysOfRunway: 30,
        },
        alerts: [],
      };

      const text = formatDigestPlainText(digest);

      expect(text).toContain('NEXUS-AI Daily Digest');
      expect(text).toContain('Test Video');
      expect(text).toContain('SUCCESS');
      expect(text).toContain('Buffers: 3');
      expect(text).not.toContain('<');
    });

    it('should handle digest with no video', () => {
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
          buffersRemaining: 0,
          budgetRemaining: '$100.00',
          daysOfRunway: 15,
        },
        alerts: [],
      };

      const text = formatDigestPlainText(digest);

      expect(text).toContain('No video published today');
    });
  });
});
