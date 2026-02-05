/**
 * Tests for WAV header parsing utilities
 */

import { describe, it, expect } from 'vitest';
import { parseWavHeader, calculateWavDuration, getWavDuration } from '../wav-utils.js';

describe('wav-utils', () => {
  /**
   * Create a valid WAV header buffer for testing.
   * WAV format:
   * - RIFF header (12 bytes)
   * - fmt chunk (24 bytes for PCM)
   * - data chunk header (8 bytes) + data
   */
  function createWavBuffer(options: {
    sampleRate?: number;
    numChannels?: number;
    bitsPerSample?: number;
    dataSize?: number;
  } = {}): Buffer {
    const {
      sampleRate = 44100,
      numChannels = 1,
      bitsPerSample = 16,
      dataSize = 88200, // 1 second of mono 16-bit 44.1kHz audio
    } = options;

    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const fileSize = 36 + dataSize; // RIFF size = file size - 8

    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // PCM fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // Audio format (1 = PCM)
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Fill with silence (zeros) - already done by Buffer.alloc

    return buffer;
  }

  describe('parseWavHeader', () => {
    it('should parse a valid mono 16-bit WAV header', () => {
      const buffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 1,
        bitsPerSample: 16,
        dataSize: 88200,
      });

      const info = parseWavHeader(buffer);

      expect(info.sampleRate).toBe(44100);
      expect(info.numChannels).toBe(1);
      expect(info.bitsPerSample).toBe(16);
      expect(info.dataOffset).toBe(44);
      expect(info.dataSize).toBe(88200);
    });

    it('should parse a valid stereo 16-bit WAV header', () => {
      const buffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 2,
        bitsPerSample: 16,
        dataSize: 176400, // 1 second of stereo
      });

      const info = parseWavHeader(buffer);

      expect(info.sampleRate).toBe(44100);
      expect(info.numChannels).toBe(2);
      expect(info.bitsPerSample).toBe(16);
      expect(info.dataSize).toBe(176400);
    });

    it('should parse a 24-bit WAV header', () => {
      const buffer = createWavBuffer({
        sampleRate: 48000,
        numChannels: 1,
        bitsPerSample: 24,
        dataSize: 144000, // 1 second
      });

      const info = parseWavHeader(buffer);

      expect(info.sampleRate).toBe(48000);
      expect(info.numChannels).toBe(1);
      expect(info.bitsPerSample).toBe(24);
    });

    it('should throw on buffer too small', () => {
      const buffer = Buffer.alloc(20);

      expect(() => parseWavHeader(buffer)).toThrow('Buffer too small');
    });

    it('should throw on invalid RIFF header', () => {
      const buffer = createWavBuffer();
      buffer.write('XXXX', 0);

      expect(() => parseWavHeader(buffer)).toThrow("expected 'RIFF' header");
    });

    it('should throw on invalid WAVE format', () => {
      const buffer = createWavBuffer();
      buffer.write('XXXX', 8);

      expect(() => parseWavHeader(buffer)).toThrow("expected 'WAVE' format");
    });
  });

  describe('calculateWavDuration', () => {
    it('should calculate correct duration for mono audio', () => {
      const wavInfo = {
        sampleRate: 44100,
        numChannels: 1,
        bitsPerSample: 16,
        dataOffset: 44,
        dataSize: 88200, // 1 second
      };

      const duration = calculateWavDuration(wavInfo);

      expect(duration).toBe(1);
    });

    it('should calculate correct duration for stereo audio', () => {
      const wavInfo = {
        sampleRate: 44100,
        numChannels: 2,
        bitsPerSample: 16,
        dataOffset: 44,
        dataSize: 176400, // 1 second of stereo
      };

      const duration = calculateWavDuration(wavInfo);

      expect(duration).toBe(1);
    });

    it('should calculate correct duration for longer audio', () => {
      const wavInfo = {
        sampleRate: 44100,
        numChannels: 1,
        bitsPerSample: 16,
        dataOffset: 44,
        dataSize: 882000, // 10 seconds
      };

      const duration = calculateWavDuration(wavInfo);

      expect(duration).toBe(10);
    });
  });

  describe('getWavDuration', () => {
    it('should return correct duration for mono WAV', () => {
      const buffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 1,
        bitsPerSample: 16,
        dataSize: 88200, // 1 second
      });

      const duration = getWavDuration(buffer);

      expect(duration).toBe(1);
    });

    it('should return correct duration for stereo WAV', () => {
      const buffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 2,
        bitsPerSample: 16,
        dataSize: 176400, // 1 second stereo
      });

      const duration = getWavDuration(buffer);

      expect(duration).toBe(1);
    });

    it('should handle different sample rates', () => {
      const buffer = createWavBuffer({
        sampleRate: 48000,
        numChannels: 1,
        bitsPerSample: 16,
        dataSize: 96000, // 1 second at 48kHz
      });

      const duration = getWavDuration(buffer);

      expect(duration).toBe(1);
    });

    it('critical: stereo audio should not report 2x the actual duration', () => {
      // This is the key bug we're fixing: stereo audio was incorrectly
      // calculated as 2x the actual duration due to hardcoded mono assumption

      const monoBuffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 1,
        bitsPerSample: 16,
        dataSize: 88200, // 1 second mono
      });

      const stereoBuffer = createWavBuffer({
        sampleRate: 44100,
        numChannels: 2,
        bitsPerSample: 16,
        dataSize: 176400, // 1 second stereo (same actual duration, double data)
      });

      const monoDuration = getWavDuration(monoBuffer);
      const stereoDuration = getWavDuration(stereoBuffer);

      // Both should be 1 second
      expect(monoDuration).toBe(1);
      expect(stereoDuration).toBe(1);

      // Old buggy code would calculate:
      // mono: 88200 / 88200 = 1 second (correct)
      // stereo: 176400 / 88200 = 2 seconds (WRONG!)
    });
  });
});
