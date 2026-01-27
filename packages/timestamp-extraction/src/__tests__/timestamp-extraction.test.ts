/**
 * @nexus-ai/timestamp-extraction
 * Tests for main stage executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTimestampExtraction } from '../timestamp-extraction.js';
import type { StageInput } from '@nexus-ai/core';
import type { TimestampExtractionInput } from '../types.js';
import type { DirectionDocument } from '@nexus-ai/script-gen';

// Mock functions need to be defined with vi.fn() inline in the mock
// because vi.mock is hoisted before variable declarations
vi.mock('@nexus-ai/core', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
  };
});

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
});
