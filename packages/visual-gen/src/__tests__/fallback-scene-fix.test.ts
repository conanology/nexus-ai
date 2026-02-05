/**
 * Tests for fallback scene generation fix
 * Verifies that empty visual cues don't result in black screen videos
 */

import { describe, it, expect } from 'vitest';
import { generateTimeline } from '../timeline.js';
import type { SceneMapping } from '../types.js';

describe('Fallback Scene Generation Fix', () => {
  describe('generateTimeline with empty sceneMappings', () => {
    it('should return a fallback TextOnGradient scene when sceneMappings is empty', () => {
      const sceneMappings: SceneMapping[] = [];
      const audioDurationSec = 120;

      const timeline = generateTimeline(sceneMappings, audioDurationSec);

      // Should have exactly 1 fallback scene
      expect(timeline.scenes).toHaveLength(1);

      // Should be a TextOnGradient component
      expect(timeline.scenes[0].component).toBe('TextOnGradient');

      // Should cover the entire audio duration
      expect(timeline.scenes[0].startTime).toBe(0);
      expect(timeline.scenes[0].duration).toBe(audioDurationSec);

      // Should have proper props
      expect(timeline.scenes[0].props.text).toBe('Video Content');
    });

    it('should prevent black screen by always having at least one scene', () => {
      // This test verifies the fix for the black screen issue
      // Previously, empty sceneMappings would result in scenes: []
      // which caused a black screen video

      const sceneMappings: SceneMapping[] = [];
      const audioDurationSec = 300; // 5 minutes

      const timeline = generateTimeline(sceneMappings, audioDurationSec);

      // Key assertion: scenes should NEVER be empty
      expect(timeline.scenes.length).toBeGreaterThan(0);

      // Total scene coverage should match audio duration
      const totalCoverage = timeline.scenes.reduce(
        (sum, scene) => sum + scene.duration,
        0
      );
      expect(totalCoverage).toBe(audioDurationSec);
    });

    it('should maintain audioDurationSec and totalDurationFrames correctly', () => {
      const sceneMappings: SceneMapping[] = [];
      const audioDurationSec = 60;

      const timeline = generateTimeline(sceneMappings, audioDurationSec, { fps: 30 });

      expect(timeline.audioDurationSec).toBe(60);
      expect(timeline.totalDurationFrames).toBe(Math.ceil(60 * 30));
    });
  });

  describe('generateTimeline with valid sceneMappings', () => {
    it('should use provided sceneMappings instead of fallback', () => {
      const sceneMappings: SceneMapping[] = [
        {
          component: 'NeuralNetworkAnimation',
          props: { title: 'Test Scene' },
          duration: 30,
          startTime: 0,
          endTime: 30,
        },
      ];
      const audioDurationSec = 30;

      const timeline = generateTimeline(sceneMappings, audioDurationSec);

      // Should use the provided scene, not fallback
      expect(timeline.scenes).toHaveLength(1);
      expect(timeline.scenes[0].component).toBe('NeuralNetworkAnimation');
    });
  });
});
