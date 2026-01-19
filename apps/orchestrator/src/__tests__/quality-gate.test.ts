import { describe, it, expect } from 'vitest';
import { qualityGateCheck } from '../quality-gate.js';
import type { PipelineState } from '../state.js';

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

  describe('AUTO_PUBLISH decision', () => {
    it('should return AUTO_PUBLISH when no quality issues', () => {
      const result = qualityGateCheck(basePipelineState);

      expect(result.decision).toBe('AUTO_PUBLISH');
      expect(result.reason).toContain('No quality issues');
      expect(result.issues).toEqual([]);
    });
  });

  describe('HUMAN_REVIEW decision', () => {
    it('should return HUMAN_REVIEW when TTS fallback used', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: [],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain('TTS fallback used');
    });

    it('should return HUMAN_REVIEW when word count issue flagged', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: ['word-count-low'],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain('Word count outside acceptable range');
    });

    it('should return HUMAN_REVIEW when both thumbnail and visual fallbacks used', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['thumbnail:template', 'visual-gen:stock'],
          flags: [],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain(
        'Both thumbnail and visual fallbacks used'
      );
    });
  });

  describe('AUTO_PUBLISH_WITH_WARNING decision', () => {
    it('should return AUTO_PUBLISH_WITH_WARNING for 1 degraded stage', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['pronunciation'],
          fallbacksUsed: [],
          flags: [],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(result.reason).toContain('Minor quality issues');
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for 2 degraded stages', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['pronunciation', 'visual-gen'],
          fallbacksUsed: [],
          flags: [],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for 2 non-critical fallbacks', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['visual-gen:stock-1', 'visual-gen:stock-2'],
          flags: [],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple flags and fallbacks', () => {
      const state: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['stage1', 'stage2', 'stage3'],
          fallbacksUsed: ['fb1', 'fb2', 'fb3'],
          flags: ['flag1', 'flag2'],
        },
      };

      const result = qualityGateCheck(state);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.reason).toContain('Multiple quality concerns');
    });
  });
});
