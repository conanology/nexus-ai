import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusError } from '@nexus-ai/core';
import type { MusicLibrary, MusicTrack, MusicSelectionCriteria } from '../types.js';

// Mock child_process and ffmpeg-static before importing module
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
import { unlink } from 'fs/promises';
import {
  loadMusicLibrary,
  clearMusicLibraryCache,
  selectMusic,
  prepareLoopedTrack,
} from '../music-selector.js';

const mockExecFile = vi.mocked(execFile);
const mockUnlink = vi.mocked(unlink);

function mockExecFileCall(stderr: string, stdout = ''): void {
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

function createTrack(overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id: 'track-1',
    mood: 'energetic',
    tempo: 120,
    duration: 60,
    gcsPath: '/path/to/track.wav',
    license: { type: 'CC0', attribution: '', restrictions: [] },
    loopable: false,
    energy: 0.7,
    tags: ['upbeat', 'electronic'],
    ...overrides,
  };
}

const sampleLibrary: MusicLibrary = {
  tracks: [
    createTrack({ id: 'e1', mood: 'energetic', duration: 120, energy: 0.8, tags: ['upbeat', 'electronic'] }),
    createTrack({ id: 'e2', mood: 'energetic', duration: 30, energy: 0.6, tags: ['rock'], loopable: true }),
    createTrack({ id: 'c1', mood: 'contemplative', duration: 90, energy: 0.3, tags: ['piano', 'ambient'] }),
    createTrack({ id: 'u1', mood: 'urgent', duration: 45, energy: 0.9, tags: ['electronic', 'fast'] }),
    createTrack({ id: 'n1', mood: 'neutral', duration: 60, energy: 0.5, tags: ['ambient'] }),
  ],
};

describe('loadMusicLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMusicLibraryCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches library from default URL and returns MusicLibrary', async () => {
    const mockLibrary: MusicLibrary = { tracks: [createTrack()] };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLibrary),
    } as Response);

    const result = await loadMusicLibrary();

    expect(fetch).toHaveBeenCalledWith(
      'https://storage.googleapis.com/nexus-ai-assets/music/library.json'
    );
    expect(result).toEqual(mockLibrary);
  });

  it('fetches from custom URL when provided', async () => {
    const mockLibrary: MusicLibrary = { tracks: [] };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLibrary),
    } as Response);

    await loadMusicLibrary('https://custom.url/library.json');

    expect(fetch).toHaveBeenCalledWith('https://custom.url/library.json');
  });

  it('caches library on subsequent calls', async () => {
    const mockLibrary: MusicLibrary = { tracks: [createTrack()] };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLibrary),
    } as Response);

    const first = await loadMusicLibrary();
    const second = await loadMusicLibrary();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('throws NexusError on fetch network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const error = await loadMusicLibrary().catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED');
  });

  it('throws NexusError on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const error = await loadMusicLibrary().catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED');
  });

  it('throws NexusError on invalid library format (missing tracks array)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ notTracks: [] }),
    } as unknown as Response);

    const error = await loadMusicLibrary().catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED');
  });

  it('clearMusicLibraryCache resets cache so next call fetches again', async () => {
    const mockLibrary: MusicLibrary = { tracks: [] };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLibrary),
    } as Response);

    await loadMusicLibrary();
    expect(fetch).toHaveBeenCalledTimes(1);

    clearMusicLibraryCache();
    await loadMusicLibrary();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('selectMusic', () => {
  it('filters by mood (exact match)', () => {
    const criteria: MusicSelectionCriteria = { mood: 'contemplative', minDurationSec: 30 };
    const result = selectMusic(criteria, sampleLibrary);

    expect(result).not.toBeNull();
    expect(result!.mood).toBe('contemplative');
    expect(result!.id).toBe('c1');
  });

  it('returns null when no tracks match mood', () => {
    const library: MusicLibrary = { tracks: [createTrack({ mood: 'energetic' })] };
    const criteria: MusicSelectionCriteria = { mood: 'urgent', minDurationSec: 30 };

    expect(selectMusic(criteria, library)).toBeNull();
  });

  it('filters by duration (track.duration >= minDurationSec)', () => {
    const criteria: MusicSelectionCriteria = { mood: 'energetic', minDurationSec: 100 };
    const result = selectMusic(criteria, sampleLibrary);

    // e1 has duration 120 (passes), e2 has duration 30 but is loopable (passes)
    // e1 should score higher on duration fit
    expect(result).not.toBeNull();
    expect(result!.id).toBe('e1');
  });

  it('includes loopable tracks even if shorter than minDurationSec', () => {
    const library: MusicLibrary = {
      tracks: [
        createTrack({ id: 'short-loop', mood: 'energetic', duration: 10, loopable: true }),
      ],
    };
    const criteria: MusicSelectionCriteria = { mood: 'energetic', minDurationSec: 60 };

    const result = selectMusic(criteria, library);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('short-loop');
  });

  it('excludes tracks in excludeTrackIds', () => {
    const criteria: MusicSelectionCriteria = {
      mood: 'energetic',
      minDurationSec: 30,
      excludeTrackIds: ['e1'],
    };
    const result = selectMusic(criteria, sampleLibrary);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('e2');
  });

  it('returns null when all matching tracks are excluded', () => {
    const criteria: MusicSelectionCriteria = {
      mood: 'energetic',
      minDurationSec: 30,
      excludeTrackIds: ['e1', 'e2'],
    };

    expect(selectMusic(criteria, sampleLibrary)).toBeNull();
  });

  it('scores by energy match when targetEnergy provided', () => {
    const library: MusicLibrary = {
      tracks: [
        createTrack({ id: 'low-e', mood: 'energetic', duration: 60, energy: 0.2 }),
        createTrack({ id: 'high-e', mood: 'energetic', duration: 60, energy: 0.9 }),
      ],
    };
    const criteria: MusicSelectionCriteria = {
      mood: 'energetic',
      minDurationSec: 30,
      targetEnergy: 0.9,
    };

    const result = selectMusic(criteria, library);
    expect(result!.id).toBe('high-e');
  });

  it('scores by tag overlap when tags provided', () => {
    const library: MusicLibrary = {
      tracks: [
        createTrack({ id: 'no-match', mood: 'energetic', duration: 60, tags: ['classical'] }),
        createTrack({ id: 'full-match', mood: 'energetic', duration: 60, tags: ['upbeat', 'electronic'] }),
      ],
    };
    const criteria: MusicSelectionCriteria = {
      mood: 'energetic',
      minDurationSec: 30,
      tags: ['upbeat', 'electronic'],
    };

    const result = selectMusic(criteria, library);
    expect(result!.id).toBe('full-match');
  });

  it('returns null for empty library', () => {
    const criteria: MusicSelectionCriteria = { mood: 'energetic', minDurationSec: 30 };
    expect(selectMusic(criteria, { tracks: [] })).toBeNull();
  });

  it('filters out non-loopable short tracks', () => {
    const library: MusicLibrary = {
      tracks: [
        createTrack({ id: 'too-short', mood: 'energetic', duration: 10, loopable: false }),
      ],
    };
    const criteria: MusicSelectionCriteria = { mood: 'energetic', minDurationSec: 60 };

    expect(selectMusic(criteria, library)).toBeNull();
  });

  it('handles minDurationSec = 0 without division by zero', () => {
    const library: MusicLibrary = {
      tracks: [createTrack({ id: 'any', mood: 'energetic', duration: 60 })],
    };
    const criteria: MusicSelectionCriteria = { mood: 'energetic', minDurationSec: 0 };

    const result = selectMusic(criteria, library);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('any');
  });
});

describe('prepareLoopedTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns track path directly when duration >= targetDurationSec', async () => {
    const track = createTrack({ duration: 120, gcsPath: '/path/to/long-track.wav' });
    const result = await prepareLoopedTrack(track, 60);

    expect(result).toBe('/path/to/long-track.wav');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('calls ffmpeg to loop short tracks', async () => {
    const track = createTrack({
      duration: 30,
      gcsPath: '/path/to/short-track.wav',
      loopable: true,
      loopPoints: { startSec: 2, endSec: 28 },
    });

    mockExecFileCall('');

    const result = await prepareLoopedTrack(track, 60);

    expect(result).toMatch(/nexus-loop-.*\.wav$/);
    expect(mockExecFile).toHaveBeenCalledTimes(1);

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('-stream_loop');
    expect(args).toContain('-i');
    expect(args).toContain('/path/to/short-track.wav');
    expect(args).toContain('-ss');
    expect(args).toContain('2');
    expect(args).toContain('-t');
    expect(args).toContain('60');
  });

  it('uses default loop points when loopPoints not specified', async () => {
    const track = createTrack({
      duration: 30,
      gcsPath: '/path/to/track.wav',
      loopable: true,
    });
    delete (track as Record<string, unknown>).loopPoints;

    mockExecFileCall('');

    await prepareLoopedTrack(track, 90);

    const args = mockExecFile.mock.calls[0][1] as string[];
    // loopStart defaults to 0
    expect(args).toContain('-ss');
    expect(args).toContain('0');
    // loopCount = ceil(90 / 30) = 3, so stream_loop = 2
    expect(args).toContain('-stream_loop');
    expect(args).toContain('2');
  });

  it('cleans up output file on ffmpeg error', async () => {
    const track = createTrack({ duration: 10, gcsPath: '/path/to/track.wav' });

    mockExecFileError(new Error('ffmpeg crashed'));

    const error = await prepareLoopedTrack(track, 60).catch((e) => e);

    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_LOOP_FAILED');
    expect(mockUnlink).toHaveBeenCalled();
  });

  it('throws NexusError for invalid loop points', async () => {
    const track = createTrack({
      duration: 30,
      loopPoints: { startSec: 28, endSec: 2 }, // Invalid: start > end
    });

    const error = await prepareLoopedTrack(track, 60).catch((e) => e);
    expect(error).toBeInstanceOf(NexusError);
    expect(error.code).toBe('NEXUS_AUDIO_MIXER_LOOP_FAILED');
  });
});
