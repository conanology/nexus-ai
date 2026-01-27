/**
 * Tests for stt-client module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_STT_CONFIG,
  FALLBACK_THRESHOLDS,
  shouldUseFallback,
} from '../stt-client.js';
import type { STTExtractionResult } from '../stt-client.js';

// Mock the Google Cloud Speech client
vi.mock('@google-cloud/speech', () => ({
  SpeechClient: vi.fn().mockImplementation(() => ({
    longRunningRecognize: vi.fn().mockResolvedValue([
      {
        promise: vi.fn().mockResolvedValue([
          {
            results: [
              {
                alternatives: [
                  {
                    transcript: 'Hello world',
                    confidence: 0.95,
                    words: [
                      {
                        word: 'Hello',
                        startTime: { seconds: '0', nanos: 0 },
                        endTime: { seconds: '0', nanos: 500000000 },
                      },
                      {
                        word: 'world',
                        startTime: { seconds: '0', nanos: 500000000 },
                        endTime: { seconds: '1', nanos: 0 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
      },
    ]),
    close: vi.fn(),
  })),
  protos: {
    google: {
      cloud: {
        speech: {
          v1: {
            RecognitionConfig: {
              AudioEncoding: {
                LINEAR16: 1,
                FLAC: 2,
                MP3: 8,
                OGG_OPUS: 6,
              },
            },
          },
        },
      },
    },
  },
}));

describe('DEFAULT_STT_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_STT_CONFIG.encoding).toBe('LINEAR16');
    expect(DEFAULT_STT_CONFIG.sampleRateHertz).toBe(24000);
    expect(DEFAULT_STT_CONFIG.languageCode).toBe('en-US');
    expect(DEFAULT_STT_CONFIG.model).toBe('latest_long');
    expect(DEFAULT_STT_CONFIG.useEnhanced).toBe(true);
  });
});

describe('FALLBACK_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(FALLBACK_THRESHOLDS.MIN_CONFIDENCE).toBe(0.8);
    expect(FALLBACK_THRESHOLDS.MAX_WORD_COUNT_MISMATCH).toBe(0.2);
    expect(FALLBACK_THRESHOLDS.MAX_API_TIMEOUT_MS).toBe(30000);
  });
});

describe('shouldUseFallback', () => {
  const createSTTResult = (
    confidence: number,
    wordCount: number
  ): STTExtractionResult => ({
    words: Array(wordCount)
      .fill(null)
      .map((_, i) => ({
        word: `word${i}`,
        startTime: i * 0.5,
        endTime: (i + 1) * 0.5,
        confidence,
      })),
    transcript: Array(wordCount)
      .fill(null)
      .map((_, i) => `word${i}`)
      .join(' '),
    confidence,
    audioDurationSec: wordCount * 0.5,
    processingTimeMs: 1000,
  });

  it('should use fallback when result is null', () => {
    const decision = shouldUseFallback(null, 10, null);
    expect(decision.useFallback).toBe(true);
    expect(decision.reason).toBe('stt-api-error');
  });

  it('should use fallback when error occurred', () => {
    const decision = shouldUseFallback(
      createSTTResult(0.95, 10),
      10,
      new Error('API error')
    );
    expect(decision.useFallback).toBe(true);
    expect(decision.reason).toBe('stt-api-error');
  });

  it('should use fallback when confidence is too low', () => {
    const decision = shouldUseFallback(createSTTResult(0.5, 10), 10, null);
    expect(decision.useFallback).toBe(true);
    expect(decision.reason).toContain('low-confidence');
  });

  it('should not use fallback when confidence meets threshold', () => {
    const decision = shouldUseFallback(createSTTResult(0.85, 10), 10, null);
    expect(decision.useFallback).toBe(false);
    expect(decision.reason).toBe('');
  });

  it('should use fallback when word count mismatch exceeds threshold', () => {
    // 30% mismatch (expected 10, got 7) should trigger fallback
    const decision = shouldUseFallback(createSTTResult(0.95, 7), 10, null);
    expect(decision.useFallback).toBe(true);
    expect(decision.reason).toContain('word-count-mismatch');
  });

  it('should not use fallback when word count mismatch is within threshold', () => {
    // 10% mismatch (expected 10, got 9) should be OK
    const decision = shouldUseFallback(createSTTResult(0.95, 9), 10, null);
    expect(decision.useFallback).toBe(false);
    expect(decision.reason).toBe('');
  });

  it('should not check word count mismatch when expected count is 0', () => {
    const decision = shouldUseFallback(createSTTResult(0.95, 5), 0, null);
    expect(decision.useFallback).toBe(false);
  });

  it('should not use fallback when confidence is exactly at threshold', () => {
    // 80% is exactly at threshold (check is <, not <=, so 0.8 passes)
    const decision = shouldUseFallback(createSTTResult(0.8, 10), 10, null);
    expect(decision.useFallback).toBe(false);
  });

  it('should use fallback when confidence is just below threshold', () => {
    const decision = shouldUseFallback(createSTTResult(0.79, 10), 10, null);
    expect(decision.useFallback).toBe(true);
    expect(decision.reason).toContain('low-confidence');
  });

  it('should not use fallback when confidence is just above threshold', () => {
    const decision = shouldUseFallback(createSTTResult(0.81, 10), 10, null);
    expect(decision.useFallback).toBe(false);
    expect(decision.reason).toBe('');
  });
});
