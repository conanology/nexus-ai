/**
 * Tests for audio-utils module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidGcsUrl, validateAudioFormat, convertToLinear16 } from '../audio-utils.js';

// Track mock calls for conversion functions
const toBitDepthMock = vi.fn();
const toSampleRateMock = vi.fn();
const toBufferMock = vi.fn().mockReturnValue(new ArrayBuffer(48000));

// Mock state for WaveFile constructor behavior
let waveFileMockOverride: (() => Record<string, unknown>) | null = null;

// Default WaveFile mock implementation factory
function createWaveFileMock(fmtOverrides: Record<string, unknown> = {}) {
  return {
    fmt: {
      audioFormat: 1,
      numChannels: 1,
      sampleRate: 24000,
      bitsPerSample: 16,
      ...fmtOverrides,
    },
    data: {
      samples: new Uint8Array(48000), // 1 second of mono 16-bit audio at 24kHz
    },
    toBitDepth: toBitDepthMock,
    toSampleRate: toSampleRateMock,
    toBuffer: toBufferMock,
  };
}

// Mock the Google Cloud Storage client
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockImplementation(() => ({
      file: vi.fn().mockImplementation(() => ({
        exists: vi.fn().mockResolvedValue([true]),
        download: vi.fn().mockResolvedValue([Buffer.from('mock audio data')]),
      })),
    })),
  })),
}));

// Mock wavefile with override support
vi.mock('wavefile', () => ({
  WaveFile: vi.fn().mockImplementation(function () {
    if (waveFileMockOverride) {
      return waveFileMockOverride();
    }
    return createWaveFileMock();
  }),
}));

describe('isValidGcsUrl', () => {
  it('should return true for valid GCS URLs', () => {
    expect(isValidGcsUrl('gs://my-bucket/path/to/file.wav')).toBe(true);
    expect(isValidGcsUrl('gs://bucket-name/file.wav')).toBe(true);
    expect(isValidGcsUrl('gs://my.bucket.name/path/file.wav')).toBe(true);
    expect(isValidGcsUrl('gs://bucket123/file.wav')).toBe(true);
  });

  it('should return false for invalid GCS URLs', () => {
    expect(isValidGcsUrl('http://bucket/file.wav')).toBe(false);
    expect(isValidGcsUrl('https://bucket/file.wav')).toBe(false);
    expect(isValidGcsUrl('s3://bucket/file.wav')).toBe(false);
    expect(isValidGcsUrl('/local/path/file.wav')).toBe(false);
    expect(isValidGcsUrl('')).toBe(false);
  });

  it('should return false for GCS URLs with invalid bucket names', () => {
    // Bucket names must start with alphanumeric
    expect(isValidGcsUrl('gs://-bucket/file.wav')).toBe(false);
    expect(isValidGcsUrl('gs://.bucket/file.wav')).toBe(false);
  });

  it('should require a path after the bucket', () => {
    expect(isValidGcsUrl('gs://bucket')).toBe(false);
    expect(isValidGcsUrl('gs://bucket/')).toBe(true);
  });
});

describe('validateAudioFormat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waveFileMockOverride = null;
  });

  it('should return format info for valid WAV buffer', () => {
    const buffer = Buffer.from('mock audio data');
    const result = validateAudioFormat(buffer);

    expect(result.encoding).toBe('LINEAR16');
    expect(result.sampleRate).toBe(24000);
    expect(result.channels).toBe(1);
    expect(result.bitDepth).toBe(16);
    expect(result.fileSizeBytes).toBe(buffer.length);
  });

  it('should calculate duration from audio data', () => {
    const buffer = Buffer.from('mock audio data');
    const result = validateAudioFormat(buffer);

    // 48000 bytes / (24000 Hz * 1 ch * 2 bytes/sample) = 1 second
    expect(result.durationSec).toBe(1);
  });

  it('should throw for invalid audio data', () => {
    waveFileMockOverride = () => {
      throw new Error('Invalid WAV');
    };

    expect(() => validateAudioFormat(Buffer.from('bad'))).toThrow('Invalid audio format');
  });
});

describe('convertToLinear16', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waveFileMockOverride = null;
  });

  it('should return original buffer when already in correct format', () => {
    const buffer = Buffer.from('mock audio data');
    const result = convertToLinear16(buffer);

    expect(result.converted).toBe(false);
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('should convert when bit depth differs', () => {
    waveFileMockOverride = () => createWaveFileMock({ bitsPerSample: 24 });

    const result = convertToLinear16(Buffer.from('mock'));

    expect(result.converted).toBe(true);
    expect(toBitDepthMock).toHaveBeenCalledWith('16');
  });

  it('should resample when sample rate differs', () => {
    waveFileMockOverride = () => createWaveFileMock({ sampleRate: 44100 });

    const result = convertToLinear16(Buffer.from('mock'));

    expect(result.converted).toBe(true);
    expect(toSampleRateMock).toHaveBeenCalledWith(24000);
  });

  it('should accept custom target sample rate', () => {
    waveFileMockOverride = () => createWaveFileMock({ sampleRate: 44100 });

    const result = convertToLinear16(Buffer.from('mock'), 16000);

    expect(result.converted).toBe(true);
    expect(toSampleRateMock).toHaveBeenCalledWith(16000);
  });
});
