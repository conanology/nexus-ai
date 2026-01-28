import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusError } from '@nexus-ai/core';
import type { SpeechSegment, DuckingConfig } from '../types.js';

// Mock child_process and ffmpeg-static before importing ducking module
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('ffmpeg-static', () => ({
  default: '/usr/bin/ffmpeg',
}));

vi.mock('fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { execFile } from 'child_process';
import {
  detectSpeechSegments,
  generateDuckingCurve,
  DEFAULT_DUCKING_CONFIG,
} from '../ducking.js';

const mockExecFile = vi.mocked(execFile);

// Helper to simulate promisified execFile
function mockExecFileCall(
  stderr: string,
  stdout = ''
): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
        null,
        { stdout, stderr }
      );
      return {} as ReturnType<typeof execFile>;
    }
  );
}

function mockExecFileError(error: Error): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: Error) => void)(error);
      return {} as ReturnType<typeof execFile>;
    }
  );
}

describe('DEFAULT_DUCKING_CONFIG', () => {
  it('exports correct default values', () => {
    expect(DEFAULT_DUCKING_CONFIG).toEqual({
      speechLevel: -20,
      silenceLevel: -12,
      attackMs: 50,
      releaseMs: 300,
    });
  });
});

describe('generateDuckingCurve', () => {
  const config: DuckingConfig = {
    speechLevel: -20,
    silenceLevel: -12,
    attackMs: 50,
    releaseMs: 300,
  };

  it('returns flat curve at silenceLevel for empty segments', () => {
    const result = generateDuckingCurve([], config, 10);

    expect(result).toEqual([
      { timeSec: 0, gainDb: -12 },
      { timeSec: 10, gainDb: -12 },
    ]);
  });

  it('produces attack/release envelope for single segment', () => {
    const segments: SpeechSegment[] = [{ startSec: 2, endSec: 5 }];
    const result = generateDuckingCurve(segments, config, 10);

    // Expect: t=0 silence, t=1.95 silence (attack start), t=2 speech, t=5 speech, t=5.3 silence (release), t=10 silence
    expect(result.length).toBeGreaterThanOrEqual(5);

    // First point at t=0
    expect(result[0]).toEqual({ timeSec: 0, gainDb: -12 });

    // Should have speechLevel at segment boundaries
    const speechPoints = result.filter((p) => p.gainDb === -20);
    expect(speechPoints.length).toBeGreaterThanOrEqual(2);

    // Last point at total duration
    expect(result[result.length - 1]).toEqual({ timeSec: 10, gainDb: -12 });
  });

  it('produces correct envelope for multiple segments', () => {
    const segments: SpeechSegment[] = [
      { startSec: 1, endSec: 3 },
      { startSec: 6, endSec: 8 },
    ];
    const result = generateDuckingCurve(segments, config, 10);

    // Should have points for both segments
    expect(result.length).toBeGreaterThanOrEqual(8);

    // First and last points
    expect(result[0]).toEqual({ timeSec: 0, gainDb: -12 });
    expect(result[result.length - 1]).toEqual({ timeSec: 10, gainDb: -12 });

    // Both segments should produce speechLevel points
    const speechPoints = result.filter((p) => p.gainDb === -20);
    expect(speechPoints.length).toBeGreaterThanOrEqual(4);
  });

  it('applies custom config values', () => {
    const customConfig: DuckingConfig = {
      speechLevel: -30,
      silenceLevel: -6,
      attackMs: 100,
      releaseMs: 500,
    };
    const segments: SpeechSegment[] = [{ startSec: 2, endSec: 4 }];
    const result = generateDuckingCurve(segments, customConfig, 10);

    // Should use custom levels
    expect(result[0].gainDb).toBe(-6); // silenceLevel
    const speechPoints = result.filter((p) => p.gainDb === -30);
    expect(speechPoints.length).toBeGreaterThanOrEqual(2);
  });

  it('handles overlapping segments gracefully', () => {
    // Segments close enough that release of first overlaps attack of second
    const segments: SpeechSegment[] = [
      { startSec: 1, endSec: 3 },
      { startSec: 3.1, endSec: 5 },
    ];
    const result = generateDuckingCurve(segments, config, 10);

    // Should not throw and should have valid points
    expect(result.length).toBeGreaterThanOrEqual(4);

    // All points should be sorted by time
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timeSec).toBeGreaterThanOrEqual(result[i - 1].timeSec);
    }
  });

  it('returns points sorted by time', () => {
    const segments: SpeechSegment[] = [
      { startSec: 5, endSec: 7 },
      { startSec: 1, endSec: 3 },
    ];
    const result = generateDuckingCurve(segments, config, 10);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].timeSec).toBeGreaterThanOrEqual(result[i - 1].timeSec);
    }
  });

  it('includes t=0 and t=totalDuration points', () => {
    const segments: SpeechSegment[] = [{ startSec: 3, endSec: 7 }];
    const result = generateDuckingCurve(segments, config, 10);

    expect(result[0].timeSec).toBe(0);
    expect(result[result.length - 1].timeSec).toBe(10);
  });

  it('uses default config values correctly', () => {
    const segments: SpeechSegment[] = [{ startSec: 2, endSec: 4 }];
    const result = generateDuckingCurve(segments, DEFAULT_DUCKING_CONFIG, 8);

    expect(result[0].gainDb).toBe(-12); // DEFAULT silenceLevel
    const speechPoints = result.filter((p) => p.gainDb === -20);
    expect(speechPoints.length).toBeGreaterThanOrEqual(2); // DEFAULT speechLevel
  });

  it('clamps attack start to 0 when segment starts early', () => {
    const segments: SpeechSegment[] = [{ startSec: 0.01, endSec: 2 }];
    const result = generateDuckingCurve(segments, config, 5);

    // Attack start would be -0.04, should clamp to 0
    expect(result[0].timeSec).toBe(0);
    // No negative times
    result.forEach((p) => expect(p.timeSec).toBeGreaterThanOrEqual(0));
  });

  it('clamps release end to totalDuration when segment ends late', () => {
    const segments: SpeechSegment[] = [{ startSec: 8, endSec: 9.9 }];
    const result = generateDuckingCurve(segments, config, 10);

    // Release end would be 10.2, should clamp to 10
    result.forEach((p) => expect(p.timeSec).toBeLessThanOrEqual(10));
    expect(result[result.length - 1].timeSec).toBe(10);
  });
});

describe('detectSpeechSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SpeechSegment[] from mocked VAD output', async () => {
    // First call: format conversion (success)
    mockExecFileCall('');

    // Second call: silencedetect
    const silenceOutput = [
      '[silencedetect @ 0x1234] silence_start: 0',
      '[silencedetect @ 0x1234] silence_end: 1.5 | silence_duration: 1.5',
      '[silencedetect @ 0x1234] silence_start: 3.0',
      '[silencedetect @ 0x1234] silence_end: 4.0 | silence_duration: 1.0',
    ].join('\n');
    mockExecFileCall(silenceOutput);

    // Third call: get duration
    mockExecFileCall('Duration: 00:00:06.00');

    const segments = await detectSpeechSegments('/tmp/test.wav');

    expect(segments).toEqual([
      { startSec: 1.5, endSec: 3.0 },
      { startSec: 4.0, endSec: 6.0 },
    ]);
  });

  it('merges segments closer than 200ms', async () => {
    // Format conversion
    mockExecFileCall('');

    // Silencedetect with small gap between speech segments
    const silenceOutput = [
      '[silencedetect @ 0x1234] silence_start: 2.0',
      '[silencedetect @ 0x1234] silence_end: 2.1 | silence_duration: 0.1',
    ].join('\n');
    mockExecFileCall(silenceOutput);

    // Duration
    mockExecFileCall('Duration: 00:00:05.00');

    const segments = await detectSpeechSegments('/tmp/test.wav');

    // The gap (2.0-2.1 = 0.1s) is less than 200ms threshold
    // So segments [0, 2.0] and [2.1, 5.0] should merge into [0, 5.0]
    expect(segments).toEqual([{ startSec: 0, endSec: 5.0 }]);
  });

  it('handles audio ending in silence (trailing silence_start without silence_end)', async () => {
    // Format conversion
    mockExecFileCall('');

    // Silencedetect: speech then trailing silence with no silence_end
    const silenceOutput = [
      '[silencedetect @ 0x1234] silence_start: 3.0',
    ].join('\n');
    mockExecFileCall(silenceOutput);

    // Duration
    mockExecFileCall('Duration: 00:00:05.00');

    const segments = await detectSpeechSegments('/tmp/test.wav');

    // Speech from 0 to 3.0, trailing silence from 3.0 to 5.0
    expect(segments).toEqual([{ startSec: 0, endSec: 3.0 }]);
  });

  it('returns empty array for silent audio', async () => {
    // Format conversion
    mockExecFileCall('');

    // Silencedetect: entire audio is silence
    const silenceOutput = [
      '[silencedetect @ 0x1234] silence_start: 0',
      '[silencedetect @ 0x1234] silence_end: 5.0 | silence_duration: 5.0',
    ].join('\n');
    mockExecFileCall(silenceOutput);

    // Duration
    mockExecFileCall('Duration: 00:00:05.00');

    const segments = await detectSpeechSegments('/tmp/test.wav');

    expect(segments).toEqual([]);
  });

  it('throws NexusError when duration cannot be parsed', async () => {
    // Format conversion
    mockExecFileCall('');
    // Silencedetect
    mockExecFileCall('');
    // Duration output missing Duration line
    mockExecFileCall('no duration info here');

    const error = await detectSpeechSegments('/tmp/test.wav').catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_VAD_FAILED');
  });

  it('throws NexusError on processing failure', async () => {
    // Format conversion fails
    mockExecFileError(new Error('ffmpeg not found'));

    const error = await detectSpeechSegments('/tmp/test.wav').catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_VAD_FAILED');
  });

  it('calls ffmpeg for format conversion', async () => {
    // Format conversion
    mockExecFileCall('');
    // Silencedetect
    mockExecFileCall('');
    // Duration
    mockExecFileCall('Duration: 00:00:01.00');

    await detectSpeechSegments('/tmp/test.wav');

    // First call should be the format conversion
    expect(mockExecFile).toHaveBeenCalledTimes(3);
    const firstCallArgs = mockExecFile.mock.calls[0];
    expect(firstCallArgs[0]).toBe('/usr/bin/ffmpeg');
    expect(firstCallArgs[1]).toEqual(
      expect.arrayContaining(['-i', '/tmp/test.wav', '-ar', '16000', '-ac', '1'])
    );
  });
});
