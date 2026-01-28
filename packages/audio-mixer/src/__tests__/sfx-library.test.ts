import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SfxLibrary, SfxTrack, SfxCategory } from '../types.js';
import { loadSFXLibrary, getSFX, clearSFXLibraryCache } from '../sfx.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '__fixtures__', 'sfx-library');
const library: SfxLibrary = JSON.parse(
  readFileSync(join(fixturesDir, 'library.json'), 'utf-8')
);

const ALL_CATEGORIES: SfxCategory[] = ['transitions', 'ui', 'emphasis', 'ambient'];

function parseWavHeader(buffer: Buffer): {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataSize: number;
  durationSec: number;
} {
  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = dataSize / blockAlign;
  const durationSec = numSamples / sampleRate;

  return { sampleRate, numChannels, bitsPerSample, dataSize, durationSec };
}

describe('SFX Library - Schema Validation', () => {
  it('library.json has a tracks array', () => {
    expect(library).toHaveProperty('tracks');
    expect(Array.isArray(library.tracks)).toBe(true);
  });

  it('has 12 or more tracks', () => {
    expect(library.tracks.length).toBeGreaterThanOrEqual(12);
  });

  it('all track IDs are unique', () => {
    const ids = library.tracks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it.each(library.tracks)('track "$id" has all required SfxTrack fields', (track: SfxTrack) => {
    expect(track).toHaveProperty('id');
    expect(typeof track.id).toBe('string');

    expect(track).toHaveProperty('filename');
    expect(typeof track.filename).toBe('string');

    expect(track).toHaveProperty('category');
    expect(ALL_CATEGORIES).toContain(track.category);

    expect(track).toHaveProperty('durationSec');
    expect(typeof track.durationSec).toBe('number');

    expect(track).toHaveProperty('gcsPath');
    expect(typeof track.gcsPath).toBe('string');

    expect(track).toHaveProperty('tags');
    expect(Array.isArray(track.tags)).toBe(true);
  });
});

describe('SFX Library - Category Coverage', () => {
  it.each(ALL_CATEGORIES)('category "%s" has 3 or more tracks', (category: SfxCategory) => {
    const categoryTracks = library.tracks.filter((t) => t.category === category);
    expect(categoryTracks.length).toBeGreaterThanOrEqual(3);
  });
});

describe('SFX Library - GCS Path Validation', () => {
  it.each(library.tracks)(
    'track "$id" gcsPath matches gs://nexus-ai-assets/sfx/{category}/{filename}',
    (track: SfxTrack) => {
      const expected = `gs://nexus-ai-assets/sfx/${track.category}/${track.filename}`;
      expect(track.gcsPath).toBe(expected);
    }
  );
});

describe('SFX Library - Duration Validation', () => {
  it.each(library.tracks)('track "$id" durationSec is positive', (track: SfxTrack) => {
    expect(track.durationSec).toBeGreaterThan(0);
  });
});

describe('SFX Library - Fixture File Validation', () => {
  it.each(library.tracks)(
    'track "$id" has corresponding WAV file',
    (track: SfxTrack) => {
      const filepath = join(fixturesDir, track.category, track.filename);
      expect(existsSync(filepath)).toBe(true);
    }
  );

  it.each(library.tracks)(
    'track "$id" WAV file is valid and parseable',
    (track: SfxTrack) => {
      const filepath = join(fixturesDir, track.category, track.filename);
      const buffer = readFileSync(filepath);

      const header = parseWavHeader(buffer);
      expect(header.sampleRate).toBeGreaterThan(0);
      expect(header.numChannels).toBeGreaterThanOrEqual(1);
      expect(header.bitsPerSample).toBeGreaterThan(0);
      expect(header.durationSec).toBeGreaterThan(0);
    }
  );

  it.each(library.tracks)(
    'track "$id" WAV duration matches library.json durationSec (within 0.1s)',
    (track: SfxTrack) => {
      const filepath = join(fixturesDir, track.category, track.filename);
      const buffer = readFileSync(filepath);

      const header = parseWavHeader(buffer);
      expect(Math.abs(header.durationSec - track.durationSec)).toBeLessThanOrEqual(0.1);
    }
  );
});

describe('SFX Library - loadSFXLibrary', () => {
  beforeEach(() => {
    clearSFXLibraryCache();
    vi.restoreAllMocks();
  });

  it('loads SFX library from URL', async () => {
    const mockLibrary: SfxLibrary = {
      tracks: [
        {
          id: 'test-001',
          filename: 'test.wav',
          category: 'ui',
          durationSec: 1.0,
          gcsPath: 'gs://nexus-ai-assets/sfx/ui/test.wav',
          tags: ['test'],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockLibrary), { status: 200 })
    );

    const result = await loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].id).toBe('test-001');
    expect(fetch).toHaveBeenCalledWith(
      'https://storage.googleapis.com/test-bucket/sfx/library.json',
    );
  });

  it('returns cached library on subsequent calls', async () => {
    const mockLibrary: SfxLibrary = {
      tracks: [
        {
          id: 'cached-001',
          filename: 'cached.wav',
          category: 'emphasis',
          durationSec: 0.5,
          gcsPath: 'gs://nexus-ai-assets/sfx/emphasis/cached.wav',
          tags: ['cached'],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockLibrary), { status: 200 })
    );

    const first = await loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json');
    const second = await loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json');

    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json')).rejects.toThrow(
      'Failed to fetch SFX library'
    );
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    await expect(loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json')).rejects.toThrow(
      'Failed to load SFX library'
    );
  });

  it('throws on invalid library format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ invalid: true }), { status: 200 })
    );

    await expect(loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json')).rejects.toThrow(
      'Invalid SFX library format'
    );
  });

  it('uses default GCS URL when no argument provided', async () => {
    const mockLibrary: SfxLibrary = {
      tracks: [
        {
          id: 'default-001',
          filename: 'default.wav',
          category: 'ui',
          durationSec: 1.0,
          gcsPath: 'gs://nexus-ai-assets/sfx/ui/default.wav',
          tags: ['default'],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockLibrary), { status: 200 })
    );

    await loadSFXLibrary();
    expect(fetch).toHaveBeenCalledWith(
      'https://storage.googleapis.com/nexus-ai-assets/sfx/library.json',
    );
  });
});

describe('SFX Library - getSFX', () => {
  it('finds a track by id', () => {
    const result = getSFX('transition-whoosh-001', library);
    expect(result).toBeDefined();
    expect(result!.id).toBe('transition-whoosh-001');
    expect(result!.category).toBe('transitions');
  });

  it('returns undefined for non-existent id', () => {
    const result = getSFX('non-existent-id', library);
    expect(result).toBeUndefined();
  });

  it.each(library.tracks)('finds track "$id" by id', (track: SfxTrack) => {
    const result = getSFX(track.id, library);
    expect(result).toBeDefined();
    expect(result!.id).toBe(track.id);
  });
});

describe('SFX Library - clearSFXLibraryCache', () => {
  beforeEach(() => {
    clearSFXLibraryCache();
    vi.restoreAllMocks();
  });

  it('clears cache so next loadSFXLibrary fetches again', async () => {
    const mockLibrary: SfxLibrary = {
      tracks: [
        {
          id: 'cache-test-001',
          filename: 'cache-test.wav',
          category: 'ambient',
          durationSec: 1.0,
          gcsPath: 'gs://nexus-ai-assets/sfx/ambient/cache-test.wav',
          tags: ['test'],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(mockLibrary), { status: 200 }))
    );

    await loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json');
    expect(fetch).toHaveBeenCalledTimes(1);

    clearSFXLibraryCache();

    await loadSFXLibrary('https://storage.googleapis.com/test-bucket/sfx/library.json');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
