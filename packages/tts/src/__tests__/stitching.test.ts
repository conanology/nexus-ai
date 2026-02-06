/**
 * Unit tests for audio stitching
 * @module @nexus-ai/tts/stitching.test
 */

import { describe, it, expect } from 'vitest';
import { stitchAudio } from '../audio-quality.js';
import type { AudioSegment } from '../types.js';

/**
 * Helper to create mock WAV buffer
 *
 * Creates a minimal valid WAV file with 16-bit PCM audio.
 *
 * @param durationMs - Duration in milliseconds
 * @param sampleRate - Sample rate in Hz
 * @param numChannels - Number of channels (1 = mono, 2 = stereo). Default 2 for backward compat.
 * @returns WAV buffer
 */
function createMockWAVBuffer(
  durationMs: number,
  sampleRate: number = 44100,
  numChannels: number = 2
): Buffer {
  // Calculate PCM data size
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const bitsPerSample = 16;
  const pcmDataSize = numSamples * numChannels * (bitsPerSample / 8);

  // Create WAV header (44 bytes)
  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF header
  header.write('RIFF', offset);
  offset += 4;
  header.writeUInt32LE(36 + pcmDataSize, offset); // File size - 8
  offset += 4;
  header.write('WAVE', offset);
  offset += 4;

  // fmt chunk
  header.write('fmt ', offset);
  offset += 4;
  header.writeUInt32LE(16, offset); // fmt chunk size
  offset += 4;
  header.writeUInt16LE(1, offset); // Audio format (PCM)
  offset += 2;
  header.writeUInt16LE(numChannels, offset);
  offset += 2;
  header.writeUInt32LE(sampleRate, offset);
  offset += 4;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  header.writeUInt32LE(byteRate, offset);
  offset += 4;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  header.writeUInt16LE(blockAlign, offset);
  offset += 2;
  header.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data chunk
  header.write('data', offset);
  offset += 4;
  header.writeUInt32LE(pcmDataSize, offset);

  // Create PCM data (simple sine wave for testing)
  const bytesPerFrame = numChannels * (bitsPerSample / 8);
  const pcmData = Buffer.alloc(pcmDataSize);
  for (let i = 0; i < numSamples; i++) {
    // Generate simple sine wave
    const sample = Math.floor(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 10000);

    // Write sample for each channel
    for (let ch = 0; ch < numChannels; ch++) {
      pcmData.writeInt16LE(sample, i * bytesPerFrame + ch * 2);
    }
  }

  return Buffer.concat([header, pcmData]);
}

describe('audio stitching', () => {
  describe('stitchAudio', () => {
    it('should stitch two audio segments together', () => {
      const segment1 = createMockWAVBuffer(1000); // 1 second
      const segment2 = createMockWAVBuffer(1000); // 1 second

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment1, durationSec: 1.0 },
        { index: 1, audioBuffer: segment2, durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Verify it's a valid WAV file
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.toString('utf8', 8, 12)).toBe('WAVE');

      // Stitched audio should be larger than individual segments
      expect(stitched.length).toBeGreaterThan(segment1.length);
      expect(stitched.length).toBeGreaterThan(segment2.length);
    });

    it('should handle single segment (no stitching needed)', () => {
      const segment = createMockWAVBuffer(2000);

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment, durationSec: 2.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Should still be valid WAV
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.toString('utf8', 8, 12)).toBe('WAVE');
    });

    it('should sort segments by index before stitching', () => {
      const segment1 = createMockWAVBuffer(1000);
      const segment2 = createMockWAVBuffer(1000);
      const segment3 = createMockWAVBuffer(1000);

      // Provide segments out of order
      const segments: AudioSegment[] = [
        { index: 2, audioBuffer: segment3, durationSec: 1.0 },
        { index: 0, audioBuffer: segment1, durationSec: 1.0 },
        { index: 1, audioBuffer: segment2, durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Should complete without error and produce valid WAV
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
    });

    it('should add silence padding between segments', () => {
      const segment1 = createMockWAVBuffer(1000);
      const segment2 = createMockWAVBuffer(1000);

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment1, durationSec: 1.0 },
        { index: 1, audioBuffer: segment2, durationSec: 1.0 },
      ];

      // Stitch with 500ms silence
      const stitchedWithSilence = stitchAudio(segments, 500);

      // Stitch with no silence
      const stitchedNoSilence = stitchAudio(segments, 0);

      // Version with silence should be larger
      expect(stitchedWithSilence.length).toBeGreaterThan(
        stitchedNoSilence.length
      );
    });

    it('should handle multiple segments (>2)', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(500), durationSec: 0.5 },
        { index: 1, audioBuffer: createMockWAVBuffer(500), durationSec: 0.5 },
        { index: 2, audioBuffer: createMockWAVBuffer(500), durationSec: 0.5 },
        { index: 3, audioBuffer: createMockWAVBuffer(500), durationSec: 0.5 },
        { index: 4, audioBuffer: createMockWAVBuffer(500), durationSec: 0.5 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Should produce valid WAV
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.toString('utf8', 8, 12)).toBe('WAVE');

      // Total size should reflect all segments + silence
      expect(stitched.length).toBeGreaterThan(segments[0].audioBuffer.length * 5);
    });

    it('should normalize audio levels across segments', () => {
      // Create segments with different amplitudes
      const quietSegment = createMockWAVBuffer(1000);
      const loudSegment = createMockWAVBuffer(1000);

      // Manually adjust amplitude in loudSegment (multiply samples)
      for (let i = 44; i < loudSegment.length; i += 2) {
        const sample = loudSegment.readInt16LE(i);
        loudSegment.writeInt16LE(Math.min(32767, sample * 2), i);
      }

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: quietSegment, durationSec: 1.0 },
        { index: 1, audioBuffer: loudSegment, durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Should complete normalization without errors
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');

      // Verify no clipping occurred (no samples at max amplitude)
      let maxAmplitude = 0;
      for (let i = 44; i < stitched.length; i += 2) {
        const sample = Math.abs(stitched.readInt16LE(i));
        maxAmplitude = Math.max(maxAmplitude, sample);
      }

      // Should be normalized to 90% of max (90% of 32767 = 29490)
      expect(maxAmplitude).toBeLessThan(32767);
      expect(maxAmplitude).toBeGreaterThan(20000); // Some signal present
    });

    it('should produce WAV with correct sample rate', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(1000, 44100), durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Read sample rate from WAV header (offset 24, 4 bytes)
      const sampleRate = stitched.readUInt32LE(24);
      expect(sampleRate).toBe(44100);
    });

    it('should preserve stereo channel count (stereo input → stereo output)', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(1000, 44100, 2), durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Read number of channels from WAV header (offset 22, 2 bytes)
      const numChannels = stitched.readUInt16LE(22);
      expect(numChannels).toBe(2);
    });

    it('should preserve mono channel count (mono input → mono output)', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(1000, 44100, 1), durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      const numChannels = stitched.readUInt16LE(22);
      expect(numChannels).toBe(1);
    });

    it('should stitch mono audio segments correctly', () => {
      const segment1 = createMockWAVBuffer(1000, 44100, 1);
      const segment2 = createMockWAVBuffer(1000, 44100, 1);

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment1, durationSec: 1.0 },
        { index: 1, audioBuffer: segment2, durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Verify valid WAV
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.toString('utf8', 8, 12)).toBe('WAVE');

      // Verify mono output
      const numChannels = stitched.readUInt16LE(22);
      expect(numChannels).toBe(1);

      // Verify stitched is larger than one segment
      expect(stitched.length).toBeGreaterThan(segment1.length);
    });

    it('should add correct mono silence padding between segments', () => {
      const segment1 = createMockWAVBuffer(1000, 44100, 1);
      const segment2 = createMockWAVBuffer(1000, 44100, 1);

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment1, durationSec: 1.0 },
        { index: 1, audioBuffer: segment2, durationSec: 1.0 },
      ];

      const stitchedWithSilence = stitchAudio(segments, 500);
      const stitchedNoSilence = stitchAudio(segments, 0);

      expect(stitchedWithSilence.length).toBeGreaterThan(stitchedNoSilence.length);
    });

    it('should produce 16-bit PCM WAV', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(1000), durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // Read bits per sample from WAV header (offset 34, 2 bytes)
      const bitsPerSample = stitched.readUInt16LE(34);
      expect(bitsPerSample).toBe(16);

      // Read audio format from WAV header (offset 20, 2 bytes)
      const audioFormat = stitched.readUInt16LE(20);
      expect(audioFormat).toBe(1); // 1 = PCM
    });

    it('should handle very short segments (<100ms)', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(50), durationSec: 0.05 },
        { index: 1, audioBuffer: createMockWAVBuffer(50), durationSec: 0.05 },
      ];

      const stitched = stitchAudio(segments, 200);

      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
    });

    it('should handle very long segments (>1 minute)', () => {
      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: createMockWAVBuffer(65000), durationSec: 65.0 },
        { index: 1, audioBuffer: createMockWAVBuffer(65000), durationSec: 65.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.length).toBeGreaterThan(segments[0].audioBuffer.length * 2);
    });

    it('should not add silence after last segment', () => {
      const segment = createMockWAVBuffer(1000);

      const segments: AudioSegment[] = [
        { index: 0, audioBuffer: segment, durationSec: 1.0 },
        { index: 1, audioBuffer: segment, durationSec: 1.0 },
        { index: 2, audioBuffer: segment, durationSec: 1.0 },
      ];

      const stitched = stitchAudio(segments, 200);

      // With 3 segments, should have 2 silence gaps (not 3)
      // Calculate expected size more accurately
      const pcmPerSegment = segment.length - 44; // Subtract header
      const silenceSamples = Math.floor(0.2 * 44100); // 200ms at 44.1kHz
      const silenceBytes = silenceSamples * 2 * 2; // stereo, 16-bit

      const expectedSize = 44 + pcmPerSegment * 3 + silenceBytes * 2;

      // Allow some tolerance for rounding
      expect(Math.abs(stitched.length - expectedSize)).toBeLessThan(100);
    });
  });
});
