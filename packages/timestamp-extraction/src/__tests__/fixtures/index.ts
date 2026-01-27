/**
 * Test fixture utilities for timestamp-extraction package.
 *
 * Provides types and loaders for reference audio files
 * and their ground-truth word annotations.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * A single annotated word with timing boundaries.
 */
export interface AnnotationWord {
  /** The word text */
  word: string;
  /** Start time in milliseconds */
  startMs: number;
  /** End time in milliseconds */
  endMs: number;
}

/**
 * Ground-truth annotation file for a reference audio file.
 */
export interface AnnotationFile {
  /** All words with their timing boundaries */
  words: AnnotationWord[];
  /** Metadata about the audio file */
  metadata?: {
    /** Total duration in seconds */
    duration: number;
    /** Pace descriptor */
    pace: 'normal' | 'fast' | 'slow' | 'mixed';
    /** Words per minute */
    wpm: number;
    /** Description of the audio content */
    description: string;
  };
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Available test fixture IDs.
 */
export const FIXTURE_IDS = [
  'test-audio-01',
  'test-audio-02',
  'test-audio-03',
  'test-audio-04',
  'test-audio-05',
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

// -----------------------------------------------------------------------------
// Loader Utilities
// -----------------------------------------------------------------------------

/**
 * Load a reference audio WAV file as a Buffer.
 *
 * @param id - Fixture ID (e.g., 'test-audio-01')
 * @returns WAV file buffer
 */
export function loadAudioFixture(id: FixtureId): Buffer {
  const filePath = join(FIXTURES_DIR, `${id}.wav`);
  return readFileSync(filePath);
}

/**
 * Load the annotation JSON for a reference audio file.
 *
 * @param id - Fixture ID (e.g., 'test-audio-01')
 * @returns Parsed annotation file
 */
export function loadAnnotation(id: FixtureId): AnnotationFile {
  const filePath = join(FIXTURES_DIR, `${id}.annotations.json`);
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as AnnotationFile;

  if (!Array.isArray(parsed.words)) {
    throw new Error(`Invalid annotation file ${id}: missing "words" array`);
  }
  for (let i = 0; i < parsed.words.length; i++) {
    const w = parsed.words[i];
    if (typeof w.word !== 'string' || typeof w.startMs !== 'number' || typeof w.endMs !== 'number') {
      throw new Error(`Invalid annotation file ${id}: word at index ${i} missing required fields`);
    }
  }

  return parsed;
}

/**
 * Load both audio and annotation for a fixture.
 *
 * @param id - Fixture ID
 * @returns Object with audio buffer and annotation data
 */
export function loadFixturePair(id: FixtureId): {
  audio: Buffer;
  annotations: AnnotationFile;
} {
  return {
    audio: loadAudioFixture(id),
    annotations: loadAnnotation(id),
  };
}

/**
 * Get the file path for a fixture audio file.
 *
 * @param id - Fixture ID
 * @returns Absolute path to the WAV file
 */
export function getFixturePath(id: FixtureId): string {
  return join(FIXTURES_DIR, `${id}.wav`);
}
