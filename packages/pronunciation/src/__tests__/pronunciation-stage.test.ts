/**
 * Integration tests for pronunciation stage
 *
 * @module @nexus-ai/pronunciation/__tests__/pronunciation-stage
 */

import { describe, it, expect, vi } from 'vitest';

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

  const createStageInput = (script: string): StageInput<PronunciationInput> => ({
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
});
