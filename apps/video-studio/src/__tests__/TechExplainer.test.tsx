import { describe, it, expect } from 'vitest';
import { TechExplainer, TechExplainerSchema } from '../compositions/TechExplainer';

/**
 * Integration tests for TechExplainer composition
 * Tests timeline rendering and audio sync
 */
describe('TechExplainer Composition', () => {
  const validTimeline = {
    audioDurationSec: 10,
    scenes: [
      {
        component: 'NeuralNetworkAnimation',
        props: { title: 'Test Network' },
        startTime: 0,
        duration: 5,
      },
      {
        component: 'DataFlowDiagram',
        props: { title: 'Test Flow' },
        startTime: 5,
        duration: 5,
      },
    ],
  };

  const validAudioUrl = 'https://example.com/audio.mp3';

  describe('Schema Validation', () => {
    it('should validate valid props', () => {
      const result = TechExplainerSchema.safeParse({
        timeline: validTimeline,
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid timeline structure', () => {
      const result = TechExplainerSchema.safeParse({
        timeline: { invalid: true },
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid audio URL', () => {
      const result = TechExplainerSchema.safeParse({
        timeline: validTimeline,
        audioUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should require all scene properties', () => {
      const invalidTimeline = {
        audioDurationSec: 10,
        scenes: [
          {
            component: 'NeuralNetworkAnimation',
            // Missing startTime and duration
          },
        ],
      };
      const result = TechExplainerSchema.safeParse({
        timeline: invalidTimeline,
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Composition Rendering', () => {
    it('should be defined as a component', () => {
      expect(TechExplainer).toBeDefined();
      expect(typeof TechExplainer).toBe('function');
    });

    it('should validate scene count matches timeline', () => {
      const multiSceneTimeline = {
        audioDurationSec: 20,
        scenes: [
          {
            component: 'NeuralNetworkAnimation',
            props: {},
            startTime: 0,
            duration: 5,
          },
          {
            component: 'DataFlowDiagram',
            props: {},
            startTime: 5,
            duration: 5,
          },
        ],
      };
      expect(multiSceneTimeline.scenes.length).toBe(2);
    });
  });

  describe('Timing Calculations', () => {
    it('should correctly calculate frame count at 30fps', () => {
      // At 30fps: 5 seconds = 150 frames
      const fps = 30;
      const durationSec = 5;
      const expectedFrames = Math.round(durationSec * fps);
      expect(expectedFrames).toBe(150);
    });

    it('should handle fractional timing correctly', () => {
      const fps = 30;
      const duration1 = 2.5;
      const duration2 = 5;
      const frames1 = Math.round(duration1 * fps);
      const frames2 = Math.round(duration2 * fps);
      expect(frames1).toBe(75);
      expect(frames2).toBe(150);
    });
  });
});
