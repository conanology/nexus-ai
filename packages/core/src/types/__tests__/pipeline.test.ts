/**
 * Type validation tests for pipeline types
 */

import { describe, it, expect } from 'vitest';
import type {
  StageConfig,
  ArtifactRef,
  QualityContext,
  StageInput,
  StageOutput,
  PipelineState,
} from '../pipeline.js';
import { ErrorSeverity } from '../errors.js';

describe('Pipeline Types', () => {
  describe('StageConfig', () => {
    it('should accept valid stage configuration', () => {
      const config: StageConfig = {
        timeout: 60000,
        retries: 3,
        maxConcurrency: 5,
      };

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(3);
      expect(config.maxConcurrency).toBe(5);
    });

    it('should allow stage-specific options', () => {
      const config: StageConfig = {
        timeout: 120000,
        retries: 2,
        voice: 'en-US-Neural2-F',
        speakingRate: 0.95,
      };

      expect(config.voice).toBe('en-US-Neural2-F');
      expect(config.speakingRate).toBe(0.95);
    });
  });

  describe('ArtifactRef', () => {
    it('should accept valid artifact reference', () => {
      const artifact: ArtifactRef = {
        type: 'audio',
        url: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
        size: 1523456,
        contentType: 'audio/wav',
        generatedAt: '2026-01-08T08:23:45.123Z',
        stage: 'tts',
      };

      expect(artifact.type).toBe('audio');
      expect(artifact.url).toContain('gs://');
      expect(artifact.size).toBeGreaterThan(0);
    });

    it('should support all artifact types', () => {
      const types: ArtifactRef['type'][] = ['audio', 'video', 'image', 'json', 'text'];

      types.forEach((type) => {
        const artifact: ArtifactRef = {
          type,
          url: `gs://nexus-ai-artifacts/file.${type}`,
          size: 1024,
          contentType: `application/${type}`,
          generatedAt: new Date().toISOString(),
          stage: 'test',
        };
        expect(artifact.type).toBe(type);
      });
    });
  });

  describe('QualityContext', () => {
    it('should track degradation through pipeline', () => {
      const context: QualityContext = {
        degradedStages: ['pronunciation'],
        fallbacksUsed: ['tts:chirp3-hd', 'thumbnail:template'],
        flags: ['word-count-low'],
      };

      expect(context.degradedStages).toHaveLength(1);
      expect(context.fallbacksUsed).toHaveLength(2);
      expect(context.flags).toContain('word-count-low');
    });
  });

  describe('StageInput', () => {
    it('should accept generic type parameter', () => {
      interface TTSInput {
        ssmlScript: string;
      }

      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Hello world</speak>',
        },
        config: {
          timeout: 120000,
          retries: 2,
        },
      };

      expect(input.pipelineId).toBe('2026-01-08');
      expect(input.previousStage).toBe('pronunciation');
      expect(input.data.ssmlScript).toContain('speak');
    });

    it('should allow null previousStage for first stage', () => {
      const input: StageInput<Record<string, never>> = {
        pipelineId: '2026-01-08',
        previousStage: null,
        data: {},
        config: {
          timeout: 30000,
          retries: 3,
        },
      };

      expect(input.previousStage).toBeNull();
    });

    it('should support optional quality context', () => {
      const input: StageInput<{ text: string }> = {
        pipelineId: '2026-01-08',
        previousStage: 'script-gen',
        data: { text: 'sample' },
        config: { timeout: 60000, retries: 2 },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      };

      expect(input.qualityContext).toBeDefined();
      expect(input.qualityContext?.degradedStages).toEqual([]);
    });
  });

  describe('StageOutput', () => {
    it('should accept generic type parameter', () => {
      interface TTSOutput {
        audioUrl: string;
        durationSec: number;
      }

      const output: StageOutput<TTSOutput> = {
        success: true,
        data: {
          audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
          durationSec: 487,
        },
        artifacts: [
          {
            type: 'audio',
            url: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
            size: 1523456,
            contentType: 'audio/wav',
            generatedAt: '2026-01-08T08:23:45.123Z',
            stage: 'tts',
          },
        ],
        quality: {
          stage: 'tts',
          timestamp: '2026-01-08T08:23:45.123Z',
          measurements: {
            silencePct: 3.2,
            clippingDetected: false,
          },
        },
        cost: {
          service: 'chirp3-hd',
          tokens: {},
          cost: 0.0045,
          timestamp: '2026-01-08T08:23:45.123Z',
        },
        durationMs: 12430,
        provider: {
          name: 'chirp3-hd',
          tier: 'fallback',
          attempts: 2,
        },
        warnings: ['Primary TTS provider failed, using fallback'],
      };

      expect(output.success).toBe(true);
      expect(output.data.durationSec).toBe(487);
      expect(output.provider.tier).toBe('fallback');
      expect(output.warnings).toHaveLength(1);
    });

    it('should track provider tier for quality gate', () => {
      const output: StageOutput<{ result: string }> = {
        success: true,
        data: { result: 'test' },
        quality: {
          stage: 'test',
          timestamp: new Date().toISOString(),
          measurements: {},
        },
        cost: {
          service: 'gemini-3-pro-preview',
          tokens: { input: 100, output: 50 },
          cost: 0.0015,
          timestamp: new Date().toISOString(),
        },
        durationMs: 1000,
        provider: {
          name: 'gemini-3-pro-preview',
          tier: 'primary',
          attempts: 1,
        },
      };

      expect(output.provider.tier).toBe('primary');
      expect(output.provider.attempts).toBe(1);
    });
  });

  describe('PipelineState', () => {
    it('should track pipeline execution state', () => {
      const state: PipelineState = {
        pipelineId: '2026-01-08',
        stage: 'tts',
        status: 'running',
        startTime: '2026-01-08T08:00:00.000Z',
        topic: 'AI Advances in 2026',
        errors: [],
      };

      expect(state.pipelineId).toBe('2026-01-08');
      expect(state.stage).toBe('tts');
      expect(state.status).toBe('running');
    });

    it('should support all status values', () => {
      const statuses: PipelineState['status'][] = [
        'pending',
        'running',
        'success',
        'failed',
        'skipped',
      ];

      statuses.forEach((status) => {
        const state: PipelineState = {
          pipelineId: '2026-01-08',
          stage: 'test',
          status,
          startTime: new Date().toISOString(),
          errors: [],
        };
        expect(state.status).toBe(status);
      });
    });

    it('should track errors with severity', () => {
      const state: PipelineState = {
        pipelineId: '2026-01-08',
        stage: 'tts',
        status: 'failed',
        startTime: '2026-01-08T08:00:00.000Z',
        endTime: '2026-01-08T08:05:00.000Z',
        errors: [
          {
            code: 'NEXUS_TTS_TIMEOUT',
            message: 'TTS synthesis timed out after 120000ms',
            stage: 'tts',
            timestamp: '2026-01-08T08:05:00.000Z',
            severity: ErrorSeverity.RETRYABLE,
          },
        ],
      };

      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].code).toBe('NEXUS_TTS_TIMEOUT');
    });

    it('should accumulate quality context', () => {
      const state: PipelineState = {
        pipelineId: '2026-01-08',
        stage: 'youtube',
        status: 'success',
        startTime: '2026-01-08T08:00:00.000Z',
        endTime: '2026-01-08T12:00:00.000Z',
        topic: 'Test Topic',
        errors: [],
        qualityContext: {
          degradedStages: ['pronunciation'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: ['word-count-edge'],
        },
      };

      expect(state.qualityContext?.fallbacksUsed).toContain('tts:chirp3-hd');
      expect(state.qualityContext?.degradedStages).toHaveLength(1);
    });
  });
});
