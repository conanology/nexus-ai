/**
 * Tests for audio mixer integration in visual-gen (Story 6.26)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so variables are available inside vi.mock factories
const { mockUploadFile, mockLogger, mockMixAudio, mockMapCueWithFallback, mockRecordApiCall } = vi.hoisted(() => ({
  mockUploadFile: vi.fn().mockResolvedValue('gs://bucket/timeline.json'),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  mockMixAudio: vi.fn(),
  mockMapCueWithFallback: vi.fn().mockResolvedValue({
    component: 'DataFlowDiagram',
    props: { title: 'Test' },
    duration: 10,
    startTime: 0,
    endTime: 10,
  }),
  mockRecordApiCall: vi.fn(),
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => ({
  logger: mockLogger,
  CloudStorageClient: vi.fn().mockImplementation(() => ({
    uploadFile: mockUploadFile,
  })),
  executeStage: vi.fn(async (input: any, _stageName: string, executeFn: any) => {
    const config = {
      tracker: {
        recordApiCall: mockRecordApiCall,
        getSummary: vi.fn().mockReturnValue({ totalCost: 0 }),
      },
    };
    const data = await executeFn(input.data, config);
    return {
      success: true,
      data,
      quality: data.quality,
      cost: { totalCost: 0 },
      durationMs: 100,
      provider: data.provider,
      warnings: [],
    };
  }),
  NexusError: {
    critical: vi.fn((code: string, msg: string, stage: string) => new Error(`${code}: ${msg} [${stage}]`)),
    degraded: vi.fn((code: string, msg: string, stage: string) => new Error(`${code}: ${msg} [${stage}]`)),
  },
}));

// Mock @nexus-ai/audio-mixer
vi.mock('@nexus-ai/audio-mixer', () => ({
  mixAudio: mockMixAudio,
}));

// Mock internal visual-gen modules
vi.mock('../visual-cue-parser.js', () => ({
  parseVisualCues: vi.fn().mockReturnValue([
    { index: 0, description: 'Test visual cue', context: 'test', position: 0 },
  ]),
}));

vi.mock('../scene-mapper.js', () => ({
  SceneMapper: vi.fn().mockImplementation(() => ({
    mapCueWithFallback: mockMapCueWithFallback,
    getTotalCost: vi.fn().mockReturnValue(0),
    getFallbackUsage: vi.fn().mockReturnValue(0),
  })),
}));

vi.mock('../timeline.js', () => ({
  generateTimeline: vi.fn().mockReturnValue({
    audioDurationSec: 120,
    scenes: [
      { component: 'DataFlowDiagram', props: { title: 'Test' }, startTime: 0, duration: 120 },
    ],
  }),
}));

// Import after mocks
import { executeVisualGen } from '../visual-gen.js';
import type { StageInput } from '@nexus-ai/core';
import type { VisualGenInput } from '../types.js';

// Helper to create a direction document for V2 tests
function createDirectionDocument() {
  return {
    version: '2.0' as const,
    metadata: {
      title: 'Test',
      slug: 'test',
      estimatedDurationSec: 120,
      fps: 30 as const,
      resolution: { width: 1920 as const, height: 1080 as const },
      generatedAt: '2026-01-08T00:00:00Z',
    },
    segments: [
      {
        id: 'seg-1',
        type: 'narration' as const,
        timing: {
          estimatedStartSec: 0,
          estimatedDurationSec: 120,
          timingSource: 'estimated' as const,
        },
        scriptText: 'Test script',
        visualCue: 'Test visual',
        motion: { preset: 'none' as const },
      },
    ],
    globalAudio: {
      defaultMood: 'neutral' as const,
      musicTransitions: 'continue' as const,
    },
  };
}

function createBaseInput(overrides?: Partial<VisualGenInput>): StageInput<VisualGenInput> {
  return {
    pipelineId: '2026-01-28',
    previousStage: 'tts',
    data: {
      script: 'Test script [VISUAL: test visual]',
      audioUrl: 'gs://bucket/voice.wav',
      audioDurationSec: 120,
      ...overrides,
    },
    config: {} as any,
  };
}

describe('Audio Mixing Integration (Story 6.26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: render service returns success
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        videoUrl: 'gs://bucket/video.mp4',
        duration: 120,
        fileSize: 50000000,
      }),
      text: () => Promise.resolve(''),
    }));

    // Default: mixAudio succeeds
    mockMixAudio.mockResolvedValue({
      success: true,
      data: {
        mixedAudioUrl: 'gs://bucket/mixed.wav',
        originalAudioUrl: 'gs://bucket/voice.wav',
        duckingApplied: true,
        metrics: {
          voicePeakDb: -6,
          musicPeakDb: -18,
          mixedPeakDb: -3,
          duckingSegments: 5,
          sfxTriggered: 2,
          durationSec: 120,
        },
      },
      quality: { stage: 'audio-mixer', timestamp: '2026-01-28T00:00:00Z', measurements: {} },
      cost: { totalCost: 0.001 },
      durationMs: 500,
      provider: { name: 'ffmpeg', tier: 'primary', attempts: 1 },
    });
  });

  describe('AC1: Config Flag Check', () => {
    it('should call mixAudio when directionDocument exists and mixing not explicitly disabled', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      expect(mockMixAudio).toHaveBeenCalledTimes(1);
    });

    it('should skip mixing when no directionDocument exists', async () => {
      const input = createBaseInput();

      const result = await executeVisualGen(input);

      expect(mockMixAudio).not.toHaveBeenCalled();
      expect(result.data.finalAudioUrl).toBe('gs://bucket/voice.wav');
    });

    it('should call mixAudio when audioMixingEnabled is explicitly true', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
        audioMixingEnabled: true,
      });

      await executeVisualGen(input);

      expect(mockMixAudio).toHaveBeenCalledTimes(1);
    });

    it('should skip mixing when audioMixingEnabled is false', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
        audioMixingEnabled: false,
      });

      const result = await executeVisualGen(input);

      expect(mockMixAudio).not.toHaveBeenCalled();
      expect(result.data.finalAudioUrl).toBe('gs://bucket/voice.wav');
    });
  });

  describe('AC2: Call mixAudio', () => {
    it('should call mixAudio with correct parameters', async () => {
      const dirDoc = createDirectionDocument();
      const input = createBaseInput({
        directionDocument: dirDoc,
      });

      await executeVisualGen(input);

      expect(mockMixAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: '2026-01-28',
          previousStage: 'visual-gen',
          data: {
            voiceTrackUrl: 'gs://bucket/voice.wav',
            directionDocument: dirDoc,
            targetDurationSec: 120,
          },
        })
      );
    });
  });

  describe('AC3: VisualGenOutput Updated', () => {
    it('should include all three audio URL fields when mixing succeeds', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      const result = await executeVisualGen(input);

      expect(result.data.originalAudioUrl).toBe('gs://bucket/voice.wav');
      expect(result.data.mixedAudioUrl).toBe('gs://bucket/mixed.wav');
      expect(result.data.finalAudioUrl).toBe('gs://bucket/mixed.wav');
    });

    it('should include audio URL fields when mixing is skipped', async () => {
      const input = createBaseInput();

      const result = await executeVisualGen(input);

      expect(result.data.originalAudioUrl).toBe('gs://bucket/voice.wav');
      expect(result.data.mixedAudioUrl).toBeUndefined();
      expect(result.data.finalAudioUrl).toBe('gs://bucket/voice.wav');
    });
  });

  describe('AC4: Fallback Logic', () => {
    it('should fall back to original audio when mixAudio throws', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      const result = await executeVisualGen(input);

      expect(result.data.originalAudioUrl).toBe('gs://bucket/voice.wav');
      expect(result.data.mixedAudioUrl).toBeUndefined();
      expect(result.data.finalAudioUrl).toBe('gs://bucket/voice.wav');
    });

    it('should log a warning when mixing fails', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Audio mixing failed - using original TTS audio',
          pipelineId: '2026-01-28',
          stage: 'visual-gen',
        })
      );
    });

    it('should NOT fail the stage when mixing fails', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      // Should not throw
      const result = await executeVisualGen(input);
      expect(result.success).toBe(true);
    });
  });

  describe('AC5: Render Uses finalAudioUrl', () => {
    it('should pass mixed audio URL to render service when mixing succeeds', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.audioUrl).toBe('gs://bucket/mixed.wav');
    });

    it('should pass original audio URL to render service when mixing is skipped', async () => {
      const input = createBaseInput();

      await executeVisualGen(input);

      const fetchMock = vi.mocked(fetch);
      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.audioUrl).toBe('gs://bucket/voice.wav');
    });

    it('should pass original audio URL to render service when mixing fails', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      const fetchMock = vi.mocked(fetch);
      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.audioUrl).toBe('gs://bucket/voice.wav');
    });
  });

  describe('AC6: Quality Status Reflects Mixing', () => {
    it('should include audioMixingApplied: true when mixing succeeds', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      const result = await executeVisualGen(input);
      const measurements = result.quality?.measurements as any;

      expect(measurements.audioMixingApplied).toBe(true);
      expect(measurements.audioMixingFailed).toBe(false);
    });

    it('should include audioMixingApplied: false when mixing is skipped', async () => {
      const input = createBaseInput();

      const result = await executeVisualGen(input);
      const measurements = result.quality?.measurements as any;

      expect(measurements.audioMixingApplied).toBe(false);
      expect(measurements.audioMixingFailed).toBe(false);
    });

    it('should set qualityStatus to DEGRADED when mixing fails', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      const result = await executeVisualGen(input);
      const measurements = result.quality?.measurements as any;

      expect(measurements.audioMixingFailed).toBe(true);
      expect(measurements.audioMixingApplied).toBe(false);
      expect(measurements.qualityStatus).toBe('DEGRADED');
    });
  });

  describe('AC7: Cost Tracking', () => {
    it('should record audio-mixer costs when mixing succeeds', async () => {
      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      expect(mockMixAudio).toHaveBeenCalledTimes(1);
      expect(mockRecordApiCall).toHaveBeenCalledWith(
        'audio-mixer',
        { input: 0, output: 0 },
        0.001
      );
    });

    it('should NOT record audio-mixer costs when mixing fails', async () => {
      mockMixAudio.mockRejectedValueOnce(new Error('FFmpeg failed'));

      const input = createBaseInput({
        directionDocument: createDirectionDocument(),
      });

      await executeVisualGen(input);

      // recordApiCall may be called for scene mapper costs, but NOT for audio-mixer
      const audioMixerCalls = mockRecordApiCall.mock.calls.filter(
        (call: any[]) => call[0] === 'audio-mixer'
      );
      expect(audioMixerCalls).toHaveLength(0);
    });
  });
});
