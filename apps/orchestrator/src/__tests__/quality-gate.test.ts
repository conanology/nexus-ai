import { describe, it, expect, vi, beforeEach } from 'vitest';
import { legacyQualityGateCheck } from '../quality-gate.js';
import type { PipelineState } from '../state.js';

// Mock @nexus-ai/core to prevent review queue checks
vi.mock('@nexus-ai/core', () => ({
  hasPendingCriticalReviews: vi.fn().mockResolvedValue(false),
  getPendingCriticalReviews: vi.fn().mockResolvedValue([]),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Quality Gate', () => {
  const basePipelineState: PipelineState = {
    pipelineId: '2026-01-19',
    status: 'running',
    currentStage: 'youtube',
    startTime: new Date().toISOString(),
    stages: {},
    qualityContext: {
      degradedStages: [],
      fallbacksUsed: [],
      flags: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AUTO_PUBLISH decision', () => {
    it('should return AUTO_PUBLISH when no quality issues', async () => {
      const result = await legacyQualityGateCheck(basePipelineState);

      expect(result.decision).toBe('AUTO_PUBLISH');
      expect(result.reason).toContain('No quality issues');
      expect(result.issues).toEqual([]);
    });
  });

  describe('HUMAN_REVIEW decision', () => {
    it('should return HUMAN_REVIEW when TTS fallback used', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: [],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain('TTS fallback used');
    });

    it('should return HUMAN_REVIEW when word count issue flagged', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: ['word-count-low'],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain('Word count outside acceptable range');
    });

    it('should return HUMAN_REVIEW when both thumbnail and visual fallbacks used', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['thumbnail:template', 'visual-gen:stock'],
          flags: [],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain(
        'Both thumbnail and visual fallbacks used'
      );
    });
  });

  describe('AUTO_PUBLISH_WITH_WARNING decision', () => {
    it('should return AUTO_PUBLISH_WITH_WARNING for 1 degraded stage', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['pronunciation'],
          fallbacksUsed: [],
          flags: [],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(result.reason).toContain('Minor quality issues');
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for 2 degraded stages', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['pronunciation', 'visual-gen'],
          fallbacksUsed: [],
          flags: [],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for 2 non-critical fallbacks', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['visual-gen:stock-1', 'visual-gen:stock-2'],
          flags: [],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple flags and fallbacks', async () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['stage1', 'stage2', 'stage3'],
          fallbacksUsed: ['fb1', 'fb2', 'fb3'],
          flags: ['flag1', 'flag2'],
        },
      };

      const result = await legacyQualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.reason).toContain('Multiple quality concerns');
    });
  });
});
