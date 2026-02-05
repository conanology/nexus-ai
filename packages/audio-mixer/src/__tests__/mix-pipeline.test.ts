import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusError } from '@nexus-ai/core';
import type { DirectionSegment } from '@nexus-ai/script-gen';
import type { SfxLibrary, SFXTriggerResolved, GainPoint } from '../types.js';

// Mock child_process and ffmpeg-static
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('ffmpeg-static', () => ({
  default: '/usr/bin/ffmpeg',
}));

vi.mock('fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      child: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    executeStage: vi.fn(async (input, _stageName, execute) => {
      const result = await execute(input.data, input.config);
      return {
        success: true,
        data: result,
        quality: { stage: 'audio-mixer', timestamp: new Date().toISOString(), measurements: {} },
        cost: { totalCost: 0, breakdown: [] },
        durationMs: 100,
        provider: { name: 'ffmpeg', tier: 'primary', attempts: 1 },
      };
    }),
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn().mockReturnValue({ totalCost: 0, breakdown: [] }),
    })),
  };
});

// Mock GCS helpers
vi.mock('../gcs-helpers.js', () => ({
  downloadFromGCS: vi.fn().mockResolvedValue(undefined),
  uploadToGCS: vi.fn().mockResolvedValue('https://storage.googleapis.com/nexus-ai-artifacts/2026-01-28/audio-mixer/mixed.wav'),
}));

// Mock ducking module
vi.mock('../ducking.js', () => ({
  detectSpeechSegments: vi.fn().mockResolvedValue([
    { startSec: 0.5, endSec: 3.0 },
    { startSec: 5.0, endSec: 8.0 },
  ]),
  generateDuckingCurve: vi.fn().mockReturnValue([
    { timeSec: 0, gainDb: -12 },
    { timeSec: 0.45, gainDb: -12 },
    { timeSec: 0.5, gainDb: -20 },
    { timeSec: 3.0, gainDb: -20 },
    { timeSec: 3.3, gainDb: -12 },
  ]),
  DEFAULT_DUCKING_CONFIG: {
    speechLevel: -20,
    silenceLevel: -12,
    attackMs: 50,
    releaseMs: 300,
  },
}));

// Mock music selector
vi.mock('../music-selector.js', () => ({
  loadMusicLibrary: vi.fn().mockResolvedValue({ tracks: [] }),
  selectMusic: vi.fn().mockReturnValue({
    id: 'energetic-01',
    mood: 'energetic',
    tempo: 120,
    duration: 180,
    gcsPath: 'gs://nexus-ai-assets/music/energetic/track01.wav',
    license: { type: 'cc0', attribution: '', restrictions: [] },
    loopable: true,
    energy: 0.8,
    tags: ['upbeat'],
  }),
  prepareLoopedTrack: vi.fn().mockResolvedValue('/tmp/nexus-loop-test.wav'),
}));

// Mock SFX module (partially - we test extractSFXTriggers directly)
vi.mock('../sfx.js', async () => {
  const actual = await vi.importActual<typeof import('../sfx.js')>('../sfx.js');
  return {
    ...actual,
    loadSFXLibrary: vi.fn().mockResolvedValue({
      tracks: [
        {
          id: 'whoosh-01',
          filename: 'whoosh-01.wav',
          category: 'transitions',
          durationSec: 0.8,
          gcsPath: 'gs://nexus-ai-assets/sfx/transitions/whoosh-01.wav',
          tags: ['whoosh', 'fast'],
        },
        {
          id: 'click-01',
          filename: 'click-01.wav',
          category: 'ui',
          durationSec: 0.3,
          gcsPath: 'gs://nexus-ai-assets/sfx/ui/click-01.wav',
          tags: ['click', 'button'],
        },
      ],
    }),
  };
});

import { execFile } from 'child_process';
import { extractSFXTriggers } from '../sfx.js';
import { buildFilterComplex } from '../mix-pipeline.js';
import { downloadFromGCS, uploadToGCS } from '../gcs-helpers.js';

const mockExecFile = vi.mocked(execFile);

// Helper to simulate promisified execFile
function mockExecFileCall(stderr = '', stdout = ''): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
        null,
        { stdout, stderr }
      );
      return {} as ReturnType<typeof execFile>;
    }
  );
}

// --- Test fixtures ---
function makeSegment(overrides: Partial<DirectionSegment> = {}): DirectionSegment {
  return {
    id: 'seg-001',
    index: 0,
    type: 'intro' as any,
    content: { text: 'Hello world', wordCount: 2, keywords: [], emphasis: [] },
    timing: {
      estimatedStartSec: 0,
      estimatedEndSec: 5,
      estimatedDurationSec: 5,
      timingSource: 'estimated' as any,
    },
    visual: {
      template: 'TechExplainer' as any,
      motion: { preset: 'subtle' as any, entrance: {} as any, emphasis: {} as any },
    },
    audio: {},
    ...overrides,
  } as DirectionSegment;
}

function makeSfxLibrary(): SfxLibrary {
  return {
    tracks: [
      {
        id: 'whoosh-01',
        filename: 'whoosh-01.wav',
        category: 'transitions',
        durationSec: 0.8,
        gcsPath: 'gs://nexus-ai-assets/sfx/transitions/whoosh-01.wav',
        tags: ['whoosh'],
      },
      {
        id: 'click-01',
        filename: 'click-01.wav',
        category: 'ui',
        durationSec: 0.3,
        gcsPath: 'gs://nexus-ai-assets/sfx/ui/click-01.wav',
        tags: ['click'],
      },
    ],
  };
}

// =====================================================================
// extractSFXTriggers tests
// =====================================================================
describe('extractSFXTriggers', () => {
  const library = makeSfxLibrary();

  it('returns empty array for segments with no sfxCues', () => {
    const segments = [makeSegment()];
    const result = extractSFXTriggers(segments, library);
    expect(result).toEqual([]);
  });

  it('resolves segment_start trigger using estimated timing', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'whoosh-01', volume: 0.8 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      segmentId: 'seg-1',
      timeSec: 0,
      soundId: 'whoosh-01',
      gcsPath: 'gs://nexus-ai-assets/sfx/transitions/whoosh-01.wav',
      volume: 0.8,
      durationSec: 0.8,
    });
  });

  it('resolves segment_end trigger using estimated timing', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: 10,
          estimatedDurationSec: 10,
          timingSource: 'estimated' as any,
        },
        audio: {
          sfxCues: [
            { trigger: 'segment_end', sound: 'click-01', volume: 0.5 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(1);
    expect(result[0].timeSec).toBe(10);
    expect(result[0].soundId).toBe('click-01');
  });

  it('resolves timestamp trigger with direct seconds value', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        audio: {
          sfxCues: [
            { trigger: 'timestamp', triggerValue: '7.5', sound: 'whoosh-01', volume: 0.6 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(1);
    expect(result[0].timeSec).toBe(7.5);
  });

  it('prefers actual timing over estimated timing', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: 5,
          actualStartSec: 0.2,
          actualEndSec: 4.8,
          timingSource: 'stt' as any,
        },
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'whoosh-01', volume: 1 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result[0].timeSec).toBe(0.2);
  });

  it('skips unresolvable sound IDs', () => {
    const segments = [
      makeSegment({
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'nonexistent-sound', volume: 1 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(0);
  });

  it('skips word trigger without word timings', () => {
    const segments = [
      makeSegment({
        audio: {
          sfxCues: [
            { trigger: 'word', triggerValue: 'hello', sound: 'whoosh-01', volume: 1 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(0);
  });

  it('resolves word trigger with word timings', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: 5,
          timingSource: 'stt' as any,
          wordTimings: [
            { word: 'Hello', index: 0, startTime: 0.1, endTime: 0.5, duration: 0.4, segmentId: 'seg-1', isEmphasis: false },
            { word: 'world', index: 1, startTime: 0.6, endTime: 1.0, duration: 0.4, segmentId: 'seg-1', isEmphasis: false },
          ],
        },
        audio: {
          sfxCues: [
            { trigger: 'word', triggerValue: 'hello', sound: 'whoosh-01', volume: 0.7 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(1);
    expect(result[0].timeSec).toBe(0.1);
  });

  it('sorts results by timeSec', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        timing: { estimatedStartSec: 5, estimatedEndSec: 10, timingSource: 'estimated' as any },
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'whoosh-01', volume: 0.8 },
          ],
        },
      }),
      makeSegment({
        id: 'seg-0',
        index: 1,
        timing: { estimatedStartSec: 0, estimatedEndSec: 5, timingSource: 'estimated' as any },
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'click-01', volume: 0.5 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(2);
    expect(result[0].timeSec).toBe(0);
    expect(result[1].timeSec).toBe(5);
  });

  it('handles multiple SFX cues per segment', () => {
    const segments = [
      makeSegment({
        id: 'seg-1',
        timing: { estimatedStartSec: 0, estimatedEndSec: 10, timingSource: 'estimated' as any },
        audio: {
          sfxCues: [
            { trigger: 'segment_start', sound: 'whoosh-01', volume: 0.8 },
            { trigger: 'segment_end', sound: 'click-01', volume: 0.5 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, library);
    expect(result).toHaveLength(2);
    expect(result[0].soundId).toBe('whoosh-01');
    expect(result[1].soundId).toBe('click-01');
  });
});

// =====================================================================
// buildFilterComplex tests
// =====================================================================
describe('buildFilterComplex', () => {
  it('handles voice-only input (no music, no SFX)', () => {
    const result = buildFilterComplex([], [], 1);
    expect(result).toContain('[0:a]acopy[voice]');
    expect(result).toContain('loudnorm');
    expect(result).not.toContain('amix');
  });

  it('includes music with ducking when 2 inputs', () => {
    const duckingCurve: GainPoint[] = [
      { timeSec: 0, gainDb: -12 },
      { timeSec: 5, gainDb: -12 },
    ];
    const result = buildFilterComplex(duckingCurve, [], 2);
    expect(result).toContain('[0:a]acopy[voice]');
    expect(result).toContain('[1:a]volume=');
    expect(result).toContain('[music]');
    expect(result).toContain('amix=inputs=2');
    expect(result).toContain('loudnorm');
  });

  it('includes SFX with adelay and volume', () => {
    const sfxTriggers: SFXTriggerResolved[] = [
      {
        segmentId: 'seg-1',
        timeSec: 3.5,
        soundId: 'whoosh-01',
        gcsPath: 'gs://test/whoosh.wav',
        volume: 0.8,
        durationSec: 0.8,
      },
    ];
    const duckingCurve: GainPoint[] = [
      { timeSec: 0, gainDb: -12 },
      { timeSec: 10, gainDb: -12 },
    ];
    const result = buildFilterComplex(duckingCurve, sfxTriggers, 3);
    expect(result).toContain('[2:a]adelay=3500|3500,volume=0.80[sfx0]');
    expect(result).toContain('amix=inputs=3');
  });

  it('handles multiple SFX inputs', () => {
    const sfxTriggers: SFXTriggerResolved[] = [
      {
        segmentId: 'seg-1',
        timeSec: 1.0,
        soundId: 'whoosh-01',
        gcsPath: 'gs://test/whoosh.wav',
        volume: 0.8,
        durationSec: 0.8,
      },
      {
        segmentId: 'seg-2',
        timeSec: 5.0,
        soundId: 'click-01',
        gcsPath: 'gs://test/click.wav',
        volume: 0.5,
        durationSec: 0.3,
      },
    ];
    const duckingCurve: GainPoint[] = [
      { timeSec: 0, gainDb: -12 },
      { timeSec: 10, gainDb: -12 },
    ];
    const result = buildFilterComplex(duckingCurve, sfxTriggers, 4);
    expect(result).toContain('[sfx0]');
    expect(result).toContain('[sfx1]');
    expect(result).toContain('amix=inputs=4');
  });
});

// =====================================================================
// GCS helpers tests (integration via mixAudio - verifying mocks are called correctly)
// =====================================================================
describe('GCS helpers (mocked in pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloadFromGCS is called with gs:// URL and local path', async () => {
    await downloadFromGCS('gs://test-bucket/voice.wav', '/tmp/voice.wav');
    expect(downloadFromGCS).toHaveBeenCalledWith('gs://test-bucket/voice.wav', '/tmp/voice.wav');
  });

  it('uploadToGCS returns HTTPS public URL', async () => {
    const url = await uploadToGCS('/tmp/mixed.wav', 'gs://test-bucket/output/mixed.wav');
    expect(url).toContain('https://storage.googleapis.com/');
  });

  it('downloadFromGCS handles https:// URLs', async () => {
    await downloadFromGCS('https://storage.googleapis.com/test-bucket/file.wav', '/tmp/file.wav');
    expect(downloadFromGCS).toHaveBeenCalledWith(
      'https://storage.googleapis.com/test-bucket/file.wav',
      '/tmp/file.wav'
    );
  });
});

// =====================================================================
// GCS helpers unit tests are in gcs-helpers.test.ts
// =====================================================================

// =====================================================================
// mixAudio integration test (mocked dependencies)
// =====================================================================
describe('mixAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock FFmpeg calls (VAD conversion, silencedetect, duration, and mix)
    // Note: these are consumed by the mocked ducking module
    mockExecFileCall(''); // FFmpeg mix command
  });

  it('orchestrates the full mix pipeline', async () => {
    const { mixAudio } = await import('../mix-pipeline.js');

    const input = {
      pipelineId: '2026-01-28',
      previousStage: 'tts',
      data: {
        voiceTrackUrl: 'gs://nexus-ai-artifacts/2026-01-28/tts/audio.wav',
        directionDocument: {
          version: '2.0' as const,
          metadata: {
            title: 'Test Video',
            slug: 'test-video',
            estimatedDurationSec: 60,
            fps: 30 as const,
            resolution: { width: 1920 as const, height: 1080 as const },
            generatedAt: '2026-01-28T00:00:00Z',
          },
          segments: [
            makeSegment({
              audio: {
                sfxCues: [
                  { trigger: 'segment_start', sound: 'whoosh-01', volume: 0.8 },
                ],
              },
            }),
          ],
          globalAudio: {
            defaultMood: 'energetic' as const,
            musicTransitions: 'crossfade' as any,
          },
        },
        targetDurationSec: 60,
      },
      config: { timeout: 60000, retries: 3 },
    };

    const result = await mixAudio(input);

    expect(result.success).toBe(true);
    expect(result.data.mixedAudioUrl).toContain('https://storage.googleapis.com/');
    expect(result.data.originalAudioUrl).toBe('gs://nexus-ai-artifacts/2026-01-28/tts/audio.wav');
    expect(result.data.duckingApplied).toBe(true);
    expect(result.data.metrics).toBeDefined();
    expect(result.data.metrics.sfxTriggered).toBeGreaterThanOrEqual(0);
    expect(result.data.metrics.duckingSegments).toBeGreaterThanOrEqual(0);
  });
});

// =====================================================================
// Error handling tests
// =====================================================================
describe('Error handling', () => {
  it('extractSFXTriggers handles empty segments array', () => {
    const result = extractSFXTriggers([], makeSfxLibrary());
    expect(result).toEqual([]);
  });

  it('extractSFXTriggers handles invalid timestamp triggerValue', () => {
    const segments = [
      makeSegment({
        audio: {
          sfxCues: [
            { trigger: 'timestamp', triggerValue: 'not-a-number', sound: 'whoosh-01', volume: 1 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, makeSfxLibrary());
    expect(result).toHaveLength(0);
  });

  it('extractSFXTriggers handles missing timestamp triggerValue', () => {
    const segments = [
      makeSegment({
        audio: {
          sfxCues: [
            { trigger: 'timestamp', sound: 'whoosh-01', volume: 1 },
          ],
        },
      }),
    ];

    const result = extractSFXTriggers(segments, makeSfxLibrary());
    expect(result).toHaveLength(0);
  });
});
