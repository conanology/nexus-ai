/**
 * Tests for audio-utils module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidGcsUrl, validateAudioFormat, convertToLinear16, downloadFromGCS, downloadAndConvert } from '../audio-utils.js';

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

// Configurable Storage mock behavior
let mockFileExists = vi.fn().mockResolvedValue([true]);
let mockFileDownload = vi.fn().mockResolvedValue([Buffer.from('mock audio data')]);

// Track bucket/file calls for verification
const mockBucketFn = vi.fn();
const mockFileFn = vi.fn();

// Mock the Google Cloud Storage client
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: (...args: unknown[]) => {
      mockBucketFn(...args);
      return {
        file: (...fileArgs: unknown[]) => {
          mockFileFn(...fileArgs);
          return {
            get exists() { return mockFileExists; },
            get download() { return mockFileDownload; },
          };
        },
      };
    },
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

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    createPipelineLogger: vi.fn().mockReturnValue(loggerMock),
  };
});

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

  // 2.5: Test convertToLinear16 with non-LINEAR16 encoding (e.g., FLOAT)
  it('should convert FLOAT encoding to 16-bit', () => {
    waveFileMockOverride = () => createWaveFileMock({ audioFormat: 3, bitsPerSample: 32 });

    const result = convertToLinear16(Buffer.from('mock'));

    expect(result.converted).toBe(true);
    expect(toBitDepthMock).toHaveBeenCalledWith('16');
  });

  // 2.6: Test convertToLinear16 with sample rate requiring resampling
  it('should convert both bit depth and sample rate when both differ', () => {
    waveFileMockOverride = () => createWaveFileMock({ bitsPerSample: 24, sampleRate: 44100 });

    const result = convertToLinear16(Buffer.from('mock'));

    expect(result.converted).toBe(true);
    expect(toBitDepthMock).toHaveBeenCalledWith('16');
    expect(toSampleRateMock).toHaveBeenCalledWith(24000);
  });
});

// -----------------------------------------------------------------------------
// downloadFromGCS Tests (Task 2: Subtasks 2.1–2.3)
// -----------------------------------------------------------------------------

describe('downloadFromGCS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = vi.fn().mockResolvedValue([true]);
    mockFileDownload = vi.fn().mockResolvedValue([Buffer.from('mock audio data')]);
    mockBucketFn.mockClear();
    mockFileFn.mockClear();
  });

  // 2.1: Test success path with mocked Storage client
  it('should download audio from valid GCS URL', async () => {
    const result = await downloadFromGCS('gs://my-bucket/path/to/audio.wav', 'test-pipeline');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('mock audio data');
    // Verify correct bucket and file path were used
    expect(mockBucketFn).toHaveBeenCalledWith('my-bucket');
    expect(mockFileFn).toHaveBeenCalledWith('path/to/audio.wav');
  });

  it('should handle nested GCS paths', async () => {
    const result = await downloadFromGCS('gs://test-bucket/nested/path/file.wav', 'test-pipeline');

    expect(result).toBeInstanceOf(Buffer);
    // Verify correct bucket and nested path
    expect(mockBucketFn).toHaveBeenCalledWith('test-bucket');
    expect(mockFileFn).toHaveBeenCalledWith('nested/path/file.wav');
  });

  // 2.2: Test missing file (error handling)
  it('should throw when file does not exist', async () => {
    mockFileExists = vi.fn().mockResolvedValue([false]);

    await expect(
      downloadFromGCS('gs://my-bucket/missing-file.wav', 'test-pipeline')
    ).rejects.toThrow('Audio file not found');
  });

  // 2.3: Test invalid GCS URL
  it('should throw for invalid GCS URL format', async () => {
    await expect(
      downloadFromGCS('https://not-gcs/file.wav', 'test-pipeline')
    ).rejects.toThrow('Invalid GCS URL format');
  });

  it('should throw for empty GCS URL', async () => {
    await expect(
      downloadFromGCS('', 'test-pipeline')
    ).rejects.toThrow('Invalid GCS URL format');
  });

  it('should throw for malformed GCS URL without path', async () => {
    await expect(
      downloadFromGCS('gs://bucket-only', 'test-pipeline')
    ).rejects.toThrow('Invalid GCS URL format');
  });
});

// -----------------------------------------------------------------------------
// downloadAndConvert Tests (Task 2: Subtask 2.4)
// -----------------------------------------------------------------------------

describe('downloadAndConvert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waveFileMockOverride = null;
    mockFileExists = vi.fn().mockResolvedValue([true]);
    mockFileDownload = vi.fn().mockResolvedValue([Buffer.from('mock audio data')]);
    mockBucketFn.mockClear();
    mockFileFn.mockClear();
  });

  // 2.4: Test full pipeline (download + validate + convert)
  it('should download, validate, and return audio result', async () => {
    const result = await downloadAndConvert('gs://my-bucket/audio.wav', 'test-pipeline');

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.originalFormat).toBeDefined();
    expect(result.originalFormat.encoding).toBe('LINEAR16');
    expect(result.originalFormat.sampleRate).toBe(24000);
    expect(typeof result.conversionPerformed).toBe('boolean');
  });

  it('should report no conversion for already-correct format', async () => {
    const result = await downloadAndConvert('gs://my-bucket/audio.wav', 'test-pipeline');

    expect(result.conversionPerformed).toBe(false);
  });

  it('should report conversion when format differs', async () => {
    waveFileMockOverride = () => createWaveFileMock({ bitsPerSample: 24 });

    const result = await downloadAndConvert('gs://my-bucket/audio.wav', 'test-pipeline');

    expect(result.conversionPerformed).toBe(true);
  });

  it('should propagate download errors', async () => {
    mockFileExists = vi.fn().mockResolvedValue([false]);

    await expect(
      downloadAndConvert('gs://my-bucket/missing.wav', 'test-pipeline')
    ).rejects.toThrow('Audio file not found');
  });
});
