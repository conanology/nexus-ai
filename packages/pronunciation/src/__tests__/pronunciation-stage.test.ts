/**
 * Integration tests for pronunciation stage
 *
 * @module @nexus-ai/pronunciation/__tests__/pronunciation-stage
 */

import { describe, it, expect, vi } from 'vitest';
import type { ScriptGenOutput } from '@nexus-ai/script-gen';

// MOCK EVERYTHING BEFORE IMPORTS
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual as any,
    executeStage: vi.fn().mockImplementation(async (input, stage, execute, options) => {
      const result = await execute(input.data, input.config);
      return {
        success: true,
        data: result,
        quality: {
          stage,
          timestamp: new Date().toISOString(),
          measurements: { accuracyPct: 100, totalTerms: 10, knownTerms: 10, unknownTerms: 0 }
        },
        cost: { totalCost: 0, breakdown: [] },
        durationMs: 100,
        provider: { name: 'mock', tier: 'primary', attempts: 1 }
      };
    }),
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn().mockReturnValue({ totalCost: 0 }),
      persist: vi.fn().mockResolvedValue(undefined),
    })),
    addToReviewQueue: vi.fn().mockResolvedValue(undefined),
    PRONUNCIATION_UNKNOWN_THRESHOLD: 3,
    logger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('@nexus-ai/core/storage', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: vi.fn().mockResolvedValue(null),
    setDocument: vi.fn().mockResolvedValue(undefined),
    queryDocuments: vi.fn().mockResolvedValue([]),
  })),
}));

import { executePronunciation, type PronunciationInput } from '../pronunciation-stage.js';
import type { StageInput, StageConfig } from '@nexus-ai/core';

describe('executePronunciation', () => {
  const mockConfig: StageConfig = {
    timeout: 30000,
    retries: 3,
  };

  const createStageInput = (script: string | ScriptGenOutput): StageInput<PronunciationInput> => ({
    pipelineId: '2026-01-16',
    previousStage: 'script-gen',
    data: { script },
    config: mockConfig,
  });

  describe('Basic Functionality', () => {
    it('should extract terms and generate SSML-tagged script', async () => {
      const script = 'GPT and LLaMA are powerful LLM models for AI applications.';
      const input = createStageInput(script);

      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.data.ssmlScript).toBeDefined();
    });
  });

  describe('Quality Metrics', () => {
    it('should return accuracy metric in measurements', async () => {
      const script = 'GPT, LLM, and AI are commonly used.';
      const input = createStageInput(script);

      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.quality.measurements.accuracyPct).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process a script quickly', async () => {
      const input = createStageInput('Test script');
      const result = await executePronunciation(input);
      expect(result.success).toBe(true);
    });
  });

  describe('V1 Input Handling (string with brackets)', () => {
    it('should strip [VISUAL:...] tags from V1 input', async () => {
      const v1Script = `[VISUAL:neural_network]
Today we're exploring transformers.

[VISUAL:code_highlight]
Here's the attention mechanism with GPT and LLM.`;

      const input = createStageInput(v1Script);
      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.data.ssmlScript).toBeDefined();
      // SSML output should not contain [VISUAL:...] tags
      expect(result.data.ssmlScript).not.toMatch(/\[VISUAL:[^\]]+\]/);
    });

    it('should strip [PRONOUNCE:...] tags from V1 input', async () => {
      const v1Script = `Let's talk about [PRONOUNCE:softmax:ˈsɒftmæks] and GPT.`;

      const input = createStageInput(v1Script);
      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.data.ssmlScript).toBeDefined();
      // SSML output should not contain [PRONOUNCE:...] tags
      expect(result.data.ssmlScript).not.toMatch(/\[PRONOUNCE:[^\]]+\]/);
    });

    it('should strip [MUSIC:...] and [SFX:...] tags from V1 input', async () => {
      const v1Script = `[MUSIC:upbeat]
Welcome to our video!

[SFX:whoosh]
Let's dive in.`;

      const input = createStageInput(v1Script);
      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.data.ssmlScript).toBeDefined();
      // SSML output should not contain [MUSIC:...] or [SFX:...] tags
      expect(result.data.ssmlScript).not.toMatch(/\[MUSIC:[^\]]+\]/);
      expect(result.data.ssmlScript).not.toMatch(/\[SFX:[^\]]+\]/);
    });
  });

  describe('Error Handling', () => {
    it('should throw NexusError for empty string input', async () => {
      const input = createStageInput('');

      await expect(executePronunciation(input)).rejects.toThrow('Script input cannot be empty');
    });

    it('should throw NexusError for whitespace-only string input', async () => {
      const input = createStageInput('   \n\t  ');

      await expect(executePronunciation(input)).rejects.toThrow('Script input cannot be empty');
    });
  });

  describe('V2 Input Handling (ScriptGenOutput object)', () => {
    it('should use scriptText directly from V2 ScriptGenOutput', async () => {
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: 'Today we explore transformers. Here is the attention mechanism: softmax.',
        scriptText: 'Today we explore transformers.\n\nHere is the attention mechanism: softmax.',
        scriptUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
        directionDocument: {
          version: '2.0',
          metadata: {
            title: 'Test Video',
            slug: 'test-video',
            estimatedDurationSec: 120,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            generatedAt: new Date().toISOString(),
          },
          segments: [],
          globalAudio: {
            defaultMood: 'neutral',
            musicTransitions: 'smooth',
          },
        },
        directionUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/direction.json',
        wordCount: 12,
        artifactUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
        draftUrls: {},
      };

      const input = createStageInput(v2Output);
      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      expect(result.data.ssmlScript).toBeDefined();
    });

    it('should produce SSML without any bracket patterns from V2 input', async () => {
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: 'GPT and LLM are AI technologies.',
        scriptText: 'GPT and LLM are AI technologies.',
        scriptUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
        directionDocument: {
          version: '2.0',
          metadata: {
            title: 'Test',
            slug: 'test',
            estimatedDurationSec: 60,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            generatedAt: new Date().toISOString(),
          },
          segments: [],
          globalAudio: { defaultMood: 'neutral', musicTransitions: 'smooth' },
        },
        directionUrl: 'gs://test',
        wordCount: 5,
        artifactUrl: 'gs://test',
        draftUrls: {},
      };

      const input = createStageInput(v2Output);
      const result = await executePronunciation(input);

      expect(result.success).toBe(true);
      // SSML should not contain any bracket patterns
      expect(result.data.ssmlScript).not.toMatch(/\[[A-Z]+:[^\]]+\]/);
    });
  });
});
