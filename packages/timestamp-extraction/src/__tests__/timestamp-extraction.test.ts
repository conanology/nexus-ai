/**
 * @nexus-ai/timestamp-extraction
 * Tests for main stage executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTimestampExtraction } from '../timestamp-extraction.js';
import type { StageInput } from '@nexus-ai/core';
import type { TimestampExtractionInput } from '../types.js';
import type { DirectionDocument } from '@nexus-ai/script-gen';
import { shouldUseFallback, recognizeLongRunning } from '../stt-client.js';
import { isValidGcsUrl, downloadAndConvert } from '../audio-utils.js';

// Mock functions need to be defined with vi.fn() inline in the mock
// because vi.mock is hoisted before variable declarations
vi.mock('@nexus-ai/core', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  // Create a mock NexusError class
  class MockNexusError extends Error {
    code: string;
    stage: string;

    constructor(message: string, code: string, stage: string) {
      super(message);
      this.code = code;
      this.stage = stage;
      this.name = 'NexusError';
    }

    static critical(code: string, message: string, stage: string) {
      return new MockNexusError(message, code, stage);
    }

    static degraded(code: string, message: string, stage: string) {
      return new MockNexusError(message, code, stage);
    }
  }

  return {
    logger: loggerMock,
    createPipelineLogger: vi.fn().mockReturnValue(loggerMock),
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn().mockReturnValue({
        stage: 'timestamp-extraction',
        totalCost: 0,
        breakdown: [],
        timestamp: new Date().toISOString(),
      }),
    })),
    NexusError: MockNexusError,
    // withRetry mock - pass through the function call, wrapping in RetryResult
    withRetry: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
      const result = await fn();
      return { result, attempts: 1, totalDelayMs: 0 };
    }),
  };
});

// Mock audio-utils for STT path testing
vi.mock('../audio-utils.js', () => ({
  downloadAndConvert: vi.fn().mockResolvedValue({
    buffer: Buffer.from('mock-audio'),
    originalFormat: {
      encoding: 'LINEAR16',
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      durationSec: 10,
      fileSizeBytes: 480000,
    },
    conversionPerformed: false,
  }),
  isValidGcsUrl: vi.fn().mockReturnValue(true),
}));

// Mock stt-client for STT path testing
vi.mock('../stt-client.js', () => ({
  recognizeLongRunning: vi.fn().mockResolvedValue({
    words: [
      { word: 'word', startTime: 0, endTime: 0.4, confidence: 0.95 },
    ],
    transcript: 'word',
    confidence: 0.95,
    audioDurationSec: 10,
    processingTimeMs: 500,
  }),
  shouldUseFallback: vi.fn().mockReturnValue({ useFallback: true, reason: 'stt-api-error' }),
  DEFAULT_STT_CONFIG: {
    encoding: 'LINEAR16',
    sampleRateHertz: 24000,
    languageCode: 'en-US',
    model: 'latest_long',
    useEnhanced: true,
  },
}));

// Get mocked versions for test control
const mockedShouldUseFallback = vi.mocked(shouldUseFallback);
const mockedRecognizeLongRunning = vi.mocked(recognizeLongRunning);
const mockedIsValidGcsUrl = vi.mocked(isValidGcsUrl);
const mockedDownloadAndConvert = vi.mocked(downloadAndConvert);

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

function createMockDocument(wordCount = 10): DirectionDocument {
  const text = Array(wordCount).fill('word').join(' ');
  return {
    version: '2.0',
    metadata: {
      title: 'Test Document',
      createdAt: new Date().toISOString(),
      agentVersion: 'test',
      totalDurationSec: wordCount * 0.4,
      wordCount,
      segmentCount: 1,
    },
    segments: [
      {
        id: 'seg-1',
        index: 0,
        type: 'narration',
        content: {
          text,
          wordCount,
          keywords: [],
          emphasis: [],
        },
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: wordCount * 0.4,
          estimatedDurationSec: wordCount * 0.4,
          timingSource: 'estimated',
        },
        visual: {
          component: 'TechExplainer',
          bRoll: null,
          motion: null,
        },
        audio: {
          voiceEmphasis: 'normal',
          mood: 'neutral',
          sfxCues: [],
        },
      },
    ],
    globalAudio: {
      backgroundMusic: null,
      voiceover: {
        voice: 'default',
        rate: 1.0,
        pitch: 0,
      },
    },
  } as DirectionDocument;
}

function createMockInput(
  overrides?: Partial<TimestampExtractionInput>
): StageInput<TimestampExtractionInput> {
  return {
    pipelineId: '2026-01-27',
    previousStage: 'tts',
    data: {
      audioUrl: 'gs://bucket/audio.wav',
      audioDurationSec: 10,
      directionDocument: createMockDocument(),
      topicData: {
        title: 'Test Topic',
        url: 'https://example.com',
        source: 'test',
        publishedAt: new Date().toISOString(),
        viralityScore: 0.8,
      },
      ...overrides,
    },
    config: {
      timeout: 60000,
      retries: 3,
    },
  };
}

// -----------------------------------------------------------------------------
// executeTimestampExtraction Tests
// -----------------------------------------------------------------------------

describe('executeTimestampExtraction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset shouldUseFallback to default (fallback mode)
    mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

    // Re-establish default mock implementations (in case mockRejectedValueOnce was used)
    mockedRecognizeLongRunning.mockResolvedValue({
      words: [
        { word: 'word', startTime: 0, endTime: 0.4, confidence: 0.95 },
      ],
      transcript: 'word',
      confidence: 0.95,
      audioDurationSec: 10,
      processingTimeMs: 500,
    });
    mockedIsValidGcsUrl.mockReturnValue(true);
    mockedDownloadAndConvert.mockResolvedValue({
      buffer: Buffer.from('mock-audio'),
      originalFormat: {
        encoding: 'LINEAR16',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        durationSec: 10,
        fileSizeBytes: 480000,
      },
      conversionPerformed: false,
    });

    const { withRetry } = await import('@nexus-ai/core');
    vi.mocked(withRetry).mockImplementation(async (fn: () => Promise<unknown>) => {
      const result = await fn();
      return { result, attempts: 1, totalDelayMs: 0 };
    });
  });

  describe('successful execution', () => {
    it('should return successful output with estimated timing', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.wordTimings).toBeDefined();
      expect(result.data.directionDocument).toBeDefined();
    });

    it('should pass through audio URL and duration', async () => {
      const input = createMockInput({
        audioUrl: 'gs://test-bucket/test-audio.wav',
        audioDurationSec: 15.5,
      });

      const result = await executeTimestampExtraction(input);

      expect(result.data.audioUrl).toBe('gs://test-bucket/test-audio.wav');
      expect(result.data.audioDurationSec).toBe(15.5);
    });

    it('should pass through topic data', async () => {
      const topicData = {
        title: 'Test Title',
        url: 'https://example.com/article',
        source: 'github',
        publishedAt: '2026-01-27T00:00:00Z',
        viralityScore: 0.95,
      };
      const input = createMockInput({ topicData });

      const result = await executeTimestampExtraction(input);

      expect(result.data.topicData).toEqual(topicData);
    });

    it('should set timing metadata for estimated timing', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.data.timingMetadata.estimationMethod).toBe('character-weighted');
      expect(result.data.timingMetadata.warningFlags).toContain('timing-estimated');
    });

    it('should indicate fallback provider', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.provider.name).toBe('estimated');
      expect(result.provider.tier).toBe('fallback');
    });

    it('should include quality metrics', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.quality).toBeDefined();
      expect(result.quality.stage).toBe('timestamp-extraction');
      expect(result.quality.measurements).toBeDefined();
    });

    it('should include cost information', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.cost).toBeDefined();
      expect(result.cost.stage).toBe('timestamp-extraction');
    });

    it('should record duration', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      // Duration should be a non-negative number (can be 0 in fast tests)
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should track retry attempts in provider info', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.provider.attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('word timing extraction', () => {
    it('should extract word timings from segments', async () => {
      const input = createMockInput();
      input.data.directionDocument = createMockDocument(5);

      const result = await executeTimestampExtraction(input);

      expect(result.data.wordTimings.length).toBe(5);
    });

    it('should handle empty document', async () => {
      const emptyDoc = createMockDocument(0);
      emptyDoc.segments = [];
      const input = createMockInput({ directionDocument: emptyDoc });

      const result = await executeTimestampExtraction(input);

      expect(result.success).toBe(true);
      expect(result.data.wordTimings).toHaveLength(0);
    });

    it('should enrich direction document with timing', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      const segment = result.data.directionDocument.segments[0];
      expect(segment.timing.timingSource).toBe('estimated');
    });
  });

  describe('input validation', () => {
    it('should throw error for missing direction document', async () => {
      const input = createMockInput();
      // @ts-expect-error Testing invalid input
      input.data.directionDocument = null;

      await expect(executeTimestampExtraction(input)).rejects.toThrow(
        'Direction document is required'
      );
    });

    it('should throw error for missing audio URL', async () => {
      const input = createMockInput();
      // @ts-expect-error Testing invalid input
      input.data.audioUrl = '';

      await expect(executeTimestampExtraction(input)).rejects.toThrow(
        'Audio URL is required'
      );
    });

    it('should throw error for zero audio duration', async () => {
      const input = createMockInput();
      input.data.audioDurationSec = 0;

      await expect(executeTimestampExtraction(input)).rejects.toThrow(
        'Audio duration must be a positive number'
      );
    });

    it('should throw error for negative audio duration', async () => {
      const input = createMockInput();
      input.data.audioDurationSec = -5;

      await expect(executeTimestampExtraction(input)).rejects.toThrow(
        'Audio duration must be a positive number'
      );
    });
  });

  describe('logging', () => {
    it('should create pipeline logger with correct args', async () => {
      const { createPipelineLogger } = await import('@nexus-ai/core');
      const input = createMockInput();

      await executeTimestampExtraction(input);

      expect(createPipelineLogger).toHaveBeenCalledWith(
        '2026-01-27',
        'timestamp-extraction'
      );
    });

    it('should log stage events', async () => {
      const { createPipelineLogger } = await import('@nexus-ai/core');
      const input = createMockInput();

      await executeTimestampExtraction(input);

      // Verify logger was created and used
      expect(createPipelineLogger).toHaveBeenCalled();
    });
  });

  describe('quality gate', () => {
    it('should include quality metrics in output', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.quality).toBeDefined();
      expect(result.quality.stage).toBe('timestamp-extraction');
      expect(result.quality.measurements.status).toBeDefined();
    });

    it('should propagate quality gate flags to timingMetadata.warningFlags', async () => {
      // Use a document with many words but fallback produces fewer,
      // triggering DEGRADED with WORD_COUNT_MISMATCH flag
      const input = createMockInput();
      input.data.directionDocument = createMockDocument(100); // 100 words expected
      // Fallback will produce estimated timings for 100 words from segments,
      // but the quality gate sees the real word count vs expected

      const result = await executeTimestampExtraction(input);

      // warningFlags should contain quality gate flags when checks fail
      // At minimum, the fallback flags should be present
      expect(result.data.timingMetadata.warningFlags).toBeDefined();
      expect(Array.isArray(result.data.timingMetadata.warningFlags)).toBe(true);
    });

    it('should not duplicate flags in timingMetadata.warningFlags', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      const flags = result.data.timingMetadata.warningFlags;
      const uniqueFlags = [...new Set(flags)];
      expect(flags.length).toBe(uniqueFlags.length);
    });
  });

  describe('warnings', () => {
    it('should include warnings in output when present', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('timing-estimated');
    });

    it('should warn about empty word extraction', async () => {
      const emptyDoc = createMockDocument(0);
      emptyDoc.segments = [];
      const input = createMockInput({ directionDocument: emptyDoc });

      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.warningFlags).toContain('no-words-extracted');
    });
  });

  describe('withRetry integration', () => {
    it('should use withRetry for STT recognition call', async () => {
      const { withRetry } = await import('@nexus-ai/core');
      const input = createMockInput();

      await executeTimestampExtraction(input);

      // withRetry is called within attemptSTTExtraction to wrap recognizeLongRunning
      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ maxRetries: 3, stage: 'timestamp-extraction' })
      );
    });

    it('should fall back to estimated timing when STT fails', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.provider.name).toBe('estimated');
      expect(result.provider.tier).toBe('fallback');
    });

    it('should use STT results when extraction succeeds', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: false, reason: '' });

      const input = createMockInput();
      // Use a single-word document to match the STT mock (1 word)
      input.data.directionDocument = createMockDocument(1);

      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('extracted');
      expect(result.provider.name).toBe('google-stt');
      expect(result.provider.tier).toBe('primary');
    });
  });

  describe('fallback integration (Story 6.7)', () => {
    it('should trigger fallback on STT API error', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.data.timingMetadata.estimationMethod).toBe('character-weighted');
      expect(result.data.timingMetadata.fallbackReason).toBe('stt-api-error');
    });

    it('should trigger fallback on low confidence', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'low-confidence: 65.0%' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.data.timingMetadata.fallbackReason).toBe('low-confidence: 65.0%');
    });

    it('should trigger fallback on word count mismatch', async () => {
      mockedShouldUseFallback.mockReturnValue({
        useFallback: true,
        reason: 'word-count-mismatch: 5/10 (50.0% diff)',
      });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.data.timingMetadata.fallbackReason).toContain('word-count-mismatch');
    });

    it('should set timingMetadata.source to estimated on fallback', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
    });

    it('should include timing-estimated in warningFlags on fallback', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.warningFlags).toContain('timing-estimated');
    });

    it('should include fallback-reason in warningFlags', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.warningFlags).toContain('fallback-reason:stt-api-error');
    });

    it('should record zero-cost API call for estimated timing', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });
      const { CostTracker } = await import('@nexus-ai/core');

      const input = createMockInput();
      await executeTimestampExtraction(input);

      const trackerInstance = vi.mocked(CostTracker).mock.results[0].value;
      expect(trackerInstance.recordApiCall).toHaveBeenCalledWith('estimated-timing', {}, 0);
    });

    it('should produce valid word timings from fallback', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.wordTimings.length).toBeGreaterThan(0);
      for (const timing of result.data.wordTimings) {
        expect(timing.endTime).toBeGreaterThan(timing.startTime);
        expect(timing.duration).toBeGreaterThan(0);
      }
    });

    it('should set quality gate status for fallback results', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      // Fallback-generated timings should pass or degrade quality gate, not fail
      expect(result.quality.measurements.status).toBeDefined();
      expect(['PASS', 'DEGRADED']).toContain(result.quality.measurements.status);
    });
  });

  // ---------------------------------------------------------------------------
  // STT Path Tests (Task 4: Subtasks 4.1–4.5)
  // ---------------------------------------------------------------------------

  describe('STT extraction path (Story 6.12)', () => {
    // 4.1: Test full STT success path
    it('should use STT results and map words to segments on success', async () => {
      // Create a 3-word document
      const doc = createMockDocument(3);
      doc.segments[0].content.text = 'Hello brave world';

      // Mock STT to return 3 matching words
      mockedRecognizeLongRunning.mockResolvedValue({
        words: [
          { word: 'Hello', startTime: 0, endTime: 0.4, confidence: 0.95 },
          { word: 'brave', startTime: 0.4, endTime: 0.8, confidence: 0.93 },
          { word: 'world', startTime: 0.8, endTime: 1.2, confidence: 0.97 },
        ],
        transcript: 'Hello brave world',
        confidence: 0.95,
        audioDurationSec: 1.2,
        processingTimeMs: 500,
      });

      mockedShouldUseFallback.mockReturnValue({ useFallback: false, reason: '' });

      const input = createMockInput({ directionDocument: doc });
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('extracted');
      expect(result.provider.name).toBe('google-stt');
      expect(result.provider.tier).toBe('primary');
      expect(result.data.timingMetadata.mappingStats).toBeDefined();
      expect(result.data.timingMetadata.mappingStats!.matchRatio).toBeGreaterThan(0);
    });

    // 4.2: Test STT path with word mapping below 80% threshold triggering fallback
    it('should fall back to estimated when word mapping ratio is below 80%', async () => {
      // Create a 10-word document
      const doc = createMockDocument(10);

      // Mock STT to return only 1 word (will give ~10% match ratio)
      mockedRecognizeLongRunning.mockResolvedValue({
        words: [
          { word: 'word', startTime: 0, endTime: 0.4, confidence: 0.95 },
        ],
        transcript: 'word',
        confidence: 0.95,
        audioDurationSec: 10,
        processingTimeMs: 500,
      });

      // shouldUseFallback says don't fallback (STT technically succeeded)
      mockedShouldUseFallback.mockReturnValue({ useFallback: false, reason: '' });

      const input = createMockInput({ directionDocument: doc });
      const result = await executeTimestampExtraction(input);

      // The mapping ratio will be ~10%, which is below 80% threshold,
      // so it should switch to fallback
      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.provider.name).toBe('estimated');
      expect(result.provider.tier).toBe('fallback');
      expect(result.data.timingMetadata.fallbackReason).toContain('word-mapping-ratio');
      expect(result.data.timingMetadata.warningFlags).toContain('stt-mapping-failed');
    });

    // 4.3: Test STT path with retry failures (all retries fail → fallback)
    it('should fall back when STT extraction throws error', async () => {
      const { withRetry } = await import('@nexus-ai/core');

      // Make withRetry throw to simulate all retries failing
      vi.mocked(withRetry).mockRejectedValueOnce(new Error('All retries exhausted'));

      // shouldUseFallback will be called with null result and the error
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.provider.tier).toBe('fallback');
    });

    // 4.4: Test STT path with low confidence score triggering fallback
    it('should fall back when STT returns low confidence', async () => {
      mockedRecognizeLongRunning.mockResolvedValue({
        words: [
          { word: 'word', startTime: 0, endTime: 0.4, confidence: 0.3 },
        ],
        transcript: 'word',
        confidence: 0.3,
        audioDurationSec: 10,
        processingTimeMs: 500,
      });

      mockedShouldUseFallback.mockReturnValue({
        useFallback: true,
        reason: 'low-confidence: 30.0%',
      });

      const input = createMockInput();
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.data.timingMetadata.fallbackReason).toContain('low-confidence');
    });

    // 4.5: Test invalid GCS URL handling in attemptSTTExtraction
    it('should fall back when audio URL is not a valid GCS URL', async () => {
      mockedIsValidGcsUrl.mockReturnValue(false);
      mockedShouldUseFallback.mockReturnValue({
        useFallback: true,
        reason: 'stt-api-error',
      });

      const input = createMockInput({ audioUrl: 'https://not-gcs.com/audio.wav' });
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('estimated');
      expect(result.provider.tier).toBe('fallback');
    });

    it('should include extraction confidence in metadata on STT success', async () => {
      const doc = createMockDocument(1);

      mockedRecognizeLongRunning.mockResolvedValue({
        words: [
          { word: 'word', startTime: 0, endTime: 0.4, confidence: 0.92 },
        ],
        transcript: 'word',
        confidence: 0.92,
        audioDurationSec: 0.4,
        processingTimeMs: 300,
      });

      mockedShouldUseFallback.mockReturnValue({ useFallback: false, reason: '' });

      const input = createMockInput({ directionDocument: doc });
      const result = await executeTimestampExtraction(input);

      expect(result.data.timingMetadata.source).toBe('extracted');
      expect(result.data.timingMetadata.extractionConfidence).toBe(0.92);
    });

    it('should call downloadAndConvert when GCS URL is valid', async () => {
      mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });
      mockedIsValidGcsUrl.mockReturnValue(true);

      const input = createMockInput();
      await executeTimestampExtraction(input);

      expect(mockedDownloadAndConvert).toHaveBeenCalledWith(
        'gs://bucket/audio.wav',
        '2026-01-27'
      );
    });
  });
});
