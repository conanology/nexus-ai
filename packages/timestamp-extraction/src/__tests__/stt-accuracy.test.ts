/**
 * STT accuracy validation tests.
 *
 * Tests that STT extraction accuracy can be validated against
 * ground-truth annotations from reference audio files.
 *
 * Unit tests use mocked STT responses based on annotation data.
 * Integration tests (skipped without GCP credentials) use real STT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadAnnotation,
  loadAudioFixture,
  FIXTURE_IDS,
  type AnnotationFile,
  type FixtureId,
} from './fixtures/index.js';

// Mock Google Cloud Speech and Storage
vi.mock('@google-cloud/speech', () => ({
  SpeechClient: vi.fn().mockImplementation(() => ({
    longRunningRecognize: vi.fn(),
    close: vi.fn(),
  })),
  protos: {
    google: {
      cloud: {
        speech: {
          v1: {
            RecognitionConfig: {
              AudioEncoding: { LINEAR16: 1, FLAC: 2, MP3: 8, OGG_OPUS: 6 },
            },
          },
        },
      },
    },
  },
}));

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        exists: vi.fn().mockResolvedValue([true]),
        download: vi.fn().mockResolvedValue([Buffer.alloc(0)]),
      }),
    }),
  })),
}));

vi.mock('@nexus-ai/core', () => ({
  createPipelineLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  CostTracker: vi.fn().mockImplementation(() => ({
    recordApiCall: vi.fn(),
    getSummary: vi.fn().mockReturnValue({ total: 0 }),
  })),
}));

// -----------------------------------------------------------------------------
// Seeded PRNG for deterministic noise
// -----------------------------------------------------------------------------

/**
 * Simple seeded PRNG (mulberry32) for reproducible test noise.
 * Returns values in [0, 1) like Math.random().
 */
function createSeededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// Accuracy Measurement Utilities
// -----------------------------------------------------------------------------

/**
 * Calculate accuracy: percentage of words where the extracted startMs
 * is within toleranceMs of the annotation startMs.
 */
function calculateAccuracy(
  extracted: Array<{ word: string; startMs: number; endMs: number }>,
  annotations: AnnotationFile,
  toleranceMs: number
): {
  accuracy: number;
  matchedCount: number;
  totalCount: number;
  mismatches: Array<{
    word: string;
    extractedStartMs: number;
    annotationStartMs: number;
    diffMs: number;
  }>;
} {
  const totalCount = annotations.words.length;
  let matchedCount = 0;
  const mismatches: Array<{
    word: string;
    extractedStartMs: number;
    annotationStartMs: number;
    diffMs: number;
  }> = [];

  for (let i = 0; i < totalCount; i++) {
    const annotationWord = annotations.words[i];
    // Find the corresponding extracted word (by index, since order matches)
    const extractedWord = extracted[i];

    if (!extractedWord) {
      mismatches.push({
        word: annotationWord.word,
        extractedStartMs: -1,
        annotationStartMs: annotationWord.startMs,
        diffMs: Infinity,
      });
      continue;
    }

    const diff = Math.abs(extractedWord.startMs - annotationWord.startMs);
    if (diff <= toleranceMs) {
      matchedCount++;
    } else {
      mismatches.push({
        word: annotationWord.word,
        extractedStartMs: extractedWord.startMs,
        annotationStartMs: annotationWord.startMs,
        diffMs: diff,
      });
    }
  }

  return {
    accuracy: totalCount > 0 ? matchedCount / totalCount : 0,
    matchedCount,
    totalCount,
    mismatches,
  };
}

/**
 * Create mock STT word timings from annotation data.
 * Simulates what Google Cloud STT would return, with optional noise.
 * Uses a seeded PRNG for deterministic, reproducible results.
 */
function createMockSTTWords(
  annotations: AnnotationFile,
  noiseMs: number = 0,
  seed: number = 42
): Array<{ word: string; startMs: number; endMs: number }> {
  const random = createSeededRandom(seed);
  return annotations.words.map((w) => {
    const noise = noiseMs > 0
      ? Math.round((random() - 0.5) * 2 * noiseMs)
      : 0;
    return {
      word: w.word,
      startMs: Math.max(0, w.startMs + noise),
      endMs: Math.max(w.startMs + 10, w.endMs + noise),
    };
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('Fixture Loading', () => {
  it('should load all 5 annotation files', () => {
    for (const id of FIXTURE_IDS) {
      const annotations = loadAnnotation(id);
      expect(annotations.words).toBeDefined();
      expect(annotations.words.length).toBeGreaterThan(0);
      expect(annotations.metadata).toBeDefined();
    }
  });

  it('should load all 5 audio files as valid buffers', () => {
    for (const id of FIXTURE_IDS) {
      const audio = loadAudioFixture(id);
      expect(Buffer.isBuffer(audio)).toBe(true);
      expect(audio.length).toBeGreaterThan(0);
    }
  });

  it('should have correct annotation structure', () => {
    for (const id of FIXTURE_IDS) {
      const annotations = loadAnnotation(id);
      for (const word of annotations.words) {
        expect(typeof word.word).toBe('string');
        expect(word.word.length).toBeGreaterThan(0);
        expect(typeof word.startMs).toBe('number');
        expect(typeof word.endMs).toBe('number');
        expect(word.endMs).toBeGreaterThan(word.startMs);
        expect(word.startMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have monotonically increasing timestamps', () => {
    for (const id of FIXTURE_IDS) {
      const annotations = loadAnnotation(id);
      for (let i = 1; i < annotations.words.length; i++) {
        expect(annotations.words[i].startMs).toBeGreaterThanOrEqual(
          annotations.words[i - 1].startMs
        );
      }
    }
  });

  it('should have metadata with expected fields', () => {
    const expectedPaces: Record<FixtureId, string> = {
      'test-audio-01': 'normal',
      'test-audio-02': 'fast',
      'test-audio-03': 'slow',
      'test-audio-04': 'mixed',
      'test-audio-05': 'normal',
    };

    for (const id of FIXTURE_IDS) {
      const annotations = loadAnnotation(id);
      expect(annotations.metadata).toBeDefined();
      expect(annotations.metadata!.pace).toBe(expectedPaces[id]);
      expect(annotations.metadata!.duration).toBeGreaterThan(0);
      expect(annotations.metadata!.wpm).toBeGreaterThan(0);
      expect(annotations.metadata!.description).toBeTruthy();
    }
  });
});

describe('STT Accuracy Validation (Unit - Mocked STT)', () => {
  const ACCURACY_THRESHOLD = 0.95; // 95% as per AC
  const TOLERANCE_MS = 100; // 100ms tolerance as per AC

  describe('with perfect STT (no noise)', () => {
    it.each(FIXTURE_IDS)(
      'should achieve 100%% accuracy for %s with perfect extraction',
      (id) => {
        const annotations = loadAnnotation(id);
        const mockExtracted = createMockSTTWords(annotations, 0);

        const result = calculateAccuracy(mockExtracted, annotations, TOLERANCE_MS);

        expect(result.accuracy).toBe(1.0);
        expect(result.matchedCount).toBe(result.totalCount);
        expect(result.mismatches).toHaveLength(0);
      }
    );
  });

  describe('with small noise (within tolerance)', () => {
    it.each(FIXTURE_IDS)(
      'should achieve >= 95%% accuracy for %s with 50ms noise',
      (id) => {
        const annotations = loadAnnotation(id);
        // 50ms max noise is within 100ms tolerance; seed=42 for reproducibility
        const mockExtracted = createMockSTTWords(annotations, 50, 42);

        const result = calculateAccuracy(mockExtracted, annotations, TOLERANCE_MS);

        expect(result.accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
      }
    );
  });

  describe('with large noise (may exceed tolerance)', () => {
    it.each(FIXTURE_IDS)(
      'should report accuracy below 100%% for %s with 200ms noise',
      (id) => {
        const annotations = loadAnnotation(id);
        // 200ms noise will exceed 100ms tolerance for many words; seed=123 for reproducibility
        const mockExtracted = createMockSTTWords(annotations, 200, 123);

        const result = calculateAccuracy(mockExtracted, annotations, TOLERANCE_MS);

        // With 200ms noise, accuracy should be noticeably below 100%
        // but some words may still be within tolerance by chance
        expect(result.accuracy).toBeLessThan(1.0);
        expect(result.mismatches.length).toBeGreaterThan(0);
      }
    );
  });

  describe('accuracy metric validation', () => {
    it('should correctly calculate accuracy with mixed results', () => {
      const annotations: AnnotationFile = {
        words: [
          { word: 'hello', startMs: 0, endMs: 450 },
          { word: 'world', startMs: 500, endMs: 920 },
          { word: 'test', startMs: 1000, endMs: 1400 },
          { word: 'data', startMs: 1500, endMs: 1900 },
        ],
      };

      // 2 of 4 words within tolerance (50% accuracy)
      const extracted = [
        { word: 'hello', startMs: 50, endMs: 500 },     // Within 100ms
        { word: 'world', startMs: 700, endMs: 1100 },    // 200ms off - MISS
        { word: 'test', startMs: 1050, endMs: 1450 },    // Within 100ms
        { word: 'data', startMs: 1800, endMs: 2200 },    // 300ms off - MISS
      ];

      const result = calculateAccuracy(extracted, annotations, TOLERANCE_MS);

      expect(result.accuracy).toBe(0.5);
      expect(result.matchedCount).toBe(2);
      expect(result.totalCount).toBe(4);
      expect(result.mismatches).toHaveLength(2);
      expect(result.mismatches[0].word).toBe('world');
      expect(result.mismatches[0].diffMs).toBe(200);
      expect(result.mismatches[1].word).toBe('data');
      expect(result.mismatches[1].diffMs).toBe(300);
    });

    it('should handle missing extracted words', () => {
      const annotations: AnnotationFile = {
        words: [
          { word: 'hello', startMs: 0, endMs: 450 },
          { word: 'world', startMs: 500, endMs: 920 },
        ],
      };

      // Only 1 of 2 words extracted
      const extracted = [{ word: 'hello', startMs: 0, endMs: 450 }];

      const result = calculateAccuracy(extracted, annotations, TOLERANCE_MS);

      expect(result.accuracy).toBe(0.5);
      expect(result.matchedCount).toBe(1);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].extractedStartMs).toBe(-1);
    });

    it('should handle empty annotations', () => {
      const annotations: AnnotationFile = { words: [] };
      const extracted: Array<{ word: string; startMs: number; endMs: number }> = [];

      const result = calculateAccuracy(extracted, annotations, TOLERANCE_MS);

      expect(result.accuracy).toBe(0);
      expect(result.matchedCount).toBe(0);
      expect(result.totalCount).toBe(0);
    });
  });
});

describe('Audio File Format Validation', () => {
  it.each(FIXTURE_IDS)(
    'should have valid WAV format for %s',
    (id) => {
      const audio = loadAudioFixture(id);

      // WAV files start with 'RIFF' header
      const riffHeader = audio.toString('ascii', 0, 4);
      expect(riffHeader).toBe('RIFF');

      // WAV format tag at offset 8
      const waveTag = audio.toString('ascii', 8, 12);
      expect(waveTag).toBe('WAVE');
    }
  );

  it('should have correct file sizes for 30s and 60s audio', () => {
    // 24kHz * 16-bit * mono = 48000 bytes/sec
    // 30s = 1,440,000 bytes (+ 44 byte WAV header)
    // 60s = 2,880,000 bytes (+ 44 byte WAV header)
    const expectedSize30s = 30 * 24000 * 2 + 44; // 1,440,044
    const expectedSize60s = 60 * 24000 * 2 + 44; // 2,880,044

    for (const id of ['test-audio-01', 'test-audio-02', 'test-audio-03'] as FixtureId[]) {
      const audio = loadAudioFixture(id);
      expect(audio.length).toBe(expectedSize30s);
    }

    for (const id of ['test-audio-04', 'test-audio-05'] as FixtureId[]) {
      const audio = loadAudioFixture(id);
      expect(audio.length).toBe(expectedSize60s);
    }
  });
});

describe.skipIf(!process.env.GOOGLE_APPLICATION_CREDENTIALS)(
  'STT Accuracy Validation (Integration - Real STT)',
  () => {
    // This test requires Google Cloud credentials and will call real STT API
    // Only runs when GOOGLE_APPLICATION_CREDENTIALS env var is set

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should achieve >= 95% accuracy with real STT for test-audio-01', async () => {
      // Dynamic import to avoid mock interference - these are real calls
      const { SpeechClient } = await import('@google-cloud/speech');
      const client = new SpeechClient();

      const annotations = loadAnnotation('test-audio-01');
      const audio = loadAudioFixture('test-audio-01');

      const [operation] = await client.longRunningRecognize({
        audio: { content: audio.toString('base64') },
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 24000,
          languageCode: 'en-US',
          enableWordTimeOffsets: true,
          model: 'latest_long',
          useEnhanced: true,
        },
      });

      const [response] = await operation.promise();
      const extractedWords: Array<{ word: string; startMs: number; endMs: number }> = [];

      for (const result of response.results ?? []) {
        const alt = result.alternatives?.[0];
        if (!alt?.words) continue;
        for (const w of alt.words) {
          const startSec = Number(w.startTime?.seconds ?? 0);
          const startNanos = Number(w.startTime?.nanos ?? 0);
          const endSec = Number(w.endTime?.seconds ?? 0);
          const endNanos = Number(w.endTime?.nanos ?? 0);
          extractedWords.push({
            word: w.word ?? '',
            startMs: Math.round(startSec * 1000 + startNanos / 1_000_000),
            endMs: Math.round(endSec * 1000 + endNanos / 1_000_000),
          });
        }
      }

      await client.close();

      const result = calculateAccuracy(extractedWords, annotations, TOLERANCE_MS);
      expect(result.accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    }, 60_000); // 60s timeout for STT API call
  }
);
