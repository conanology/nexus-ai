/**
 * Tests for pronunciation stage review queue integration
 * @module @nexus-ai/pronunciation/__tests__/review-integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @nexus-ai/core - use inline function to avoid hoisting issues
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...(actual as object),
    addToReviewQueue: vi.fn(),
    PRONUNCIATION_UNKNOWN_THRESHOLD: 3,
    executeStage: vi.fn(async (_input, _stageName, executor, _options) => {
      const result = await executor(_input.data);
      return {
        success: true,
        data: result,
        quality: result.quality,
        cost: { total: 0.01 },
        durationMs: 100,
        provider: { name: 'test', tier: 'primary', attempts: 1 },
      };
    }),
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    CostTracker: vi.fn(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn(() => ({ total: 0.01 })),
    })),
  };
});

// Mock pronunciation client
vi.mock('../pronunciation-client.js', () => ({
  PronunciationClient: vi.fn(() => ({
    getDictionary: vi.fn().mockResolvedValue({}),
    lookupTerm: vi.fn().mockResolvedValue(null), // All terms unknown
  })),
}));

// Mock extractor
vi.mock('../extractor.js', () => ({
  extractTerms: vi.fn((script: string) => {
    // Simulate extracting terms from script
    const terms = script.match(/\b[A-Z][a-z]*[A-Z]\w*\b/g) || [];
    return terms;
  }),
  extractContext: vi.fn((script: string, term: string) => {
    const index = script.indexOf(term);
    const start = Math.max(0, index - 50);
    const end = Math.min(script.length, index + term.length + 50);
    return script.substring(start, end);
  }),
}));

// Mock SSML tagger
vi.mock('../ssml-tagger.js', () => ({
  tagScript: vi.fn((script: string) => `<speak>${script}</speak>`),
}));

// Import after mocking
import { executePronunciation } from '../pronunciation-stage.js';
import { addToReviewQueue } from '@nexus-ai/core';
import type { StageInput } from '@nexus-ai/core';
import type { PronunciationInput } from '../pronunciation-stage.js';

// Get the mocked function for assertions
const mockAddToReviewQueue = vi.mocked(addToReviewQueue);

describe('Pronunciation Stage Review Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Review queue flagging', () => {
    it('should NOT create review item when <= 3 unknown terms', async () => {
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: 'This script mentions GPT and LLM and AI terms.',
        },
        config: {},
      };

      // Mock extractTerms to return exactly 3 terms
      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(['GPT', 'LLM', 'AI']);

      await executePronunciation(input);

      expect(mockAddToReviewQueue).not.toHaveBeenCalled();
    });

    it('should create review item when > 3 unknown terms', async () => {
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: 'This script mentions GPT, LLM, AI, TensorRT, and CUDA terms.',
        },
        config: {},
      };

      // Mock extractTerms to return 5 terms (all unknown)
      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(['GPT', 'LLM', 'AI', 'TensorRT', 'CUDA']);

      mockAddToReviewQueue.mockResolvedValueOnce('review-id-123');

      await executePronunciation(input);

      expect(mockAddToReviewQueue).toHaveBeenCalledTimes(1);
      expect(mockAddToReviewQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pronunciation',
          pipelineId: '2026-01-22',
          stage: 'pronunciation',
        })
      );
    });

    it('should include unknown terms in review item content', async () => {
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: 'Script with GPT-4o, LLaMA, Claude, Gemini, and Mistral models.',
        },
        config: {},
      };

      const unknownTerms = ['GPT-4o', 'LLaMA', 'Claude', 'Gemini', 'Mistral'];
      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(unknownTerms);

      mockAddToReviewQueue.mockResolvedValueOnce('review-id-123');

      await executePronunciation(input);

      expect(mockAddToReviewQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({
            unknownTerms: expect.arrayContaining(unknownTerms),
            totalTerms: 5,
            knownTerms: 0,
          }),
        })
      );
    });

    it('should include script excerpt in review item context', async () => {
      const scriptContent = 'A'.repeat(600) + ' GPT-4o LLaMA Claude Gemini Mistral terms.';
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: scriptContent,
        },
        config: {},
      };

      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(['GPT-4o', 'LLaMA', 'Claude', 'Gemini', 'Mistral']);

      mockAddToReviewQueue.mockResolvedValueOnce('review-id-123');

      await executePronunciation(input);

      expect(mockAddToReviewQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            scriptExcerpt: expect.any(String),
            termLocations: expect.arrayContaining([
              expect.objectContaining({
                term: expect.any(String),
                lineNumber: expect.any(Number),
                surroundingText: expect.any(String),
              }),
            ]),
          }),
        })
      );

      // Verify excerpt is limited to 500 chars
      const callArgs = mockAddToReviewQueue.mock.calls[0][0];
      expect(callArgs.context.scriptExcerpt.length).toBeLessThanOrEqual(500);
    });

    it('should set requiresReview flag when flagged', async () => {
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: 'GPT-4o LLaMA Claude Gemini Mistral.',
        },
        config: {},
      };

      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(['GPT-4o', 'LLaMA', 'Claude', 'Gemini', 'Mistral']);

      mockAddToReviewQueue.mockResolvedValueOnce('review-id-123');

      const result = await executePronunciation(input);

      expect(result.data.requiresReview).toBe(true);
    });

    it('should NOT set requiresReview flag when not flagged', async () => {
      const input: StageInput<PronunciationInput> = {
        pipelineId: '2026-01-22',
        previousStage: 'script-gen',
        data: {
          script: 'Simple script with few terms.',
        },
        config: {},
      };

      const { extractTerms } = await import('../extractor.js');
      vi.mocked(extractTerms).mockReturnValueOnce(['GPT', 'AI']); // Only 2 terms

      const result = await executePronunciation(input);

      expect(result.data.requiresReview).toBeFalsy();
    });
  });
});
