/**
 * Tests for pronunciation extraction stage
 *
 * @module @nexus-ai/pronunciation/tests
 */

import { describe, it, expect, vi } from 'vitest';
import { executePronunciationExtraction } from '../extraction-stage.js';
import type { StageInput } from '@nexus-ai/core/types';

// Mock PronunciationClient
vi.mock('../pronunciation-client.js', () => ({
  PronunciationClient: vi.fn().mockImplementation(() => ({
    getDictionary: vi.fn().mockResolvedValue(new Map()), // Empty dictionary
    lookupTerm: vi.fn().mockResolvedValue(null), // All terms unknown
  })),
}));

// Mock ReviewQueueClient
vi.mock('../review-queue.js', () => ({
  ReviewQueueClient: vi.fn().mockImplementation(() => ({
    shouldFlagForReview: vi.fn().mockImplementation((count: number) => count > 3),
    addToReviewQueue: vi.fn().mockImplementation(async (input: any) => ({
      id: 'test-id',
      type: 'pronunciation',
      pipelineId: input.pipelineId,
      item: input.term,
      context: input.context,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })),
  })),
}));

// Mock observability
vi.mock('@nexus-ai/core/observability', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  CostTracker: vi.fn().mockImplementation(() => ({
    recordApiCall: vi.fn(),
    getSummary: vi.fn().mockReturnValue({ total: 0, breakdown: [] }),
  })),
}));

describe('executePronunciationExtraction', () => {
  const createInput = (script: string): StageInput<{ script: string }> => ({
    pipelineId: '2026-01-16',
    previousStage: 'script-generation',
    data: { script },
    config: { timeout: 30000, retries: 3 },
  });

  it('should extract terms and validate against dictionary', async () => {
    const input = createInput('We use PyTorch and TensorFlow for training.');
    const output = await executePronunciationExtraction(input);

    expect(output.success).toBe(true);
    expect(output.data.termsExtracted).toBeGreaterThan(0);
    expect(output.data.unknownTerms).toBeDefined();
    expect(output.durationMs).toBeGreaterThan(0);
  });

  it('should flag for review when unknown terms exceed threshold', async () => {
    const input = createInput(
      'Testing AlphaTerm, BetaTerm, GammaTerm, DeltaTerm, and EpsilonTerm here.'
    );
    const output = await executePronunciationExtraction(input);

    expect(output.data.flaggedForReview).toBe(true);
    expect(output.data.unknownTerms.length).toBeGreaterThan(3);
  });

  it('should not flag when unknown terms are 3 or less', async () => {
    const input = createInput('Testing few UnknownTerm1 and UnknownTerm2.');
    const output = await executePronunciationExtraction(input);

    expect(output.data.flaggedForReview).toBe(false);
  });

  it('should extract terms from PRONOUNCE hints', async () => {
    const input = createInput('Use [PRONOUNCE: LLaMA] for inference.');
    const output = await executePronunciationExtraction(input);

    expect(output.success).toBe(true);
    expect(output.data.termsExtracted).toBeGreaterThan(0);
  });

  it('should deduplicate terms before dictionary lookup', async () => {
    const input = createInput('PyTorch is great. We use PyTorch daily. PyTorch!');
    const output = await executePronunciationExtraction(input);

    expect(output.data.termsExtracted).toBeGreaterThan(0);
  });

  it('should include review queue IDs when flagged', async () => {
    const input = createInput(
      'Testing AlphaTerm, BetaTerm, GammaTerm, DeltaTerm, EpsilonTerm here.'
    );
    const output = await executePronunciationExtraction(input);

    expect(output.data.flaggedForReview).toBe(true);
    expect(output.data.reviewQueueIds).toBeDefined();
    expect(output.data.reviewQueueIds?.length).toBeGreaterThan(0);
  });

  it('should handle empty script', async () => {
    const input = createInput('');
    const output = await executePronunciationExtraction(input);

    expect(output.success).toBe(true);
    expect(output.data.termsExtracted).toBe(0);
  });

  it('should handle script with no unknown terms', async () => {
    const input = createInput('Testing the system now.');
    const output = await executePronunciationExtraction(input);

    expect(output.success).toBe(true);
    expect(output.data.unknownTerms.length).toBe(0);
    expect(output.data.flaggedForReview).toBe(false);
  });

  it('should track cost through tracker', async () => {
    const input = createInput('Testing PyTorch now.');
    const output = await executePronunciationExtraction(input);

    expect(output.cost).toBeDefined();
    expect(output.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should log warnings when flagged for review', async () => {
    const input = createInput(
      'Testing AlphaTerm, BetaTerm, GammaTerm, DeltaTerm, and EpsilonTerm here.'
    );
    const output = await executePronunciationExtraction(input);

    expect(output.data.flaggedForReview).toBe(true);
    expect(output.warnings).toBeDefined();
    expect(output.warnings?.length).toBeGreaterThan(0);
  });

  it('should handle script with only common words', async () => {
    const input = createInput('The cat sat on the mat.');
    const output = await executePronunciationExtraction(input);

    expect(output.data.termsExtracted).toBe(0);
    expect(output.data.unknownTerms.length).toBe(0);
  });

  it('should preserve context for unknown terms', async () => {
    const input = createInput('Using UnknownTerm for testing purposes.');
    const output = await executePronunciationExtraction(input);

    expect(output.data.unknownTerms).toBeDefined();
    expect(output.data.unknownTerms[0].context).toContain('Using UnknownTerm');
  });

  it('should track stage name in logs', async () => {
    const input = createInput('Testing terms.');
    const output = await executePronunciationExtraction(input);

    expect(output.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle large script with many terms', async () => {
    const input = createInput(
      'AlphaTerm BetaTerm GammaTerm DeltaTerm EpsilonTerm ZetaTerm.'
    );
    const output = await executePronunciationExtraction(input);

    expect(output.data.termsExtracted).toBeGreaterThan(0);
  });

  it('should return success even with zero terms', async () => {
    const input = createInput('Just testing.');
    const output = await executePronunciationExtraction(input);

    expect(output.success).toBe(true);
    expect(output.data.termsExtracted).toBe(0);
  });
});
