/**
 * @nexus-ai/timestamp-extraction
 * Tests for main stage executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTimestampExtraction } from '../timestamp-extraction.js';
import type { StageInput } from '@nexus-ai/core';
import type { TimestampExtractionInput } from '../types.js';
import type { DirectionDocument } from '@nexus-ai/script-gen';
import { shouldUseFallback } from '../stt-client.js';

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

// Get mocked version for test control
const mockedShouldUseFallback = vi.mocked(shouldUseFallback);

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
        type: 'explanation',
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shouldUseFallback to default (fallback mode)
    mockedShouldUseFallback.mockReturnValue({ useFallback: true, reason: 'stt-api-error' });
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
      expect(result.data.timingMetadata.warningFlags).toContain('estimated-timing-used');
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
  });

  describe('warnings', () => {
    it('should include warnings in output when present', async () => {
      const input = createMockInput();

      const result = await executeTimestampExtraction(input);

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('estimated-timing-used');
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
});
