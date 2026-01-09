/**
 * Type validation tests for quality types
 */

import { describe, it, expect } from 'vitest';
import type {
  QualityMetrics,
  QualityGateResult,
  ScriptQualityMetrics,
  TTSQualityMetrics,
  RenderQualityMetrics,
  ThumbnailQualityMetrics,
  PronunciationQualityMetrics,
  PrePublishQualityGate,
} from '../quality.js';

describe('Quality Types', () => {
  describe('QualityMetrics', () => {
    it('should accept base quality metrics', () => {
      const metrics: QualityMetrics = {
        stage: 'test',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          customMetric: 100,
        },
      };

      expect(metrics.stage).toBe('test');
      expect(metrics.measurements).toBeDefined();
    });
  });

  describe('QualityGateResult', () => {
    it('should support all gate statuses', () => {
      const statuses: QualityGateResult['status'][] = ['PASS', 'WARN', 'FAIL'];

      statuses.forEach((status) => {
        const result: QualityGateResult = {
          status,
          metrics: {},
          warnings: [],
          stage: 'test',
        };
        expect(result.status).toBe(status);
      });
    });

    it('should include failure reason on FAIL', () => {
      const result: QualityGateResult = {
        status: 'FAIL',
        metrics: { wordCount: 1000 },
        warnings: [],
        reason: 'Word count below minimum threshold of 1200',
        stage: 'script-gen',
      };

      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('Word count');
    });
  });

  describe('ScriptQualityMetrics', () => {
    it('should validate NFR21 word count requirement', () => {
      const metrics: ScriptQualityMetrics = {
        stage: 'script-gen',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          wordCount: 1500,
          readingTimeSeconds: 450,
          sentenceCount: 75,
          technicalTermCount: 12,
          visualCueCount: 8,
        },
      };

      expect(metrics.measurements.wordCount).toBeGreaterThanOrEqual(1200);
      expect(metrics.measurements.wordCount).toBeLessThanOrEqual(1800);
      expect(metrics.measurements.visualCueCount).toBe(8);
    });

    it('should track technical terms for pronunciation stage', () => {
      const metrics: ScriptQualityMetrics = {
        stage: 'script-gen',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          wordCount: 1450,
          readingTimeSeconds: 435,
          sentenceCount: 72,
          technicalTermCount: 18,
          visualCueCount: 10,
        },
      };

      expect(metrics.measurements.technicalTermCount).toBe(18);
    });
  });

  describe('TTSQualityMetrics', () => {
    it('should validate TTS quality constraints', () => {
      const metrics: TTSQualityMetrics = {
        stage: 'tts',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          silencePct: 3.2,
          clippingDetected: false,
          averageLoudnessDb: -15.0,
          durationSec: 487,
          codec: 'wav',
          sampleRate: 44100,
        },
      };

      expect(metrics.measurements.silencePct).toBeLessThan(5);
      expect(metrics.measurements.clippingDetected).toBe(false);
      expect(metrics.measurements.sampleRate).toBe(44100);
    });

    it('should track segment count for chunked audio', () => {
      const metrics: TTSQualityMetrics = {
        stage: 'tts',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          silencePct: 2.8,
          clippingDetected: false,
          averageLoudnessDb: -14.5,
          durationSec: 520,
          codec: 'wav',
          sampleRate: 44100,
          segmentCount: 4,
        },
      };

      expect(metrics.measurements.segmentCount).toBe(4);
    });
  });

  describe('RenderQualityMetrics', () => {
    it('should validate NFR7 render quality requirements', () => {
      const metrics: RenderQualityMetrics = {
        stage: 'render',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          frameDrops: 0,
          audioSyncMs: 45,
          durationSec: 360,
          resolution: '1920x1080',
          frameRate: 30,
          bitrate: 8.5,
          fileSize: 384000000,
        },
      };

      expect(metrics.measurements.frameDrops).toBe(0);
      expect(metrics.measurements.audioSyncMs).toBeLessThan(100);
      expect(metrics.measurements.resolution).toBe('1920x1080');
    });

    it('should track video duration in target range', () => {
      const metrics: RenderQualityMetrics = {
        stage: 'render',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          frameDrops: 0,
          audioSyncMs: 32,
          durationSec: 420,
          resolution: '1920x1080',
          frameRate: 30,
          bitrate: 8.5,
          fileSize: 448000000,
        },
      };

      expect(metrics.measurements.durationSec).toBeGreaterThanOrEqual(300);
      expect(metrics.measurements.durationSec).toBeLessThanOrEqual(480);
    });
  });

  describe('ThumbnailQualityMetrics', () => {
    it('should validate NFR22 requirement for 3 variants', () => {
      const metrics: ThumbnailQualityMetrics = {
        stage: 'thumbnail',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          variantsGenerated: 3,
          textLegibility: 85,
          colorContrast: 5.2,
          usingTemplates: false,
        },
      };

      expect(metrics.measurements.variantsGenerated).toBe(3);
      expect(metrics.measurements.usingTemplates).toBe(false);
    });

    it('should track fallback template usage', () => {
      const metrics: ThumbnailQualityMetrics = {
        stage: 'thumbnail',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          variantsGenerated: 3,
          textLegibility: 78,
          colorContrast: 4.8,
          usingTemplates: true,
        },
      };

      expect(metrics.measurements.usingTemplates).toBe(true);
    });

    it('should validate WCAG AA contrast ratio', () => {
      const metrics: ThumbnailQualityMetrics = {
        stage: 'thumbnail',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          variantsGenerated: 3,
          textLegibility: 88,
          colorContrast: 6.1,
          usingTemplates: false,
        },
      };

      expect(metrics.measurements.colorContrast).toBeGreaterThan(4.5);
    });
  });

  describe('PronunciationQualityMetrics', () => {
    it('should validate NFR18 accuracy requirement', () => {
      const metrics: PronunciationQualityMetrics = {
        stage: 'pronunciation',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          totalTerms: 150,
          knownTerms: 148,
          unknownTerms: 2,
          accuracyPct: 98.67,
          flaggedForReview: false,
          termsAdded: 0,
        },
      };

      expect(metrics.measurements.accuracyPct).toBeGreaterThan(98);
      expect(metrics.measurements.flaggedForReview).toBe(false);
    });

    it('should flag review when >3 unknown terms', () => {
      const metrics: PronunciationQualityMetrics = {
        stage: 'pronunciation',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          totalTerms: 160,
          knownTerms: 155,
          unknownTerms: 5,
          accuracyPct: 96.88,
          flaggedForReview: true,
          termsAdded: 2,
        },
      };

      expect(metrics.measurements.unknownTerms).toBeGreaterThan(3);
      expect(metrics.measurements.flaggedForReview).toBe(true);
    });

    it('should track new dictionary entries', () => {
      const metrics: PronunciationQualityMetrics = {
        stage: 'pronunciation',
        timestamp: '2026-01-08T08:23:45.123Z',
        measurements: {
          totalTerms: 145,
          knownTerms: 142,
          unknownTerms: 3,
          accuracyPct: 97.93,
          flaggedForReview: false,
          termsAdded: 3,
        },
      };

      expect(metrics.measurements.termsAdded).toBe(3);
    });
  });

  describe('PrePublishQualityGate', () => {
    it('should support AUTO_PUBLISH decision', () => {
      const gate: PrePublishQualityGate = {
        decision: 'AUTO_PUBLISH',
        issues: [],
        fallbacksUsed: [],
        degradedStages: [],
      };

      expect(gate.decision).toBe('AUTO_PUBLISH');
      expect(gate.issues).toHaveLength(0);
      expect(gate.fallbacksUsed).toHaveLength(0);
    });

    it('should support AUTO_PUBLISH_WITH_WARNING decision', () => {
      const gate: PrePublishQualityGate = {
        decision: 'AUTO_PUBLISH_WITH_WARNING',
        issues: [
          {
            stage: 'script-gen',
            severity: 'warning',
            message: 'Word count near lower bound: 1250',
          },
        ],
        fallbacksUsed: [],
        degradedStages: [],
      };

      expect(gate.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(gate.issues).toHaveLength(1);
      expect(gate.issues[0].severity).toBe('warning');
    });

    it('should trigger HUMAN_REVIEW for TTS fallback', () => {
      const gate: PrePublishQualityGate = {
        decision: 'HUMAN_REVIEW',
        issues: [
          {
            stage: 'tts',
            severity: 'error',
            message: 'Fallback TTS provider used (chirp3-hd)',
          },
        ],
        fallbacksUsed: ['tts:chirp3-hd'],
        degradedStages: ['tts'],
        recommendedAction: 'Review audio quality before publishing',
      };

      expect(gate.decision).toBe('HUMAN_REVIEW');
      expect(gate.fallbacksUsed).toContain('tts:chirp3-hd');
      expect(gate.recommendedAction).toBeDefined();
    });

    it('should track multiple degraded stages', () => {
      const gate: PrePublishQualityGate = {
        decision: 'HUMAN_REVIEW',
        issues: [
          {
            stage: 'tts',
            severity: 'error',
            message: 'TTS fallback used',
          },
          {
            stage: 'thumbnail',
            severity: 'warning',
            message: 'Using template thumbnails',
          },
        ],
        fallbacksUsed: ['tts:chirp3-hd', 'thumbnail:template'],
        degradedStages: ['tts', 'thumbnail'],
        recommendedAction: 'Multiple quality degradations detected - manual review required',
      };

      expect(gate.degradedStages).toHaveLength(2);
      expect(gate.fallbacksUsed).toHaveLength(2);
      expect(gate.issues).toHaveLength(2);
    });
  });
});
