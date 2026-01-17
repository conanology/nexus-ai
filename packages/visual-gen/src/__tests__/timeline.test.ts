/**
 * Tests for timeline generation
 */

import { describe, it, expect } from 'vitest';
import { generateTimeline } from '../timeline.js';
import type { SceneMapping } from '../types.js';

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
});
