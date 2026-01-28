import { describe, it, expect } from 'vitest';
import { calculateTechExplainerMetadata } from '../Root.js';

/**
 * Tests for calculateTechExplainerMetadata
 * Verifies dynamic duration resolution for Remotion composition
 */

const FPS = 30;

describe('calculateTechExplainerMetadata', () => {
  const makeOptions = (props: Record<string, unknown>) => ({
    defaultProps: {} as any,
    props: props as any,
    abortSignal: new AbortController().signal,
    compositionId: 'TechExplainer',
    isRendering: false,
  });

  describe('timeline with totalDurationFrames', () => {
    it('returns totalDurationFrames from timeline', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          timeline: {
            audioDurationSec: 120,
            totalDurationFrames: 3600,
            scenes: [],
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: 3600 });
    });

    it('returns totalDurationFrames even when audioDurationSec differs', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          timeline: {
            audioDurationSec: 60,
            totalDurationFrames: 2700,
            scenes: [],
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: 2700 });
    });
  });

  describe('timeline without totalDurationFrames (fallback to audioDurationSec)', () => {
    it('falls back to Math.ceil(audioDurationSec * fps)', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          timeline: {
            audioDurationSec: 120,
            scenes: [],
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: Math.ceil(120 * FPS) });
    });

    it('uses ceil for fractional durations', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          timeline: {
            audioDurationSec: 10.5,
            scenes: [],
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: Math.ceil(10.5 * FPS) });
    });

    it('ignores totalDurationFrames of 0', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          timeline: {
            audioDurationSec: 60,
            totalDurationFrames: 0,
            scenes: [],
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: Math.ceil(60 * FPS) });
    });
  });

  describe('directionDocument mode', () => {
    it('falls back to estimatedDurationSec from directionDocument metadata', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          directionDocument: {
            version: '2.0',
            metadata: {
              title: 'Test',
              slug: 'test',
              estimatedDurationSec: 180,
              fps: 30,
              resolution: { width: 1920, height: 1080 },
              generatedAt: '2026-01-28',
            },
            segments: [],
            globalAudio: { backgroundMusic: null, soundEffects: [] },
          },
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: Math.ceil(180 * FPS) });
    });
  });

  describe('default props (no timeline/directionDocument)', () => {
    it('falls back to 5-minute default (9000 frames) when no duration info', async () => {
      const result = await calculateTechExplainerMetadata(
        makeOptions({
          audioUrl: 'https://example.com/audio.mp3',
        })
      );

      expect(result).toEqual({ durationInFrames: 9000 });
    });
  });
});
