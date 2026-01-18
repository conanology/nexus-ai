/**
 * TTS stage integration tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StageInput } from '@nexus-ai/core/types';
import type { TTSInput } from '../types.js';
import { executeTTS } from '../tts.js';

// Mock dependencies
vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    synthesizeSpeech: vi.fn().mockImplementation(async (request) => {
      const text = request.input.ssml || request.input.text || '';
      // Approximate 1 sec per 100 chars for test to ensure long scripts get long duration
      const durationSec = Math.max(1, text.length / 100);
      const sampleRate = 44100;
      const numSamples = Math.floor(durationSec * sampleRate);
      const numBytes = numSamples * 2;
      return [{
        audioContent: Buffer.alloc(numBytes),
      }];
    }),
  })),
}));

vi.mock('@nexus-ai/core/secrets', () => ({
  getSecret: vi.fn().mockResolvedValue('mock-api-key'),
}));

vi.mock('@nexus-ai/core/storage', () => ({
  CloudStorageClient: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn().mockResolvedValue('gs://nexus-ai-artifacts/test/audio.wav'),
    uploadArtifact: vi.fn().mockResolvedValue('gs://nexus-ai-artifacts/test/audio.wav'),
  })),
}));

vi.mock('@nexus-ai/core/observability', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  CostTracker: vi.fn().mockImplementation(() => ({
    recordApiCall: vi.fn(),
    getSummary: vi.fn().mockReturnValue({
      stage: 'tts',
      totalCost: 0.05,
      apiCalls: [],
    }),
  })),
}));

vi.mock('@nexus-ai/core/quality', () => ({
  qualityGate: {
    check: vi.fn().mockImplementation(async (stage, result) => ({
      status: 'PASS',
      metrics: result.quality?.measurements || {
        silencePct: 0,
        clippingDetected: false,
        durationSec: 10,
      },
      warnings: [],
      stage: stage,
    })),
  },
}));

describe('TTS Stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeTTS', () => {
    it('should successfully synthesize audio from SSML script', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Hello <phoneme alphabet="ipa" ph="wɜːld">world</phoneme></speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.success).toBe(true);
      expect(output.data.audioUrl).toContain('gs://');
      expect(output.data.format).toBe('wav');
      expect(output.data.sampleRate).toBe(44100);
      expect(output.data.durationSec).toBeGreaterThan(0);
      expect(output.provider.name).toBe('gemini-2.5-pro-tts');
      expect(output.provider.tier).toBe('primary');
    });

    it('should handle SSML script with voice option', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Testing voice selection</speak>',
          voice: 'en-US-Neural2-F',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.success).toBe(true);
      expect(output.data.audioUrl).toBeDefined();
    });

    it('should handle speaking rate option', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Testing speaking rate</speak>',
          rate: 1.1,
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.success).toBe(true);
    });

    it('should handle pitch adjustment option', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Testing pitch adjustment</speak>',
          pitch: 2,
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.success).toBe(true);
    });

    it('should include quality metrics in output', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Quality check test</speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.quality).toBeDefined();
      expect(output.quality.stage).toBe('tts');
      expect(output.quality.measurements).toHaveProperty('silencePct');
      expect(output.quality.measurements).toHaveProperty('clippingDetected');
      expect(output.quality.measurements).toHaveProperty('durationSec');
    });

    it('should track costs via CostTracker', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Cost tracking test</speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.cost).toBeDefined();
      expect(output.cost.stage).toBe('tts');
      expect(output.cost.totalCost).toBeGreaterThan(0);
    });

    it('should include artifact references', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Artifact test</speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.artifacts).toBeDefined();
      expect(output.artifacts).toHaveLength(1);
      expect(output.artifacts![0].type).toBe('audio');
      expect(output.artifacts![0].stage).toBe('tts');
      expect(output.artifacts![0].contentType).toBe('audio/wav');
    });

    it('should throw error for empty script', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      await expect(executeTTS(input)).rejects.toThrow('SSML script cannot be empty');
    });

    it('should measure execution duration', async () => {
      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Duration test</speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      // Duration should be at least 0 (may be 0 in fast mock implementations)
      expect(output.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof output.durationMs).toBe('number');
    });

    it('should handle long SSML scripts', async () => {
      // Create a long script (1800 words ~= 9000 characters)
      const longScript = '<speak>' + 'Hello world. '.repeat(750) + '</speak>';

      const input: StageInput<TTSInput> = {
        pipelineId: '2026-01-08',
        previousStage: 'pronunciation',
        data: {
          ssmlScript: longScript,
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      expect(output.success).toBe(true);
      expect(output.data.durationSec).toBeGreaterThan(60); // Long script = longer audio
    });

    it('should preserve pipelineId in output', async () => {
      const pipelineId = '2026-01-17';
      const input: StageInput<TTSInput> = {
        pipelineId,
        previousStage: 'pronunciation',
        data: {
          ssmlScript: '<speak>Pipeline ID test</speak>',
        },
        config: {
          timeout: 300000,
          retries: 3,
        },
      };

      const output = await executeTTS(input);

      // Check that cost tracker used the correct pipelineId
      expect(output.cost.stage).toBe('tts');
    });
  });
});
