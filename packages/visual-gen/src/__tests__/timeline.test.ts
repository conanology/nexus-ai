/**
 * Tests for timeline generation
 */

import { describe, it, expect } from 'vitest';
import { generateTimeline, resolveSceneDuration, resolveSceneStartTime, validateTimeline } from '../timeline.js';
import type { SceneMapping, TimelineJSON } from '../types.js';
import type { DirectionSegment } from '@nexus-ai/script-gen';

/** Helper to create a minimal DirectionSegment for testing */
function makeSegment(overrides: {
  id?: string;
  index?: number;
  wordTimings?: Array<{ word: string; startTime: number; endTime: number }>;
  actualDurationSec?: number;
  actualStartSec?: number;
  estimatedDurationSec?: number;
  estimatedStartSec?: number;
}): DirectionSegment {
  const wordTimings = overrides.wordTimings?.map((wt, i) => ({
    word: wt.word,
    index: i,
    startTime: wt.startTime,
    endTime: wt.endTime,
    duration: wt.endTime - wt.startTime,
    segmentId: overrides.id ?? 'seg-0',
    isEmphasis: false,
  }));

  return {
    id: overrides.id ?? 'seg-0',
    index: overrides.index ?? 0,
    type: 'narration' as any,
    content: { script: 'test', emphasis: [] } as any,
    timing: {
      timingSource: 'extracted' as any,
      wordTimings,
      actualDurationSec: overrides.actualDurationSec,
      actualStartSec: overrides.actualStartSec,
      estimatedDurationSec: overrides.estimatedDurationSec,
      estimatedStartSec: overrides.estimatedStartSec,
    },
    visual: { component: 'test', direction: '' } as any,
    audio: {} as any,
  };
}

/** Helper to create a SceneMapping */
function makeScene(component: string, duration: number, startTime = 0): SceneMapping {
  return {
    component,
    props: { title: component },
    duration,
    startTime,
    endTime: startTime + duration,
  };
}

describe('generateTimeline', () => {
  describe('basic timeline generation', () => {
    it('should generate timeline with correct structure', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Neural network' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 30);

      expect(timeline).toHaveProperty('audioDurationSec');
      expect(timeline).toHaveProperty('scenes');
      expect(timeline.audioDurationSec).toBe(30);
      expect(timeline.scenes).toHaveLength(1);
    });

    it('should map scene properties correctly', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'DataFlowDiagram',
          props: { title: 'Data flow' },
          duration: 20,
          startTime: 0,
          endTime: 20,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 20);

      expect(timeline.scenes[0].component).toBe('DataFlowDiagram');
      expect(timeline.scenes[0].props.title).toBe('Data flow');
      expect(timeline.scenes[0].duration).toBe(20);
      expect(timeline.scenes[0].startTime).toBe(0);
    });
  });

  describe('audio duration alignment', () => {
    it('should align total timeline duration to audio duration', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
        {
          component: 'DataFlowDiagram',
          props: { title: 'Scene 2' },
          duration: 30,
          startTime: 30,
          endTime: 60,
        },
      ];

      const audioDuration = 60;
      const timeline = generateTimeline(sceneMappings, audioDuration);

      const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);
      expect(totalDuration).toBe(audioDuration);
    });

    it('should scale down scene durations when total exceeds audio duration', () => {
      // 4 scenes of 30s each = 120s total, but audio is only 90s
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
        {
          component: 'DataFlowDiagram',
          props: { title: 'Scene 2' },
          duration: 30,
          startTime: 30,
          endTime: 60,
        },
        {
          component: 'ComparisonChart',
          props: { title: 'Scene 3' },
          duration: 30,
          startTime: 60,
          endTime: 90,
        },
        {
          component: 'MetricsCounter',
          props: { title: 'Scene 4' },
          duration: 30,
          startTime: 90,
          endTime: 120,
        },
      ];

      const audioDuration = 90;
      const timeline = generateTimeline(sceneMappings, audioDuration);

      const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);

      // Total should match audio duration (within ±1 second for rounding)
      expect(Math.abs(totalDuration - audioDuration)).toBeLessThanOrEqual(1);
    });

    it('should extend last scene when total is less than audio duration', () => {
      // 2 scenes of 20s each = 40s total, but audio is 60s
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 20,
          startTime: 0,
          endTime: 20,
        },
        {
          component: 'DataFlowDiagram',
          props: { title: 'Scene 2' },
          duration: 20,
          startTime: 20,
          endTime: 40,
        },
      ];

      const audioDuration = 60;
      const timeline = generateTimeline(sceneMappings, audioDuration);

      const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);

      // Total should match audio duration
      expect(totalDuration).toBe(audioDuration);

      // Last scene should be extended
      const lastScene = timeline.scenes[timeline.scenes.length - 1];
      expect(lastScene.duration).toBeGreaterThan(20);
    });

    it('should handle 5% tolerance for audio alignment', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const audioDuration = 31; // Within 5% of 30
      const timeline = generateTimeline(sceneMappings, audioDuration);

      const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);
      const error = Math.abs(totalDuration - audioDuration) / audioDuration;

      expect(error).toBeLessThanOrEqual(0.05); // 5% tolerance
    });
  });

  describe('scene timing calculations', () => {
    it('should set sequential startTime values', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 20,
          startTime: 0,
          endTime: 20,
        },
        {
          component: 'DataFlowDiagram',
          props: { title: 'Scene 2' },
          duration: 20,
          startTime: 20,
          endTime: 40,
        },
        {
          component: 'ComparisonChart',
          props: { title: 'Scene 3' },
          duration: 20,
          startTime: 40,
          endTime: 60,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60);

      expect(timeline.scenes[0].startTime).toBe(0);
      expect(timeline.scenes[1].startTime).toBe(20);
      expect(timeline.scenes[2].startTime).toBe(40);
    });

    it('should ensure scene changes every ~30 seconds by default', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
        {
          component: 'DataFlowDiagram',
          props: { title: 'Scene 2' },
          duration: 30,
          startTime: 30,
          endTime: 60,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60);

      // Each scene should be around 30 seconds
      timeline.scenes.forEach(scene => {
        expect(scene.duration).toBeGreaterThanOrEqual(25);
        expect(scene.duration).toBeLessThanOrEqual(35);
      });
    });
  });

  describe('dynamic duration fields', () => {
    it('should calculate totalDurationFrames as audioDurationSec * default fps (30)', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60);

      expect(timeline.totalDurationFrames).toBe(Math.ceil(60 * 30));
    });

    it('should calculate totalDurationFrames with custom fps', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60, { fps: 60 });

      expect(timeline.totalDurationFrames).toBe(Math.ceil(60 * 60));
    });

    it('should have targetDuration undefined when not provided', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60);

      expect(timeline.targetDuration).toBeUndefined();
    });

    it('should pass through targetDuration when provided', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 300, { targetDuration: '5min' });

      expect(timeline.targetDuration).toBe('5min');
    });

    it('should include totalDurationFrames in empty scene timeline', () => {
      const timeline = generateTimeline([], 120);

      expect(timeline.totalDurationFrames).toBe(Math.ceil(120 * 30));
      expect(timeline.targetDuration).toBeUndefined();
      expect(timeline.scenes).toHaveLength(0);
    });

    it('should ceil totalDurationFrames for fractional results', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 10,
          startTime: 0,
          endTime: 10,
        },
      ];

      // 10.5 * 30 = 315 (exact), but 10.3 * 30 = 309 (exact)
      const timeline = generateTimeline(sceneMappings, 10.3);

      expect(timeline.totalDurationFrames).toBe(Math.ceil(10.3 * 30));
    });

    it('should serialize new fields correctly in JSON output', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 60, { targetDuration: '1min' });
      const json = JSON.parse(JSON.stringify(timeline));

      expect(json.totalDurationFrames).toBe(1800);
      expect(json.targetDuration).toBe('1min');
      expect(json.audioDurationSec).toBe(60);
      expect(json.scenes).toHaveLength(1);
    });

    it('should omit targetDuration from serialized JSON when undefined', () => {
      const timeline = generateTimeline([], 60);
      const json = JSON.parse(JSON.stringify(timeline));

      expect(json).not.toHaveProperty('targetDuration');
      expect(json.totalDurationFrames).toBe(1800);
    });

    it('should guard against zero or negative fps', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timelineZeroFps = generateTimeline(sceneMappings, 60, { fps: 0 });
      expect(timelineZeroFps.totalDurationFrames).toBe(Math.ceil(60 * 30)); // falls back to 30

      const timelineNegativeFps = generateTimeline(sceneMappings, 60, { fps: -10 });
      expect(timelineNegativeFps.totalDurationFrames).toBe(Math.ceil(60 * 30)); // falls back to 30
    });
  });

  describe('edge cases', () => {
    it('should handle single scene', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Only scene' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 45);

      expect(timeline.scenes).toHaveLength(1);
      expect(timeline.scenes[0].duration).toBe(45);
    });

    it('should handle empty scene mappings', () => {
      const sceneMappings: SceneMapping[] = [];

      const timeline = generateTimeline(sceneMappings, 60);

      expect(timeline.scenes).toHaveLength(0);
      expect(timeline.audioDurationSec).toBe(60);
    });

    it('should handle very short audio duration', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 10);

      expect(timeline.scenes[0].duration).toBe(10);
    });

    it('should handle very long audio duration', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Scene 1' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];

      const timeline = generateTimeline(sceneMappings, 300);

      expect(timeline.scenes[0].duration).toBe(300);
    });
  });

  // ===== NEW TESTS FOR STORY 6-33 =====

  describe('segment-based duration calculation (AC1)', () => {
    it('should calculate duration from word timings (first word start to last word end)', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          id: 'seg-1',
          wordTimings: [
            { word: 'Hello', startTime: 2.0, endTime: 2.5 },
            { word: 'world', startTime: 2.5, endTime: 3.0 },
            { word: 'today', startTime: 3.0, endTime: 4.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Duration should be based on word timings (4.0 - 2.0 = 2.0s) + buffers (0.5 + 0.5 = 1.0s)
      expect(timeline.scenes[0].duration).toBeCloseTo(3.0, 1);
    });

    it('should use actualDurationSec when no word timings', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          actualDurationSec: 5.0,
          actualStartSec: 1.0,
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Duration = 5.0 + entrance buffer (0.5) + exit buffer (0.5) = 6.0
      expect(timeline.scenes[0].duration).toBeCloseTo(6.0, 1);
    });

    it('should use estimatedDurationSec when no actual timings', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          estimatedDurationSec: 8.0,
          estimatedStartSec: 0.0,
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Duration = 8.0 + entrance (0.5) + exit (0.5) = 9.0
      expect(timeline.scenes[0].duration).toBeCloseTo(9.0, 1);
    });

    it('should fall back to proportional scaling when no segment timings provided', () => {
      const scenes = [
        makeScene('SceneA', 30),
        makeScene('SceneB', 30),
      ];

      // No segments option = proportional scaling
      const timeline = generateTimeline(scenes, 60);

      const totalDuration = timeline.scenes.reduce((sum, s) => sum + s.duration, 0);
      expect(totalDuration).toBe(60);
      expect(timeline.scenes[0].duration).toBe(30);
      expect(timeline.scenes[1].duration).toBe(30);
    });

    it('should fall back to proportional scaling when segments is empty', () => {
      const scenes = [makeScene('SceneA', 30)];

      const timeline = generateTimeline(scenes, 60, { segments: [] });

      expect(timeline.scenes[0].duration).toBe(60);
    });
  });

  describe('animation buffers (AC2)', () => {
    it('should apply entrance buffer shifting scene start earlier by 15 frames (0.5s)', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          wordTimings: [
            { word: 'Hello', startTime: 2.0, endTime: 2.5 },
            { word: 'world', startTime: 2.5, endTime: 3.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Entrance buffer = 15 frames / 30 fps = 0.5s
      // Segment starts at 2.0, so scene starts at 2.0 - 0.5 = 1.5
      expect(timeline.scenes[0].startTime).toBeCloseTo(1.5, 1);
    });

    it('should apply exit buffer extending scene duration by 15 frames (0.5s)', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          wordTimings: [
            { word: 'Hello', startTime: 2.0, endTime: 2.5 },
            { word: 'world', startTime: 2.5, endTime: 3.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Word duration = 3.0 - 2.0 = 1.0s
      // Total with buffers = 1.0 + 0.5 (entrance) + 0.5 (exit) = 2.0s
      expect(timeline.scenes[0].duration).toBeCloseTo(2.0, 1);
    });

    it('should clamp scene start time to 0 when entrance buffer would go negative', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          wordTimings: [
            { word: 'Hello', startTime: 0.2, endTime: 0.5 },
            { word: 'world', startTime: 0.5, endTime: 1.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Segment starts at 0.2, minus 0.5 buffer = -0.3, clamped to 0
      expect(timeline.scenes[0].startTime).toBe(0);
    });

    it('should only apply buffers when segment timings are available', () => {
      const scenes = [makeScene('SceneA', 30)];

      // No segments = proportional, no buffers
      const timeline = generateTimeline(scenes, 60);

      expect(timeline.scenes[0].startTime).toBe(0);
      expect(timeline.scenes[0].duration).toBe(60);
    });
  });

  describe('scene overlap handling (AC3)', () => {
    it('should allow adjacent scene overlap within 30-frame limit', () => {
      const scenes = [
        makeScene('SceneA', 30),
        makeScene('SceneB', 30),
      ];
      const segments = [
        makeSegment({
          id: 'seg-0',
          wordTimings: [
            { word: 'First', startTime: 0.0, endTime: 1.0 },
            { word: 'scene', startTime: 1.0, endTime: 2.0 },
          ],
        }),
        makeSegment({
          id: 'seg-1',
          index: 1,
          wordTimings: [
            { word: 'Second', startTime: 2.5, endTime: 3.0 },
            { word: 'scene', startTime: 3.0, endTime: 4.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Scene A: starts at max(0, 0 - 0.5) = 0, duration = 2.0 + 1.0 = 3.0, ends at 3.0
      // Scene B: starts at max(0, 2.5 - 0.5) = 2.0, so overlap = 3.0 - 2.0 = 1.0s = 30 frames at 30fps
      // This is exactly at the limit
      expect(timeline.scenes).toHaveLength(2);

      const sceneAEnd = timeline.scenes[0].startTime + timeline.scenes[0].duration;
      const sceneBStart = timeline.scenes[1].startTime;
      const overlapSec = sceneAEnd - sceneBStart;
      const overlapFrames = Math.round(overlapSec * 30);

      expect(overlapFrames).toBeLessThanOrEqual(30);
    });
  });

  describe('timeline validation (AC4)', () => {
    it('should pass validation for a valid timeline', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [
          { component: 'A', props: {}, startTime: 0, duration: 30 },
          { component: 'B', props: {}, startTime: 30, duration: 30 },
        ],
      };

      const result = validateTimeline(timeline, 60, 30);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when total coverage differs from audio duration by more than 1s', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [
          { component: 'A', props: {}, startTime: 0, duration: 25 },
          { component: 'B', props: {}, startTime: 25, duration: 30 },
        ],
      };

      // Total coverage = 25 + 30 = 55, diff from 60 = 5 > 1s
      const result = validateTimeline(timeline, 60, 30);

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('differs from audio duration'))).toBe(true);
    });

    it('should warn on gaps between scenes', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [
          { component: 'A', props: {}, startTime: 0, duration: 25 },
          { component: 'B', props: {}, startTime: 30, duration: 30 }, // 5s gap
        ],
      };

      const result = validateTimeline(timeline, 60, 30);

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('Gap'))).toBe(true);
    });

    it('should warn on excessive overlap (>30 frames)', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [
          { component: 'A', props: {}, startTime: 0, duration: 35 },
          { component: 'B', props: {}, startTime: 33, duration: 27 }, // 2s overlap = 60 frames
        ],
      };

      const result = validateTimeline(timeline, 60, 30);

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('Excessive overlap'))).toBe(true);
    });

    it('should accept overlap within 30-frame limit', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [
          { component: 'A', props: {}, startTime: 0, duration: 30.5 },
          { component: 'B', props: {}, startTime: 30, duration: 30 }, // 0.5s overlap = 15 frames
        ],
      };

      const result = validateTimeline(timeline, 60, 30);

      // Overlap is 15 frames, within 30 limit - no overlap warning
      expect(result.warnings.some((w) => w.includes('Excessive overlap'))).toBe(false);
    });

    it('should pass validation for empty timeline', () => {
      const timeline: TimelineJSON = {
        audioDurationSec: 60,
        totalDurationFrames: 1800,
        scenes: [],
      };

      const result = validateTimeline(timeline, 60, 30);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('backward compatibility (AC5)', () => {
    it('should use proportional scaling when no segments provided', () => {
      const scenes = [
        makeScene('SceneA', 20),
        makeScene('SceneB', 40),
      ];

      const timeline = generateTimeline(scenes, 60);

      const totalDuration = timeline.scenes.reduce((sum, s) => sum + s.duration, 0);
      expect(totalDuration).toBe(60);
      // SceneA should be ~20s, SceneB ~40s (proportional to 20:40 ratio)
      expect(timeline.scenes[0].duration).toBe(20);
      expect(timeline.scenes[1].duration).toBe(40);
    });

    it('should still work with original 2-arg call signature', () => {
      const scenes = [makeScene('SceneA', 30)];
      const timeline = generateTimeline(scenes, 30);

      expect(timeline.audioDurationSec).toBe(30);
      expect(timeline.scenes).toHaveLength(1);
      expect(timeline.scenes[0].duration).toBe(30);
    });

    it('should fall back to proportional when all segments lack timing data', () => {
      const scenes = [
        makeScene('SceneA', 30),
        makeScene('SceneB', 30),
      ];
      // Segments with no timing data at all
      const segments = [
        makeSegment({ id: 'seg-0' }),
        makeSegment({ id: 'seg-1', index: 1 }),
      ];
      // Remove all timing data
      segments[0].timing = { timingSource: 'estimated' as any };
      segments[1].timing = { timingSource: 'estimated' as any };

      const timeline = generateTimeline(scenes, 60, { segments });

      const totalDuration = timeline.scenes.reduce((sum, s) => sum + s.duration, 0);
      expect(totalDuration).toBe(60);
      // Should use proportional scaling
      expect(timeline.scenes[0].duration).toBe(30);
      expect(timeline.scenes[1].duration).toBe(30);
    });
  });

  describe('segment edge cases', () => {
    it('should handle single segment with word timings', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          wordTimings: [
            { word: 'Only', startTime: 1.0, endTime: 2.0 },
          ],
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Duration from word: 2.0 - 1.0 = 1.0s + buffers 1.0s = 2.0s
      expect(timeline.scenes).toHaveLength(1);
      expect(timeline.scenes[0].duration).toBeCloseTo(2.0, 1);
      // Start = 1.0 - 0.5 = 0.5
      expect(timeline.scenes[0].startTime).toBeCloseTo(0.5, 1);
    });

    it('should handle empty word timings array (falls back to actualDurationSec)', () => {
      const scenes = [makeScene('SceneA', 30)];
      const segments = [
        makeSegment({
          wordTimings: [], // empty array
          actualDurationSec: 5.0,
          actualStartSec: 2.0,
        }),
      ];
      // Fix: empty wordTimings array means the makeSegment helper sets it - override
      segments[0].timing.wordTimings = [];

      const timeline = generateTimeline(scenes, 60, { segments });

      // Should fall back to actualDurationSec = 5.0 + buffers = 6.0
      expect(timeline.scenes[0].duration).toBeCloseTo(6.0, 1);
    });

    it('should handle mixed timing sources across segments', () => {
      const scenes = [
        makeScene('SceneA', 30),
        makeScene('SceneB', 30),
        makeScene('SceneC', 30),
      ];
      const segments = [
        // Segment 0: word timings
        makeSegment({
          id: 'seg-0',
          wordTimings: [
            { word: 'First', startTime: 0.0, endTime: 1.0 },
            { word: 'words', startTime: 1.0, endTime: 2.0 },
          ],
        }),
        // Segment 1: actualDurationSec only
        makeSegment({
          id: 'seg-1',
          index: 1,
          actualDurationSec: 3.0,
          actualStartSec: 5.0,
        }),
        // Segment 2: estimatedDurationSec only
        makeSegment({
          id: 'seg-2',
          index: 2,
          estimatedDurationSec: 4.0,
          estimatedStartSec: 10.0,
        }),
      ];

      const timeline = generateTimeline(scenes, 60, { segments });

      expect(timeline.scenes).toHaveLength(3);
      // Each scene should have a duration > 0
      timeline.scenes.forEach((scene) => {
        expect(scene.duration).toBeGreaterThan(0);
      });
    });
  });
});

describe('resolveSceneDuration', () => {
  it('should return word-timing based duration when available', () => {
    const segment = makeSegment({
      wordTimings: [
        { word: 'Hello', startTime: 1.0, endTime: 1.5 },
        { word: 'world', startTime: 1.5, endTime: 2.5 },
      ],
      actualDurationSec: 5.0,
      estimatedDurationSec: 8.0,
    });

    expect(resolveSceneDuration(segment)).toBeCloseTo(1.5, 5);
  });

  it('should return actualDurationSec when no word timings', () => {
    const segment = makeSegment({
      actualDurationSec: 5.0,
      estimatedDurationSec: 8.0,
    });

    expect(resolveSceneDuration(segment)).toBe(5.0);
  });

  it('should return estimatedDurationSec when no actual timings', () => {
    const segment = makeSegment({
      estimatedDurationSec: 8.0,
    });

    expect(resolveSceneDuration(segment)).toBe(8.0);
  });

  it('should return undefined when no timing data', () => {
    const segment = makeSegment({});
    segment.timing = { timingSource: 'estimated' as any };

    expect(resolveSceneDuration(segment)).toBeUndefined();
  });
});

describe('resolveSceneStartTime', () => {
  it('should return first word start time when word timings available', () => {
    const segment = makeSegment({
      wordTimings: [
        { word: 'Hello', startTime: 2.5, endTime: 3.0 },
      ],
      actualStartSec: 1.0,
    });

    expect(resolveSceneStartTime(segment)).toBe(2.5);
  });

  it('should return actualStartSec when no word timings', () => {
    const segment = makeSegment({
      actualStartSec: 3.0,
      estimatedStartSec: 5.0,
    });

    expect(resolveSceneStartTime(segment)).toBe(3.0);
  });

  it('should return estimatedStartSec when no actual start', () => {
    const segment = makeSegment({
      estimatedStartSec: 5.0,
    });

    expect(resolveSceneStartTime(segment)).toBe(5.0);
  });

  it('should return undefined when no timing data', () => {
    const segment = makeSegment({});
    segment.timing = { timingSource: 'estimated' as any };

    expect(resolveSceneStartTime(segment)).toBeUndefined();
  });
});
