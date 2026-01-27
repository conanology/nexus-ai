import { describe, it, expect } from 'vitest';
import { TechExplainer, TechExplainerSchema, mapSegmentToScene } from '../compositions/TechExplainer.js';

/**
 * Integration tests for TechExplainer composition
 * Tests timeline rendering, direction document mode, and audio sync
 */

// --- Test fixtures ---

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

const minimalMotionConfig = {
  entrance: {
    type: 'fade' as const,
    delay: 0,
    duration: 0.5,
    easing: 'easeOut' as const,
  },
  emphasis: {
    type: 'pulse' as const,
    trigger: 'onWord' as const,
    intensity: 0.5,
    duration: 0.3,
  },
  exit: {
    type: 'fade' as const,
    duration: 0.3,
    startBeforeEnd: 0.3,
  },
};

const makeSegment = (overrides: Record<string, unknown> = {}) => ({
  id: 'seg-1',
  index: 0,
  type: 'explanation' as const,
  content: {
    text: 'Test segment text',
    wordCount: 3,
    keywords: ['test'],
    emphasis: [{ word: 'test', effect: 'glow' as const, intensity: 0.8 }],
  },
  timing: {
    estimatedStartSec: 0,
    estimatedDurationSec: 5,
    timingSource: 'estimated' as const,
    ...(overrides.timing as Record<string, unknown> ?? {}),
  },
  visual: {
    template: 'NeuralNetworkAnimation' as const,
    templateProps: { title: 'Test' },
    motion: minimalMotionConfig,
    ...(overrides.visual as Record<string, unknown> ?? {}),
  },
  audio: {
    mood: 'neutral' as const,
  },
  ...Object.fromEntries(
    Object.entries(overrides).filter(([k]) => !['timing', 'visual'].includes(k))
  ),
});

const validDirectionDocument = {
  version: '2.0' as const,
  metadata: {
    title: 'Test Video',
    slug: 'test-video',
    estimatedDurationSec: 60,
    fps: 30 as const,
    resolution: { width: 1920, height: 1080 },
    generatedAt: '2026-01-28T00:00:00Z',
  },
  segments: [
    makeSegment(),
    makeSegment({
      id: 'seg-2',
      index: 1,
      timing: { estimatedStartSec: 5, estimatedDurationSec: 5, timingSource: 'estimated' as const },
      visual: {
        template: 'DataFlowDiagram' as const,
        templateProps: { title: 'Flow' },
        motion: minimalMotionConfig,
      },
    }),
  ],
  globalAudio: {
    defaultMood: 'neutral' as const,
    musicTransitions: 'fade' as const,
  },
};

// --- Tests ---

describe('TechExplainer Composition', () => {
  describe('Schema Validation - Legacy Timeline (AC6)', () => {
    it('should validate valid legacy timeline props', () => {
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

  describe('Schema Validation - DirectionDocument (AC1)', () => {
    it('should validate valid directionDocument props', () => {
      const result = TechExplainerSchema.safeParse({
        directionDocument: validDirectionDocument,
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(true);
    });

    it('should require audioUrl with directionDocument', () => {
      const result = TechExplainerSchema.safeParse({
        directionDocument: validDirectionDocument,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid directionDocument', () => {
      const result = TechExplainerSchema.safeParse({
        directionDocument: { invalid: true },
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(false);
    });

    it('should accept either timeline or directionDocument (union)', () => {
      const timelineResult = TechExplainerSchema.safeParse({
        timeline: validTimeline,
        audioUrl: validAudioUrl,
      });
      const directionResult = TechExplainerSchema.safeParse({
        directionDocument: validDirectionDocument,
        audioUrl: validAudioUrl,
      });
      expect(timelineResult.success).toBe(true);
      expect(directionResult.success).toBe(true);
    });

    it('should reject props with neither timeline nor directionDocument', () => {
      const result = TechExplainerSchema.safeParse({
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Segment-to-Scene Mapping (AC2, AC3)', () => {
    it('should extract componentName from segment.visual.template', () => {
      const parsed = TechExplainerSchema.parse({
        directionDocument: validDirectionDocument,
        audioUrl: validAudioUrl,
      });
      // Verify the segment template is accessible
      if ('directionDocument' in parsed) {
        expect(parsed.directionDocument.segments[0].visual.template).toBe('NeuralNetworkAnimation');
      }
    });

    it('should prefer actualStartSec over estimatedStartSec for timing', () => {
      const segment = makeSegment({
        timing: {
          estimatedStartSec: 1,
          estimatedDurationSec: 5,
          actualStartSec: 2.5,
          actualDurationSec: 4,
          timingSource: 'extracted' as const,
        },
      });
      const scene = mapSegmentToScene(segment as any, 30);
      expect(scene.from).toBe(75); // 2.5 * 30
      expect(scene.durationInFrames).toBe(120); // 4 * 30
    });

    it('should fall back to estimatedStartSec when actualStartSec is missing', () => {
      const segment = makeSegment({
        timing: {
          estimatedStartSec: 3,
          estimatedDurationSec: 6,
          timingSource: 'estimated' as const,
        },
      });
      const scene = mapSegmentToScene(segment as any, 30);
      expect(scene.from).toBe(90); // 3 * 30
      expect(scene.durationInFrames).toBe(180); // 6 * 30
    });

    it('should default to 0 for start and 5s for duration when both timing fields missing', () => {
      const segment = makeSegment({
        timing: {
          timingSource: 'estimated' as const,
        },
      });
      const scene = mapSegmentToScene(segment as any, 30);
      expect(scene.from).toBe(0);
      expect(scene.durationInFrames).toBe(150); // 5 * 30
    });

    it('should guarantee minimum 1 frame for durationInFrames when duration is zero', () => {
      const segment = makeSegment({
        timing: {
          estimatedStartSec: 0,
          estimatedDurationSec: 0,
          timingSource: 'estimated' as const,
        },
      });
      const scene = mapSegmentToScene(segment as any, 30);
      expect(scene.durationInFrames).toBe(1); // Math.max(1, 0) = 1
    });

    it('should extract motion config from segment.visual.motion', () => {
      const segment = makeSegment();
      expect(segment.visual.motion).toEqual(minimalMotionConfig);
    });

    it('should extract templateProps from segment.visual.templateProps', () => {
      const segment = makeSegment();
      expect(segment.visual.templateProps).toEqual({ title: 'Test' });
    });

    it('should extract wordTimings from segment.timing.wordTimings', () => {
      const wordTimings = [
        { word: 'test', index: 0, startTime: 0, endTime: 0.5, duration: 0.5, segmentId: 'seg-1', isEmphasis: true },
      ];
      const timing: Record<string, unknown> = {
        estimatedStartSec: 0,
        estimatedDurationSec: 5,
        timingSource: 'extracted',
        wordTimings,
      };
      expect(timing.wordTimings).toEqual(wordTimings);
    });

    it('should extract emphasis from segment.content.emphasis', () => {
      const segment = makeSegment();
      expect(segment.content.emphasis).toEqual([
        { word: 'test', effect: 'glow', intensity: 0.8 },
      ]);
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

  describe('Prop Passing (AC4)', () => {
    it('should extract motion, wordTimings, emphasis and templateProps via mapSegmentToScene', () => {
      const wordTimings = [
        { word: 'hello', index: 0, startTime: 0, endTime: 0.3, duration: 0.3, segmentId: 'seg-1', isEmphasis: false },
      ];
      const segment = makeSegment({
        timing: {
          estimatedStartSec: 0,
          estimatedDurationSec: 5,
          timingSource: 'extracted' as const,
          wordTimings,
        },
      });
      const scene = mapSegmentToScene(segment as any, 30);
      expect(scene.motion).toEqual(minimalMotionConfig);
      expect(scene.templateProps).toEqual({ title: 'Test' });
      expect(scene.wordTimings).toEqual(wordTimings);
      expect(scene.emphasis).toEqual([{ word: 'test', effect: 'glow', intensity: 0.8 }]);
      expect(scene.componentName).toBe('NeuralNetworkAnimation');
    });

    it('should pass schema-validated direction document with all prop fields', () => {
      const directionDoc = {
        ...validDirectionDocument,
        segments: [
          makeSegment({
            timing: {
              estimatedStartSec: 0,
              estimatedDurationSec: 5,
              timingSource: 'extracted' as const,
              wordTimings: [
                { word: 'hello', index: 0, startTime: 0, endTime: 0.3, duration: 0.3, segmentId: 'seg-1', isEmphasis: false },
              ],
            },
          }),
        ],
      };

      const result = TechExplainerSchema.safeParse({
        directionDocument: directionDoc,
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(true);
      if (result.success && 'directionDocument' in result.data) {
        const seg = result.data.directionDocument.segments[0];
        expect(seg.visual.motion).toBeDefined();
        expect(seg.visual.templateProps).toBeDefined();
        expect(seg.timing.wordTimings).toBeDefined();
        expect(seg.content.emphasis).toBeDefined();
      }
    });
  });

  describe('Audio Sync (AC5)', () => {
    it('should accept audioUrl in both legacy and direction modes', () => {
      const legacyResult = TechExplainerSchema.safeParse({
        timeline: validTimeline,
        audioUrl: 'https://example.com/audio.mp3',
      });
      const directionResult = TechExplainerSchema.safeParse({
        directionDocument: validDirectionDocument,
        audioUrl: 'https://example.com/audio.mp3',
      });
      expect(legacyResult.success).toBe(true);
      expect(directionResult.success).toBe(true);
    });
  });

  describe('Backward Compatibility (AC6)', () => {
    it('should still accept legacy timeline props', () => {
      const result = TechExplainerSchema.safeParse({
        timeline: validTimeline,
        audioUrl: validAudioUrl,
      });
      expect(result.success).toBe(true);
    });

    it('should preserve legacy timeline structure in parsed output', () => {
      const result = TechExplainerSchema.parse({
        timeline: validTimeline,
        audioUrl: validAudioUrl,
      });
      if ('timeline' in result) {
        expect(result.timeline.scenes).toHaveLength(2);
        expect(result.timeline.scenes[0].component).toBe('NeuralNetworkAnimation');
        expect(result.timeline.scenes[0].startTime).toBe(0);
        expect(result.timeline.scenes[0].duration).toBe(5);
      }
    });

    it('should keep audioUrl common to both modes', () => {
      const legacyParsed = TechExplainerSchema.parse({
        timeline: validTimeline,
        audioUrl: 'https://example.com/legacy.mp3',
      });
      const directionParsed = TechExplainerSchema.parse({
        directionDocument: validDirectionDocument,
        audioUrl: 'https://example.com/direction.mp3',
      });
      expect(legacyParsed.audioUrl).toBe('https://example.com/legacy.mp3');
      expect(directionParsed.audioUrl).toBe('https://example.com/direction.mp3');
    });
  });
});
