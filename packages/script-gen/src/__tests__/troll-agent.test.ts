/**
 * Troll Agent debate loop tests
 * @module @nexus-ai/script-gen/__tests__/troll-agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTrollDebate } from '../troll-agent.js';
import type { CostTracker } from '@nexus-ai/core';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track call count to differentiate troll vs writer calls
let generateCallCount = 0;

// Configurable mock responses per test
let mockTrollResponses: string[] = [];
let mockWriterResponses: string[] = [];
let trollCallIndex = 0;
let writerCallIndex = 0;

function makeTrollJson(score: number, approved: boolean, critique: string = 'Test critique', metrics?: Partial<{ hookCount: number; openLoopCount: number; longestGapSec: number }>) {
  return JSON.stringify({
    score,
    approved,
    critique,
    metrics: {
      hookCount: metrics?.hookCount ?? 3,
      openLoopCount: metrics?.openLoopCount ?? 2,
      longestGapSec: metrics?.longestGapSec ?? 10,
    },
  });
}

vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    withFallback: vi.fn(async (providers: any[], fn: (p: any) => Promise<string>) => {
      generateCallCount++;

      // Determine if this is a Troll call (odd) or Writer revision call (even)
      // Pattern: troll1, writer1, troll2, writer2, troll3
      const isTrollCall = generateCallCount % 2 === 1 || (mockWriterResponses.length === 0 && writerCallIndex >= mockWriterResponses.length);

      let text: string;
      if (isTrollCall && trollCallIndex < mockTrollResponses.length) {
        text = mockTrollResponses[trollCallIndex++];
      } else if (!isTrollCall && writerCallIndex < mockWriterResponses.length) {
        text = mockWriterResponses[writerCallIndex++];
      } else {
        text = makeTrollJson(50, false, 'Default response');
      }

      // Actually call fn with a mock provider to execute the prompt
      const mockProvider = {
        name: 'gemini-test',
        generate: vi.fn(async () => ({
          text,
          tokens: { input: 100, output: 200 },
          cost: 0.01,
          model: 'gemini-test',
        })),
      };

      const result = await fn(mockProvider);
      return {
        result,
        provider: 'gemini-test',
        tier: 'primary' as const,
        attempts: [{ provider: 'gemini-test', success: true }],
      };
    }),
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn(() => ({ totalCost: 0.05, calls: [] })),
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker(): CostTracker {
  return {
    recordApiCall: vi.fn(),
    getSummary: vi.fn(() => ({ totalCost: 0.05, calls: [] })),
  } as unknown as CostTracker;
}

function makeProviders() {
  return [
    {
      name: 'gemini-3.1-pro-preview',
      generate: vi.fn(async () => ({
        text: 'mock',
        tokens: { input: 100, output: 200 },
        cost: 0.01,
        model: 'gemini-3.1-pro-preview',
      })),
    },
  ];
}

const SAMPLE_DRAFT = `What if I told you that the most popular JavaScript framework is actually the slowest?

In this video, we're going to benchmark React, Vue, and Svelte head-to-head.

[VISUAL: Performance chart comparing frameworks]

React has dominated the front-end landscape for years. But new contenders are challenging its throne.

We'll get to why this matters for your next project in a moment.

First, let's look at the raw numbers. Svelte compiles your code to vanilla JavaScript, eliminating the virtual DOM overhead entirely.

[VISUAL: Code snippet showing Svelte compilation output]

The results might surprise you. In our benchmark, Svelte was 3x faster than React for initial render times.`;

const SAMPLE_RESEARCH = 'Research brief about JavaScript framework benchmarks including React, Vue, and Svelte performance comparisons.';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeTrollDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateCallCount = 0;
    trollCallIndex = 0;
    writerCallIndex = 0;
    mockTrollResponses = [];
    mockWriterResponses = [];
  });

  describe('approval on first round', () => {
    it('exits immediately when Troll approves on round 1', async () => {
      mockTrollResponses = [makeTrollJson(85, true, 'Great hook! Solid retention.')];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-1',
        makeProviders()
      );

      expect(result.approvedOnRound).toBe(1);
      expect(result.totalRounds).toBe(1);
      expect(result.bestScore).toBe(85);
      expect(result.bestDraft).toBe(SAMPLE_DRAFT);
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].trollApproved).toBe(true);
    });
  });

  describe('approval on round 2', () => {
    it('revises and approves on second round', async () => {
      mockTrollResponses = [
        makeTrollJson(45, false, 'Weak hook, no open loops.'),
        makeTrollJson(78, true, 'Much better! Good hooks now.'),
      ];
      mockWriterResponses = ['Revised draft with better hooks and open loops for round 2.'];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-2',
        makeProviders()
      );

      expect(result.approvedOnRound).toBe(2);
      expect(result.totalRounds).toBe(2);
      expect(result.bestScore).toBe(78);
      expect(result.rounds).toHaveLength(2);
      expect(result.rounds[0].trollApproved).toBe(false);
      expect(result.rounds[1].trollApproved).toBe(true);
    });
  });

  describe('max rounds exhausted', () => {
    it('selects highest-scoring draft after 3 rounds without approval', async () => {
      mockTrollResponses = [
        makeTrollJson(35, false, 'Boring opening.'),
        makeTrollJson(60, false, 'Better but still weak.'),  // Highest score
        makeTrollJson(55, false, 'Regression from round 2.'),
      ];
      mockWriterResponses = [
        'Revised draft for round 2.',
        'Revised draft for round 3.',
      ];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-3',
        makeProviders()
      );

      expect(result.approvedOnRound).toBeNull();
      expect(result.totalRounds).toBe(3);
      expect(result.bestScore).toBe(60); // Highest across all rounds
      expect(result.rounds).toHaveLength(3);
      expect(result.rounds.every(r => !r.trollApproved)).toBe(true);
    });
  });

  describe('score and metrics extraction', () => {
    it('correctly extracts score, critique, and metrics from Troll response', async () => {
      const trollResponse = makeTrollJson(72, true, '## Line-level critique\n\n- Line 3: boring transition\n- Line 7: needs a hook', {
        hookCount: 5,
        openLoopCount: 3,
        longestGapSec: 12,
      });
      mockTrollResponses = [trollResponse];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-4',
        makeProviders()
      );

      const round = result.rounds[0];
      expect(round.trollScore).toBe(72);
      expect(round.trollCritique).toContain('Line-level critique');
      expect(round.hookCount).toBe(5);
      expect(round.openLoopCount).toBe(3);
      expect(round.longestGapSec).toBe(12);
    });

    it('extracts JSON from markdown code fences', async () => {
      const wrappedJson = '```json\n' + makeTrollJson(80, true) + '\n```';
      mockTrollResponses = [wrappedJson];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-5',
        makeProviders()
      );

      expect(result.bestScore).toBe(80);
      expect(result.approvedOnRound).toBe(1);
    });
  });

  describe('empty or malformed critique handling', () => {
    it('handles non-JSON Troll response with default low score', async () => {
      mockTrollResponses = [
        'This script is terrible but I forgot to use JSON format.',
        makeTrollJson(75, true, 'OK now it passes.'),
      ];
      mockWriterResponses = ['Revised draft.'];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-6',
        makeProviders()
      );

      // First round should get default score (30) from failed parse
      expect(result.rounds[0].trollScore).toBe(30);
      expect(result.rounds[0].trollApproved).toBe(false);
      // Second round should succeed
      expect(result.rounds[1].trollScore).toBe(75);
    });
  });

  describe('custom options', () => {
    it('respects custom maxRounds', async () => {
      mockTrollResponses = [
        makeTrollJson(40, false, 'Bad.'),
        makeTrollJson(50, false, 'Still bad.'),
      ];
      mockWriterResponses = ['Revision.'];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-7',
        makeProviders(),
        { maxRounds: 2 }
      );

      expect(result.totalRounds).toBe(2);
      expect(result.rounds).toHaveLength(2);
    });

    it('respects custom approvalThreshold', async () => {
      mockTrollResponses = [makeTrollJson(55, false, 'Mediocre.')];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-8',
        makeProviders(),
        { approvalThreshold: 50 }
      );

      // Score 55 >= threshold 50 → approved
      expect(result.approvedOnRound).toBe(1);
      expect(result.bestScore).toBe(55);
    });
  });

  describe('debate round data integrity', () => {
    it('records word count for each round draft', async () => {
      mockTrollResponses = [makeTrollJson(80, true, 'Good.')];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-9',
        makeProviders()
      );

      expect(result.rounds[0].wordCount).toBeGreaterThan(0);
      expect(result.rounds[0].draftText).toBe(SAMPLE_DRAFT);
    });

    it('records provider info for each round', async () => {
      mockTrollResponses = [makeTrollJson(80, true, 'Good.')];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-10',
        makeProviders()
      );

      expect(result.rounds[0].provider).toBeDefined();
      expect(result.rounds[0].provider.name).toBe('gemini-test');
    });
  });

  describe('score clamping', () => {
    it('clamps score to 0-100 range', async () => {
      mockTrollResponses = [makeTrollJson(150, true, 'Impossibly good.')];

      const result = await executeTrollDebate(
        SAMPLE_DRAFT,
        SAMPLE_RESEARCH,
        makeTracker(),
        'test-pipeline-11',
        makeProviders()
      );

      expect(result.bestScore).toBe(100);
    });
  });
});
