/**
 * Audio quality validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  detectSilence,
  detectClipping,
  calculateAverageLoudness,
  validateDuration,
  validateAudioQuality,
} from '../audio-quality.js';

describe('Audio Quality Validation', () => {
  describe('detectSilence', () => {
    it('should detect no silence in normal audio', () => {
      // Create a buffer with normal audio (16-bit PCM)
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        // Write moderate amplitude samples (-10000 to 10000)
        buffer.writeInt16LE(Math.floor(Math.random() * 20000 - 10000), i);
      }

      const result = detectSilence(buffer, 44100);

      // Allow silence percentage to be at most 5%
      expect(result.silencePercentage).toBeLessThanOrEqual(5);
      expect(result.totalSamples).toBe(500);
    });

    it('should detect excessive silence', () => {
      // Create a buffer with mostly silence
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        // Write very low amplitude samples
        buffer.writeInt16LE(10, i);
      }

      const result = detectSilence(buffer, 44100);

      expect(result.silencePercentage).toBeGreaterThan(90);
    });
  });

  describe('detectClipping', () => {
    it('should detect no clipping in normal audio', () => {
      // Create a buffer with normal audio
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        buffer.writeInt16LE(Math.floor(Math.random() * 20000 - 10000), i);
      }

      const result = detectClipping(buffer);

      expect(result.hasClipping).toBe(false);
      expect(result.clippedSamples).toBe(0);
    });

    it('should detect clipping at maximum amplitude', () => {
      // Create a buffer with clipped audio
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        // Some samples at max amplitude
        if (i < 100) {
          buffer.writeInt16LE(32767, i); // Max amplitude
        } else {
          buffer.writeInt16LE(1000, i);
        }
      }

      const result = detectClipping(buffer);

      expect(result.hasClipping).toBe(true);
      expect(result.clippedSamples).toBeGreaterThan(0);
    });
  });

  describe('calculateAverageLoudness', () => {
    it('should calculate loudness in dB', () => {
      // Create a buffer with moderate amplitude
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        buffer.writeInt16LE(10000, i);
      }

      const loudness = calculateAverageLoudness(buffer);

      expect(loudness).toBeLessThan(0); // Loudness in dB is negative
      expect(loudness).toBeGreaterThan(-100);
    });
  });

  describe('validateDuration', () => {
    it('should validate duration within tolerance', () => {
      // 560 words at 140 words/min = 240 seconds
      const result = validateDuration(240, 560);

      expect(result.isValid).toBe(true);
      expect(result.expectedDurationSec).toBeCloseTo(240, 1);
      expect(result.differencePercent).toBeCloseTo(0, 1);
    });

    it('should validate duration at lower bound (20% tolerance)', () => {
      // 560 words at 140 words/min = 240 seconds
      // 20% tolerance = 192-288 seconds
      const result = validateDuration(192, 560);

      expect(result.isValid).toBe(true);
    });

    it('should validate duration at upper bound (20% tolerance)', () => {
      const result = validateDuration(288, 560);

      expect(result.isValid).toBe(true);
    });

    it('should reject duration outside tolerance', () => {
      // 560 words expected ~240 seconds, testing with 150 seconds (too short)
      const result = validateDuration(150, 560);

      expect(result.isValid).toBe(false);
      expect(Math.abs(result.differencePercent)).toBeGreaterThan(20);
    });

    it('should reject duration far too long', () => {
      // 560 words expected ~240 seconds, testing with 400 seconds (too long)
      const result = validateDuration(400, 560);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateAudioQuality', () => {
    it('should perform comprehensive quality check', () => {
      // Create a buffer with good quality audio
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        buffer.writeInt16LE(Math.floor(Math.random() * 20000 - 10000), i);
      }

      // For 140 words at 140 words/min, expected duration is 60 seconds
      // Testing with 10 seconds is outside the ±20% tolerance, so duration should be invalid
      const quality = validateAudioQuality(buffer, 44100, 10, 140);

      expect(quality.silencePct).toBeLessThanOrEqual(5);
      expect(quality.clippingDetected).toBe(false);
      expect(quality.averageLoudnessDb).toBeLessThan(0);
      // 10 seconds is outside tolerance for 140 words (expected 60 sec)
      expect(quality.durationValid).toBe(false);
    });

    it('should detect multiple quality issues', () => {
      // Create a buffer with silence and clipping
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        if (i < 100) {
          buffer.writeInt16LE(32767, i); // Clipping
        } else {
          buffer.writeInt16LE(10, i); // Silence
        }
      }

      const quality = validateAudioQuality(buffer, 44100, 10, 140);

      expect(quality.silencePct).toBeGreaterThan(5);
      expect(quality.clippingDetected).toBe(true);
    });

    it('should work without word count', () => {
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        buffer.writeInt16LE(10000, i);
      }

      const quality = validateAudioQuality(buffer, 44100, 10);

      expect(quality).toHaveProperty('silencePct');
      expect(quality).toHaveProperty('clippingDetected');
      expect(quality).toHaveProperty('averageLoudnessDb');
      expect(quality.durationValid).toBe(true); // Default true if no word count
    });
  });
});
