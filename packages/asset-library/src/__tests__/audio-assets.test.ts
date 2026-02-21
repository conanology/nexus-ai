/**
 * Audio Assets Tests
 *
 * Validates that all SFX and music files exist, have valid WAV format,
 * correct sample rate, and that getSfxForSceneType returns expected arrays.
 */

import { readFileSync, existsSync } from 'fs';
import { describe, it, expect } from 'vitest';
import {
  SFX_LIBRARY,
  SFX_NAMES,
  MUSIC_LIBRARY,
  MUSIC_NAMES,
  getSfxForSceneType,
} from '../index.js';

// ---------------------------------------------------------------------------
// WAV validation helpers
// ---------------------------------------------------------------------------

function isValidWav(buffer: Buffer): boolean {
  if (buffer.length < 44) return false;
  if (buffer.toString('utf8', 0, 4) !== 'RIFF') return false;
  if (buffer.toString('utf8', 8, 12) !== 'WAVE') return false;
  if (buffer.toString('utf8', 12, 16) !== 'fmt ') return false;
  return true;
}

function getWavSampleRate(buffer: Buffer): number {
  // Sample rate is at byte offset 24 (UInt32LE)
  return buffer.readUInt32LE(24);
}

function getWavNumChannels(buffer: Buffer): number {
  // NumChannels is at byte offset 22 (UInt16LE)
  return buffer.readUInt16LE(22);
}

function getWavBitsPerSample(buffer: Buffer): number {
  // BitsPerSample is at byte offset 34 (UInt16LE)
  return buffer.readUInt16LE(34);
}

// ---------------------------------------------------------------------------
// SFX file existence + format
// ---------------------------------------------------------------------------

describe('SFX files', () => {
  const expectedSfx = [
    'whoosh-in',
    'whoosh-out',
    'impact-soft',
    'impact-hard',
    'click',
    'reveal',
    'transition',
    'keyboard-clack',
    'pen-scratch',
    'record-scratch',
    'digital-scan',
    'pop',
    'deep-boom',
    'blip',
    'hit',
    'intro-sting',
  ];

  it('SFX_LIBRARY contains all 16 expected SFX', () => {
    expect(SFX_NAMES).toHaveLength(16);
    for (const name of expectedSfx) {
      expect(SFX_LIBRARY[name]).toBeDefined();
    }
  });

  for (const name of expectedSfx) {
    describe(`${name}.wav`, () => {
      it('file exists at declared path', () => {
        const filePath = SFX_LIBRARY[name];
        expect(existsSync(filePath)).toBe(true);
      });

      it('is a valid WAV file', () => {
        const buffer = readFileSync(SFX_LIBRARY[name]);
        expect(isValidWav(buffer)).toBe(true);
      });

      it('has 44100 Hz sample rate', () => {
        const buffer = readFileSync(SFX_LIBRARY[name]);
        expect(getWavSampleRate(buffer)).toBe(44100);
      });

      it('is mono (1 channel)', () => {
        const buffer = readFileSync(SFX_LIBRARY[name]);
        expect(getWavNumChannels(buffer)).toBe(1);
      });

      it('is 16-bit', () => {
        const buffer = readFileSync(SFX_LIBRARY[name]);
        expect(getWavBitsPerSample(buffer)).toBe(16);
      });

      it('has non-zero audio data (not silence)', () => {
        const buffer = readFileSync(SFX_LIBRARY[name]);
        // Check that PCM data after header has some non-zero samples
        const pcmStart = 44;
        let hasNonZero = false;
        for (let i = pcmStart; i < Math.min(buffer.length, pcmStart + 1000); i += 2) {
          if (buffer.readInt16LE(i) !== 0) {
            hasNonZero = true;
            break;
          }
        }
        expect(hasNonZero).toBe(true);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Music file existence + format
// ---------------------------------------------------------------------------

describe('Music files', () => {
  const expectedMusic = ['ambient-tech-01', 'background-music-01'];

  it('MUSIC_LIBRARY contains all expected tracks', () => {
    expect(MUSIC_NAMES).toHaveLength(expectedMusic.length);
    for (const name of expectedMusic) {
      expect(MUSIC_LIBRARY[name]).toBeDefined();
    }
  });

  for (const name of expectedMusic) {
    describe(`${name}.wav`, () => {
      it('file exists at declared path', () => {
        expect(existsSync(MUSIC_LIBRARY[name])).toBe(true);
      });

      it('is a valid WAV file', () => {
        const buffer = readFileSync(MUSIC_LIBRARY[name]);
        expect(isValidWav(buffer)).toBe(true);
      });

      it('has 44100 Hz sample rate', () => {
        const buffer = readFileSync(MUSIC_LIBRARY[name]);
        expect(getWavSampleRate(buffer)).toBe(44100);
      });

      it('is mono (1 channel)', () => {
        const buffer = readFileSync(MUSIC_LIBRARY[name]);
        expect(getWavNumChannels(buffer)).toBe(1);
      });

      it('is 16-bit', () => {
        const buffer = readFileSync(MUSIC_LIBRARY[name]);
        expect(getWavBitsPerSample(buffer)).toBe(16);
      });

      it('has non-zero audio data', () => {
        const buffer = readFileSync(MUSIC_LIBRARY[name]);
        const pcmStart = 44;
        let hasNonZero = false;
        for (let i = pcmStart; i < Math.min(buffer.length, pcmStart + 1000); i += 2) {
          if (buffer.readInt16LE(i) !== 0) {
            hasNonZero = true;
            break;
          }
        }
        expect(hasNonZero).toBe(true);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// getSfxForSceneType
// ---------------------------------------------------------------------------

describe('getSfxForSceneType', () => {
  it('returns ["intro-sting"] for intro', () => {
    expect(getSfxForSceneType('intro')).toEqual(['intro-sting']);
  });

  it('returns ["whoosh-out"] for outro', () => {
    expect(getSfxForSceneType('outro')).toEqual(['whoosh-out']);
  });

  it('returns ["deep-boom"] for chapter-break', () => {
    expect(getSfxForSceneType('chapter-break')).toEqual(['deep-boom']);
  });

  it('returns ["impact-hard", "hit"] for stat-callout', () => {
    expect(getSfxForSceneType('stat-callout')).toEqual(['impact-hard', 'hit']);
  });

  it('returns ["reveal"] for text-emphasis', () => {
    expect(getSfxForSceneType('text-emphasis')).toEqual(['reveal']);
  });

  it('returns ["reveal"] for full-screen-text', () => {
    expect(getSfxForSceneType('full-screen-text')).toEqual(['reveal']);
  });

  it('returns ["whoosh-in"] for comparison', () => {
    expect(getSfxForSceneType('comparison')).toEqual(['whoosh-in']);
  });

  it('returns ["click"] for list-reveal', () => {
    expect(getSfxForSceneType('list-reveal')).toEqual(['click']);
  });

  it('returns ["pop"] for logo-showcase', () => {
    expect(getSfxForSceneType('logo-showcase')).toEqual(['pop']);
  });

  it('returns ["blip"] for diagram', () => {
    expect(getSfxForSceneType('diagram')).toEqual(['blip']);
  });

  it('returns ["keyboard-clack"] for code-block', () => {
    expect(getSfxForSceneType('code-block')).toEqual(['keyboard-clack']);
  });

  it('returns ["click"] for timeline', () => {
    expect(getSfxForSceneType('timeline')).toEqual(['click']);
  });

  it('returns ["impact-soft"] for quote', () => {
    expect(getSfxForSceneType('quote')).toEqual(['impact-soft']);
  });

  it('returns ["whoosh-in"] for narration-default', () => {
    expect(getSfxForSceneType('narration-default')).toEqual(['whoosh-in']);
  });

  it('returns [] for unknown scene type', () => {
    expect(getSfxForSceneType('unknown-type')).toEqual([]);
  });
});
