import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MusicLibrary, MusicTrack, MoodType } from '../types.js';
import { selectMusic } from '../music-selector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '__fixtures__', 'music-library');
const library: MusicLibrary = JSON.parse(
  readFileSync(join(fixturesDir, 'library.json'), 'utf-8')
);

const ALL_MOODS: MoodType[] = ['energetic', 'contemplative', 'urgent', 'neutral'];

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

function getFilenameFromGcsPath(gcsPath: string): string {
  return gcsPath.split('/').pop()!;
}

describe('Music Library - Schema Validation', () => {
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

  it.each(library.tracks)('track "$id" has all required MusicTrack fields', (track: MusicTrack) => {
    expect(track).toHaveProperty('id');
    expect(typeof track.id).toBe('string');

    expect(track).toHaveProperty('mood');
    expect(ALL_MOODS).toContain(track.mood);

    expect(track).toHaveProperty('tempo');
    expect(typeof track.tempo).toBe('number');

    expect(track).toHaveProperty('duration');
    expect(typeof track.duration).toBe('number');

    expect(track).toHaveProperty('gcsPath');
    expect(typeof track.gcsPath).toBe('string');

    expect(track).toHaveProperty('license');
    expect(track.license).toHaveProperty('type');
    expect(track.license).toHaveProperty('attribution');
    expect(track.license).toHaveProperty('restrictions');
    expect(Array.isArray(track.license.restrictions)).toBe(true);

    expect(track).toHaveProperty('loopable');
    expect(typeof track.loopable).toBe('boolean');

    expect(track).toHaveProperty('energy');
    expect(typeof track.energy).toBe('number');

    expect(track).toHaveProperty('tags');
    expect(Array.isArray(track.tags)).toBe(true);
  });
});

describe('Music Library - Mood Coverage', () => {
  it.each(ALL_MOODS)('mood "%s" has 3 or more tracks', (mood: MoodType) => {
    const moodTracks = library.tracks.filter((t) => t.mood === mood);
    expect(moodTracks.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Music Library - GCS Path Validation', () => {
  it.each(library.tracks)(
    'track "$id" gcsPath matches gs://nexus-ai-assets/music/{mood}/{filename}',
    (track: MusicTrack) => {
      const pattern = new RegExp(
        `^gs://nexus-ai-assets/music/${track.mood}/[\\w.-]+\\.wav$`
      );
      expect(track.gcsPath).toMatch(pattern);
    }
  );
});

describe('Music Library - Loop Points Validation', () => {
  const loopableTracks = library.tracks.filter((t) => t.loopable);

  it('at least one track is loopable', () => {
    expect(loopableTracks.length).toBeGreaterThan(0);
  });

  it.each(loopableTracks)(
    'loopable track "$id" has valid loopPoints',
    (track: MusicTrack) => {
      expect(track.loopPoints).toBeDefined();
      expect(track.loopPoints!.startSec).toBeGreaterThanOrEqual(0);
      expect(track.loopPoints!.endSec).toBeGreaterThan(track.loopPoints!.startSec);
      expect(track.loopPoints!.endSec).toBeLessThanOrEqual(track.duration);
    }
  );

  const nonLoopableTracks = library.tracks.filter((t) => !t.loopable);

  it.each(nonLoopableTracks)(
    'non-loopable track "$id" does not have loopPoints',
    (track: MusicTrack) => {
      expect(track.loopPoints).toBeUndefined();
    }
  );
});

describe('Music Library - Value Range Validation', () => {
  it.each(library.tracks)('track "$id" energy is between 0 and 1', (track: MusicTrack) => {
    expect(track.energy).toBeGreaterThanOrEqual(0);
    expect(track.energy).toBeLessThanOrEqual(1);
  });

  it.each(library.tracks)('track "$id" tempo is between 60 and 200 BPM', (track: MusicTrack) => {
    expect(track.tempo).toBeGreaterThanOrEqual(60);
    expect(track.tempo).toBeLessThanOrEqual(200);
  });

  it.each(library.tracks)('track "$id" duration is positive', (track: MusicTrack) => {
    expect(track.duration).toBeGreaterThan(0);
  });
});

describe('Music Library - Fixture File Validation', () => {
  it.each(library.tracks)(
    'track "$id" has corresponding WAV file',
    (track: MusicTrack) => {
      const filename = getFilenameFromGcsPath(track.gcsPath);
      const filepath = join(fixturesDir, track.mood, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  );

  it.each(library.tracks)(
    'track "$id" WAV file is valid and parseable',
    (track: MusicTrack) => {
      const filename = getFilenameFromGcsPath(track.gcsPath);
      const filepath = join(fixturesDir, track.mood, filename);
      const buffer = readFileSync(filepath);

      const header = parseWavHeader(buffer);
      expect(header.sampleRate).toBeGreaterThan(0);
      expect(header.numChannels).toBeGreaterThanOrEqual(1);
      expect(header.bitsPerSample).toBeGreaterThan(0);
      expect(header.durationSec).toBeGreaterThan(0);
    }
  );

  it.each(library.tracks)(
    'track "$id" WAV duration matches library.json duration (within 0.1s)',
    (track: MusicTrack) => {
      const filename = getFilenameFromGcsPath(track.gcsPath);
      const filepath = join(fixturesDir, track.mood, filename);
      const buffer = readFileSync(filepath);

      const header = parseWavHeader(buffer);
      expect(Math.abs(header.durationSec - track.duration)).toBeLessThanOrEqual(0.1);
    }
  );
});

describe('Music Library - Integration with selectMusic', () => {
  it.each(ALL_MOODS)(
    'selectMusic returns a track for mood "%s"',
    (mood: MoodType) => {
      const result = selectMusic(
        { mood, minDurationSec: 0 },
        library
      );
      expect(result).not.toBeNull();
      expect(result!.mood).toBe(mood);
    }
  );
});
