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
  stitchAudio,
} from '../audio-quality.js';

describe('Audio Quality Validation', () => {
  describe('detectSilence', () => {
    it('should detect no silence in normal audio', () => {
      // Create a buffer with normal audio (16-bit PCM)
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < buffer.length; i += 2) {
        // Write moderate amplitude samples (-10000 to 10000)
        buffer.writeInt16LE(i % 4 === 0 ? 12000 : -12000, i);
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
        buffer.writeInt16LE(i % 4 === 0 ? 12000 : -12000, i);
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
        buffer.writeInt16LE(i % 4 === 0 ? 12000 : -12000, i);
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

  describe('stitchAudio - sample rate handling', () => {
    /** Helper: create a minimal WAV buffer with the given sample rate */
    function createWavBuffer(sampleRate: number, numChannels: number = 1, durationMs: number = 100): Buffer {
      const bitsPerSample = 16;
      const numSamples = Math.floor((durationMs / 1000) * sampleRate);
      const dataSize = numSamples * numChannels * (bitsPerSample / 8);
      const header = Buffer.alloc(44);
      let offset = 0;

      header.write('RIFF', offset); offset += 4;
      header.writeUInt32LE(36 + dataSize, offset); offset += 4;
      header.write('WAVE', offset); offset += 4;
      header.write('fmt ', offset); offset += 4;
      header.writeUInt32LE(16, offset); offset += 4;
      header.writeUInt16LE(1, offset); offset += 2; // PCM
      header.writeUInt16LE(numChannels, offset); offset += 2;
      header.writeUInt32LE(sampleRate, offset); offset += 4;
      header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); offset += 4;
      header.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;
      header.writeUInt16LE(bitsPerSample, offset); offset += 2;
      header.write('data', offset); offset += 4;
      header.writeUInt32LE(dataSize, offset);

      // Generate PCM data with moderate amplitude
      const pcm = Buffer.alloc(dataSize);
      for (let i = 0; i < dataSize; i += 2) {
        pcm.writeInt16LE(Math.floor(Math.sin(i * 0.1) * 5000), i);
      }

      return Buffer.concat([header, pcm]);
    }

    it('should extract and use actual sample rate from WAV segments (24000 Hz)', () => {
      const seg1 = createWavBuffer(24000);
      const seg2 = createWavBuffer(24000);

      const result = stitchAudio(
        [
          { index: 0, audioBuffer: seg1, durationSec: 0.1 },
          { index: 1, audioBuffer: seg2, durationSec: 0.1 },
        ],
        100
      );

      // The output WAV header should declare 24000 Hz, not 44100
      expect(result.length).toBeGreaterThan(44);
      const outputSampleRate = result.readUInt32LE(24);
      expect(outputSampleRate).toBe(24000);
    });

    it('should use 44100 Hz when segments are 44100 Hz', () => {
      const seg1 = createWavBuffer(44100);
      const seg2 = createWavBuffer(44100);

      const result = stitchAudio(
        [
          { index: 0, audioBuffer: seg1, durationSec: 0.1 },
          { index: 1, audioBuffer: seg2, durationSec: 0.1 },
        ],
        100
      );

      const outputSampleRate = result.readUInt32LE(24);
      expect(outputSampleRate).toBe(44100);
    });

    it('should warn but still produce output for mixed sample rates', () => {
      const seg1 = createWavBuffer(24000);
      const seg2 = createWavBuffer(44100);

      const result = stitchAudio(
        [
          { index: 0, audioBuffer: seg1, durationSec: 0.1 },
          { index: 1, audioBuffer: seg2, durationSec: 0.1 },
        ],
        100
      );

      // Uses first segment's rate
      const outputSampleRate = result.readUInt32LE(24);
      expect(outputSampleRate).toBe(24000);
      expect(result.length).toBeGreaterThan(44);
    });
  });
});
