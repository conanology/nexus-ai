/**
 * Pipeline data flow integration tests for timestamp data
 * Story 6.11: Verify directionDocument flows through TTS → timestamp-extraction → visual-gen
 *
 * These tests verify the type contract between pipeline stages. Since buildStageInput<T>()
 * is a generic wrapper that passes previousData as data: T, the critical integration point
 * is that output types from one stage are assignment-compatible with input types of the next.
 * These tests validate that contract at compile time (via explicit type annotations) and
 * at runtime (via structural assertions).
 */

import { describe, it, expect } from 'vitest';
import type { TTSInput, TTSOutput } from '@nexus-ai/tts';
import type { TimestampExtractionInput } from '@nexus-ai/timestamp-extraction';
import type { DirectionDocument, WordTiming } from '@nexus-ai/script-gen';

// =============================================================================
// Shared Test Fixtures
// =============================================================================

function createMockDirectionDocument(opts?: { withActualTimings?: boolean }): DirectionDocument {
  return {
    version: '2.0',
    metadata: {
      title: 'Test Video: AI Advances',
      slug: 'test-video-ai-advances',
      estimatedDurationSec: 120,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      generatedAt: '2026-01-08T00:00:00Z',
    },
    segments: [
      {
        id: 'seg-intro',
        index: 0,
        type: 'intro',
        content: {
          text: 'Welcome to our AI roundup',
          wordCount: 5,
          keywords: ['AI'],
          emphasis: [],
        },
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: 5,
          estimatedDurationSec: 5,
          ...(opts?.withActualTimings ? {
            actualStartSec: 0.1,
            actualEndSec: 4.8,
            actualDurationSec: 4.7,
          } : {}),
          timingSource: opts?.withActualTimings ? 'extracted' : 'estimated',
        },
        visual: {
          template: 'TextOnGradient',
          motion: {
            entrance: { type: 'fade', delay: 0, duration: 15, easing: 'easeOut' },
            emphasis: { type: 'none', trigger: 'none', intensity: 0, duration: 0 },
            exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
          },
        },
        audio: { mood: 'energetic' },
      },
      {
        id: 'seg-explain',
        index: 1,
        type: 'explanation',
        content: {
          text: 'Today we explore new breakthroughs',
          wordCount: 6,
          keywords: ['breakthroughs'],
          emphasis: [{ word: 'breakthroughs', effect: 'glow', intensity: 0.5 }],
        },
        timing: {
          estimatedStartSec: 5,
          estimatedEndSec: 15,
          estimatedDurationSec: 10,
          ...(opts?.withActualTimings ? {
            actualStartSec: 4.8,
            actualEndSec: 14.2,
            actualDurationSec: 9.4,
          } : {}),
          timingSource: opts?.withActualTimings ? 'extracted' : 'estimated',
        },
        visual: {
          template: 'DataFlowDiagram',
          motion: {
            entrance: { type: 'slide', direction: 'up', delay: 0, duration: 15, easing: 'spring' },
            emphasis: { type: 'pulse', trigger: 'onWord', intensity: 0.3, duration: 10 },
            exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
          },
        },
        audio: { mood: 'contemplative' },
      },
    ],
    globalAudio: {
      defaultMood: 'neutral',
      musicTransitions: 'continue',
    },
  };
}

function createMockWordTimings(): WordTiming[] {
  return [
    { word: 'Welcome', index: 0, startTime: 0.1, endTime: 0.5, duration: 0.4, segmentId: 'seg-intro', isEmphasis: false },
    { word: 'to', index: 1, startTime: 0.5, endTime: 0.6, duration: 0.1, segmentId: 'seg-intro', isEmphasis: false },
    { word: 'our', index: 2, startTime: 0.6, endTime: 0.8, duration: 0.2, segmentId: 'seg-intro', isEmphasis: false },
    { word: 'AI', index: 3, startTime: 0.8, endTime: 1.2, duration: 0.4, segmentId: 'seg-intro', isEmphasis: false },
    { word: 'roundup', index: 4, startTime: 1.2, endTime: 1.8, duration: 0.6, segmentId: 'seg-intro', isEmphasis: false },
  ];
}

// =============================================================================
// Test: TTS output includes directionDocument (AC: 1, subtask 5.1)
// =============================================================================

describe('Pipeline Data Flow: TTS output includes directionDocument', () => {
  it('should include directionDocument in TTS output type when provided in input', () => {
    const directionDocument = createMockDirectionDocument();

    // Simulate TTS input with directionDocument
    const ttsInput: TTSInput = {
      ssmlScript: '<speak>Welcome to our AI roundup</speak>',
      directionDocument,
    };

    // Simulate TTS output (pass-through pattern matching topicData)
    const ttsOutput: TTSOutput = {
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      durationSec: 120,
      format: 'wav',
      sampleRate: 44100,
      directionDocument, // Pass-through
    };

    expect(ttsInput.directionDocument).toBeDefined();
    expect(ttsOutput.directionDocument).toBeDefined();
    expect(ttsOutput.directionDocument).toEqual(directionDocument);
    expect(ttsOutput.directionDocument!.version).toBe('2.0');
    expect(ttsOutput.directionDocument!.segments).toHaveLength(2);
  });

  it('should allow TTS output without directionDocument (V1 backward compat)', () => {
    const ttsOutput: TTSOutput = {
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      durationSec: 120,
      format: 'wav',
      sampleRate: 44100,
    };

    expect(ttsOutput.directionDocument).toBeUndefined();
  });
});

// =============================================================================
// Test: timestamp-extraction receives directionDocument from TTS (subtask 5.2)
// =============================================================================

describe('Pipeline Data Flow: timestamp-extraction receives directionDocument from TTS', () => {
  it('should construct valid TimestampExtractionInput from TTS output', () => {
    const directionDocument = createMockDirectionDocument();

    // Simulate TTS output
    const ttsOutput: TTSOutput = {
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      durationSec: 120,
      format: 'wav',
      sampleRate: 44100,
      directionDocument,
    };

    // Simulate buildStageInput extracting data for timestamp-extraction
    // The generic buildStageInput passes previousData as data: T
    const timestampInput: TimestampExtractionInput = {
      audioUrl: ttsOutput.audioUrl,
      audioDurationSec: ttsOutput.durationSec,
      directionDocument: ttsOutput.directionDocument!,
    };

    expect(timestampInput.directionDocument).toBeDefined();
    expect(timestampInput.directionDocument.version).toBe('2.0');
    expect(timestampInput.directionDocument.segments).toHaveLength(2);
    expect(timestampInput.audioUrl).toBe(ttsOutput.audioUrl);
    expect(timestampInput.audioDurationSec).toBe(ttsOutput.durationSec);
  });

  it('should have directionDocument with estimated timings before extraction', () => {
    const directionDocument = createMockDirectionDocument({ withActualTimings: false });

    expect(directionDocument.segments[0].timing.timingSource).toBe('estimated');
    expect(directionDocument.segments[0].timing.estimatedStartSec).toBe(0);
    expect(directionDocument.segments[0].timing.actualStartSec).toBeUndefined();
  });
});

// =============================================================================
// Test: visual-gen receives enriched directionDocument with word timings (subtask 5.3)
// =============================================================================

describe('Pipeline Data Flow: visual-gen receives enriched directionDocument', () => {
  it('should accept enriched directionDocument with actual timings from timestamp-extraction', () => {
    const enrichedDoc = createMockDirectionDocument({ withActualTimings: true });
    const wordTimings = createMockWordTimings();

    // Simulate timestamp-extraction output → visual-gen input
    // buildStageInput passes previousData as data, so visual-gen gets:
    const visualGenInputData = {
      script: 'Welcome to our AI roundup. Today we explore new breakthroughs',
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      audioDurationSec: 120,
      directionDocument: enrichedDoc,
      wordTimings,
    };

    expect(visualGenInputData.directionDocument).toBeDefined();
    expect(visualGenInputData.directionDocument.segments[0].timing.timingSource).toBe('extracted');
    expect(visualGenInputData.directionDocument.segments[0].timing.actualStartSec).toBe(0.1);
    expect(visualGenInputData.directionDocument.segments[0].timing.actualEndSec).toBe(4.8);
    expect(visualGenInputData.wordTimings).toHaveLength(5);
    expect(visualGenInputData.wordTimings[0].word).toBe('Welcome');
    expect(visualGenInputData.wordTimings[0].segmentId).toBe('seg-intro');
  });

  it('should contain segment-level timing data for scene generation', () => {
    const enrichedDoc = createMockDirectionDocument({ withActualTimings: true });

    // Verify each segment has both estimated and actual timings
    for (const segment of enrichedDoc.segments) {
      expect(segment.timing.estimatedStartSec).toBeDefined();
      expect(segment.timing.actualStartSec).toBeDefined();
      expect(segment.timing.actualDurationSec).toBeDefined();
      expect(segment.timing.timingSource).toBe('extracted');
    }
  });
});

// =============================================================================
// Test: V1 backward compatibility (subtask 5.4)
// =============================================================================

describe('Pipeline Data Flow: V1 backward compatibility', () => {
  it('should allow V1 flow without directionDocument through TTS', () => {
    // V1 TTS input - no directionDocument
    const ttsInput: TTSInput = {
      ssmlScript: '<speak>Hello world</speak>',
    };

    // V1 TTS output - no directionDocument
    const ttsOutput: TTSOutput = {
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      durationSec: 60,
      format: 'wav',
      sampleRate: 44100,
    };

    expect(ttsInput.directionDocument).toBeUndefined();
    expect(ttsOutput.directionDocument).toBeUndefined();
  });

  it('should allow visual-gen to work without directionDocument (V1 script path)', () => {
    // V1 visual-gen input - script string only, no directionDocument
    const visualGenInput = {
      script: 'Hello world [VISUAL: neural network]',
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      audioDurationSec: 60,
    };

    expect(visualGenInput.script).toBeDefined();
    expect((visualGenInput as any).directionDocument).toBeUndefined();
    expect((visualGenInput as any).wordTimings).toBeUndefined();
  });

  it('should preserve topicData pass-through alongside directionDocument', () => {
    const topicData = {
      title: 'AI News',
      url: 'https://example.com',
      source: 'hackernews',
      publishedAt: '2026-01-08',
      viralityScore: 85,
    };

    const ttsOutput: TTSOutput = {
      audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
      durationSec: 120,
      format: 'wav',
      sampleRate: 44100,
      topicData,
      directionDocument: createMockDirectionDocument(),
    };

    expect(ttsOutput.topicData).toEqual(topicData);
    expect(ttsOutput.directionDocument).toBeDefined();
  });
});
