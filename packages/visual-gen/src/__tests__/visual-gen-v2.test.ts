/**
 * Tests for V2 direction document support in visual-gen
 * Story 6.11: Update Pipeline Data Flow for Timestamps
 */

import { describe, it, expect } from 'vitest';
import { resolveSegmentStartSec, resolveSegmentDurationSec } from '../visual-gen.js';
import type { VisualGenInput } from '../types.js';

describe('V2 timing resolution helpers', () => {
  describe('resolveSegmentStartSec', () => {
    it('should prefer actualStartSec when both actual and estimated are present', () => {
      const timing = {
        actualStartSec: 5.2,
        estimatedStartSec: 5.0,
      };
      expect(resolveSegmentStartSec(timing)).toBe(5.2);
    });

    it('should fall back to estimatedStartSec when actualStartSec is undefined', () => {
      const timing = {
        estimatedStartSec: 5.0,
      };
      expect(resolveSegmentStartSec(timing)).toBe(5.0);
    });

    it('should return undefined when neither is present', () => {
      const timing = {};
      expect(resolveSegmentStartSec(timing)).toBeUndefined();
    });

    it('should use actualStartSec even when it is 0', () => {
      const timing = {
        actualStartSec: 0,
        estimatedStartSec: 1.0,
      };
      expect(resolveSegmentStartSec(timing)).toBe(0);
    });
  });

  describe('resolveSegmentDurationSec', () => {
    it('should prefer actualDurationSec when both are present', () => {
      const timing = {
        actualDurationSec: 10.5,
        estimatedDurationSec: 10.0,
      };
      expect(resolveSegmentDurationSec(timing)).toBe(10.5);
    });

    it('should fall back to estimatedDurationSec when actualDurationSec is undefined', () => {
      const timing = {
        estimatedDurationSec: 10.0,
      };
      expect(resolveSegmentDurationSec(timing)).toBe(10.0);
    });

    it('should return undefined when neither is present', () => {
      const timing = {};
      expect(resolveSegmentDurationSec(timing)).toBeUndefined();
    });
  });
});

describe('VisualGenInput type acceptance', () => {
  it('should accept V2 input with directionDocument', () => {
    // Type-level test: explicit VisualGenInput annotation ensures compile-time type checking
    const input: VisualGenInput = {
      script: 'Hello world [VISUAL: test]',
      audioUrl: 'gs://bucket/audio.wav',
      audioDurationSec: 120,
      directionDocument: {
        version: '2.0' as const,
        metadata: {
          title: 'Test',
          slug: 'test',
          estimatedDurationSec: 120,
          fps: 30 as const,
          resolution: { width: 1920 as const, height: 1080 as const },
          generatedAt: '2026-01-08T00:00:00Z',
        },
        segments: [],
        globalAudio: {
          defaultMood: 'neutral' as const,
          musicTransitions: 'continue' as const,
        },
      },
      wordTimings: [
        {
          word: 'Hello',
          index: 0,
          startTime: 0,
          endTime: 0.5,
          duration: 0.5,
          segmentId: 'seg-1',
          isEmphasis: false,
        },
      ],
    };

    // Verify the object shape is valid
    expect(input.directionDocument).toBeDefined();
    expect(input.directionDocument.version).toBe('2.0');
    expect(input.wordTimings).toHaveLength(1);
    expect(input.wordTimings[0].word).toBe('Hello');
  });

  it('should accept V1 input without directionDocument (backward compatible)', () => {
    const input: VisualGenInput = {
      script: 'Hello world [VISUAL: test]',
      audioUrl: 'gs://bucket/audio.wav',
      audioDurationSec: 120,
    };

    expect(input.script).toBeDefined();
    expect(input.directionDocument).toBeUndefined();
    expect(input.wordTimings).toBeUndefined();
  });
});
