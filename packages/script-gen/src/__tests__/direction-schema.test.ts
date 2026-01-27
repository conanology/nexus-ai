/**
 * Tests for Direction Document Schema validation
 * @module @nexus-ai/script-gen/tests/direction-schema
 */

import { describe, it, expect } from 'vitest';
import {
  DirectionDocumentSchema,
  DirectionSegmentSchema,
  MotionConfigSchema,
  EmphasisWordSchema,
  WordTimingSchema,
  SFXCueSchema,
  BRollSpecSchema,
  SegmentContentSchema,
  SegmentTimingSchema,
  SegmentVisualSchema,
  SegmentAudioSchema,
  validateDirectionDocument,
  safeValidateDirectionDocument,
  isV2Output,
  MOTION_PRESETS,
  type DirectionDocument,
  type DirectionSegment,
  type ScriptGenOutputV1,
  type ScriptGenOutputV2,
} from '../types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createValidSegment = (overrides?: Partial<DirectionSegment>): DirectionSegment => ({
  id: 'seg-001',
  index: 0,
  type: 'intro',
  content: {
    text: 'Welcome to this video about AI technology.',
    wordCount: 7,
    keywords: ['AI', 'technology'],
    emphasis: [{ word: 'AI', effect: 'glow', intensity: 0.8 }],
  },
  timing: {
    estimatedStartSec: 0,
    estimatedEndSec: 3,
    estimatedDurationSec: 3,
    timingSource: 'estimated',
  },
  visual: {
    template: 'TextOnGradient',
    motion: {
      preset: 'standard',
      entrance: {
        type: 'slide',
        direction: 'up',
        delay: 0,
        duration: 15,
        easing: 'spring',
      },
      emphasis: {
        type: 'pulse',
        trigger: 'onWord',
        intensity: 0.3,
        duration: 10,
      },
      exit: {
        type: 'fade',
        duration: 15,
        startBeforeEnd: 15,
      },
    },
  },
  audio: {
    mood: 'energetic',
    sfxCues: [{ trigger: 'segment_start', sound: 'whoosh', volume: 0.5 }],
  },
  ...overrides,
});

const createValidDirectionDocument = (overrides?: Partial<DirectionDocument>): DirectionDocument => ({
  version: '2.0',
  metadata: {
    title: 'Understanding AI Technology',
    slug: 'understanding-ai-technology',
    estimatedDurationSec: 300,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    generatedAt: '2026-01-27T12:00:00Z',
  },
  segments: [createValidSegment()],
  globalAudio: {
    defaultMood: 'energetic',
    musicTransitions: 'smooth',
  },
  ...overrides,
});

// =============================================================================
// Test: Valid DirectionDocument passes Zod validation
// =============================================================================

describe('DirectionDocumentSchema', () => {
  it('validates a complete valid DirectionDocument', () => {
    const doc = createValidDirectionDocument();
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('2.0');
      expect(result.data.segments).toHaveLength(1);
      expect(result.data.metadata.title).toBe('Understanding AI Technology');
    }
  });

  it('validates document with multiple segments', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({ id: 'seg-001', index: 0, type: 'intro' }),
        createValidSegment({ id: 'seg-002', index: 1, type: 'explanation' }),
        createValidSegment({ id: 'seg-003', index: 2, type: 'outro' }),
      ],
    });
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(3);
    }
  });

  it('validates document with actualDurationSec after TTS', () => {
    const doc = createValidDirectionDocument({
      metadata: {
        title: 'Test',
        slug: 'test',
        estimatedDurationSec: 300,
        actualDurationSec: 312.5,
        fps: 30,
        resolution: { width: 1920, height: 1080 },
        generatedAt: '2026-01-27T12:00:00Z',
      },
    });
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.actualDurationSec).toBe(312.5);
    }
  });

  it('validates segment with actual timing (post-extraction)', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({
          timing: {
            estimatedStartSec: 0,
            estimatedEndSec: 3,
            estimatedDurationSec: 3,
            actualStartSec: 0,
            actualEndSec: 2.8,
            actualDurationSec: 2.8,
            wordTimings: [
              {
                word: 'Welcome',
                index: 0,
                startTime: 0,
                endTime: 0.4,
                duration: 0.4,
                segmentId: 'seg-001',
                isEmphasis: false,
              },
            ],
            timingSource: 'extracted',
          },
        }),
      ],
    });
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments[0].timing.timingSource).toBe('extracted');
      expect(result.data.segments[0].timing.wordTimings).toHaveLength(1);
    }
  });
});

// =============================================================================
// Test: Missing required fields fail validation with descriptive errors
// =============================================================================

describe('DirectionDocumentSchema - missing required fields', () => {
  it('fails when version is missing', () => {
    const doc = createValidDirectionDocument();
    const { version, ...docWithoutVersion } = doc;

    const result = DirectionDocumentSchema.safeParse(docWithoutVersion);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('version'))).toBe(true);
    }
  });

  it('fails when metadata is missing', () => {
    const doc = createValidDirectionDocument();
    const { metadata, ...docWithoutMetadata } = doc;

    const result = DirectionDocumentSchema.safeParse(docWithoutMetadata);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('metadata'))).toBe(true);
    }
  });

  it('fails when segments is missing', () => {
    const doc = createValidDirectionDocument();
    const { segments, ...docWithoutSegments } = doc;

    const result = DirectionDocumentSchema.safeParse(docWithoutSegments);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('segments'))).toBe(true);
    }
  });

  it('fails when globalAudio is missing', () => {
    const doc = createValidDirectionDocument();
    const { globalAudio, ...docWithoutGlobalAudio } = doc;

    const result = DirectionDocumentSchema.safeParse(docWithoutGlobalAudio);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('globalAudio'))).toBe(true);
    }
  });

  it('fails when segment.content.text is missing', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({
          content: {
            wordCount: 7,
            keywords: [],
            emphasis: [],
          } as any,
        }),
      ],
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('text'))).toBe(true);
    }
  });

  it('fails when segment.visual.template is missing', () => {
    const segment = createValidSegment();
    const { template, ...visualWithoutTemplate } = segment.visual;

    const doc = createValidDirectionDocument({
      segments: [{ ...segment, visual: visualWithoutTemplate as any }],
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('template'))).toBe(true);
    }
  });

  it('fails when segment.timing.timingSource is missing', () => {
    const segment = createValidSegment();
    const { timingSource, ...timingWithoutSource } = segment.timing;

    const doc = createValidDirectionDocument({
      segments: [{ ...segment, timing: timingWithoutSource as any }],
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('timingSource'))).toBe(true);
    }
  });
});

// =============================================================================
// Test: Invalid enum values fail validation
// =============================================================================

describe('DirectionDocumentSchema - invalid enum values', () => {
  it('fails when version is not 2.0', () => {
    const doc = createValidDirectionDocument({ version: '1.0' as any });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });

  it('fails when segment.type is invalid', () => {
    const doc = createValidDirectionDocument({
      segments: [createValidSegment({ type: 'invalid_type' as any })],
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('type'))).toBe(true);
    }
  });

  it('fails when visual.template is invalid', () => {
    const segment = createValidSegment();
    segment.visual.template = 'InvalidComponent' as any;

    const doc = createValidDirectionDocument({ segments: [segment] });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('template'))).toBe(true);
    }
  });

  it('fails when motion.entrance.type is invalid', () => {
    const segment = createValidSegment();
    segment.visual.motion.entrance.type = 'invalid_entrance' as any;

    const doc = createValidDirectionDocument({ segments: [segment] });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });

  it('fails when audio.mood is invalid', () => {
    const segment = createValidSegment();
    segment.audio.mood = 'invalid_mood' as any;

    const doc = createValidDirectionDocument({ segments: [segment] });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });

  it('fails when globalAudio.defaultMood is invalid', () => {
    const doc = createValidDirectionDocument({
      globalAudio: {
        defaultMood: 'invalid' as any,
        musicTransitions: 'smooth',
      },
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });

  it('fails when timingSource is invalid', () => {
    const segment = createValidSegment();
    segment.timing.timingSource = 'manual' as any;

    const doc = createValidDirectionDocument({ segments: [segment] });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });

  it('fails when emphasis.effect is invalid', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({
          content: {
            text: 'Test',
            wordCount: 1,
            keywords: [],
            emphasis: [{ word: 'Test', effect: 'invalid' as any, intensity: 0.5 }],
          },
        }),
      ],
    });

    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Test: MOTION_PRESETS expand correctly
// =============================================================================

describe('MOTION_PRESETS', () => {
  it('defines subtle preset with fade entrance', () => {
    expect(MOTION_PRESETS.subtle.entrance.type).toBe('fade');
    expect(MOTION_PRESETS.subtle.entrance.duration).toBe(20);
    expect(MOTION_PRESETS.subtle.emphasis.type).toBe('none');
    expect(MOTION_PRESETS.subtle.exit.type).toBe('fade');
  });

  it('defines standard preset with slide entrance', () => {
    expect(MOTION_PRESETS.standard.entrance.type).toBe('slide');
    expect(MOTION_PRESETS.standard.entrance.direction).toBe('up');
    expect(MOTION_PRESETS.standard.entrance.easing).toBe('spring');
    expect(MOTION_PRESETS.standard.emphasis.type).toBe('pulse');
    expect(MOTION_PRESETS.standard.emphasis.trigger).toBe('onWord');
  });

  it('defines dramatic preset with pop entrance and spring config', () => {
    expect(MOTION_PRESETS.dramatic.entrance.type).toBe('pop');
    expect(MOTION_PRESETS.dramatic.entrance.springConfig).toBeDefined();
    expect(MOTION_PRESETS.dramatic.entrance.springConfig?.damping).toBe(80);
    expect(MOTION_PRESETS.dramatic.entrance.springConfig?.stiffness).toBe(300);
    expect(MOTION_PRESETS.dramatic.emphasis.type).toBe('glow');
    expect(MOTION_PRESETS.dramatic.exit.type).toBe('shrink');
  });

  it('all presets pass MotionConfig validation', () => {
    Object.entries(MOTION_PRESETS).forEach(([name, preset]) => {
      const result = MotionConfigSchema.safeParse(preset);
      expect(result.success).toBe(true);
    });
  });

  it('presets can be used in DirectionDocument', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({ visual: { ...createValidSegment().visual, motion: MOTION_PRESETS.dramatic } }),
      ],
    });

    const result = DirectionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Test: isV2Output type guard works correctly
// =============================================================================

describe('isV2Output type guard', () => {
  const createV1Output = (): ScriptGenOutputV1 => ({
    script: 'This is a script [Visual: Graph]',
    wordCount: 100,
    artifactUrl: 'gs://bucket/script.md',
    draftUrls: {
      writer: 'gs://bucket/writer.md',
      critic: 'gs://bucket/critic.md',
      optimizer: 'gs://bucket/optimizer.md',
    },
    regenerationAttempts: 1,
    providers: {
      writer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
      critic: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
      optimizer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    },
  });

  const createV2Output = (): ScriptGenOutputV2 => ({
    version: '2.0',
    script: 'This is a script',
    scriptText: 'This is a script',
    scriptUrl: 'gs://bucket/script.md',
    directionDocument: createValidDirectionDocument(),
    directionUrl: 'gs://bucket/direction.json',
    wordCount: 100,
    artifactUrl: 'gs://bucket/script.md',
    draftUrls: {
      writer: 'gs://bucket/writer.md',
      critic: 'gs://bucket/critic.md',
      optimizer: 'gs://bucket/optimizer.md',
    },
    regenerationAttempts: 1,
    providers: {
      writer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
      critic: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
      optimizer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    },
  });

  it('returns false for V1 output (no version field)', () => {
    const v1 = createV1Output();
    expect(isV2Output(v1)).toBe(false);
  });

  it('returns true for V2 output (has version: 2.0)', () => {
    const v2 = createV2Output();
    expect(isV2Output(v2)).toBe(true);
  });

  it('returns false for object with different version', () => {
    const output = { ...createV2Output(), version: '1.0' };
    expect(isV2Output(output as any)).toBe(false);
  });

  it('correctly narrows type in conditional', () => {
    const v2 = createV2Output();

    if (isV2Output(v2)) {
      // TypeScript should recognize these V2-specific properties
      expect(v2.scriptText).toBeDefined();
      expect(v2.directionDocument).toBeDefined();
      expect(v2.directionUrl).toBeDefined();
    }
  });
});

// =============================================================================
// Test: validateDirectionDocument helper
// =============================================================================

describe('validateDirectionDocument', () => {
  it('returns valid document when input is valid', () => {
    const doc = createValidDirectionDocument();
    const validated = validateDirectionDocument(doc);

    expect(validated.version).toBe('2.0');
    expect(validated.segments).toHaveLength(1);
  });

  it('throws ZodError when input is invalid', () => {
    const invalidDoc = { version: '1.0' };

    expect(() => validateDirectionDocument(invalidDoc)).toThrow();
  });
});

describe('safeValidateDirectionDocument', () => {
  it('returns success: true for valid input', () => {
    const doc = createValidDirectionDocument();
    const result = safeValidateDirectionDocument(doc);

    expect(result.success).toBe(true);
  });

  it('returns success: false with errors for invalid input', () => {
    const invalidDoc = { version: '1.0' };
    const result = safeValidateDirectionDocument(invalidDoc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Test: Individual schema validations
// =============================================================================

describe('EmphasisWordSchema', () => {
  it('validates valid emphasis word', () => {
    const result = EmphasisWordSchema.safeParse({
      word: 'AI',
      effect: 'glow',
      intensity: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('fails when intensity is out of range', () => {
    const result = EmphasisWordSchema.safeParse({
      word: 'AI',
      effect: 'glow',
      intensity: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('fails when intensity is negative', () => {
    const result = EmphasisWordSchema.safeParse({
      word: 'AI',
      effect: 'glow',
      intensity: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

describe('WordTimingSchema', () => {
  it('validates valid word timing', () => {
    const result = WordTimingSchema.safeParse({
      word: 'Hello',
      index: 0,
      startTime: 0,
      endTime: 0.5,
      duration: 0.5,
      segmentId: 'seg-001',
      isEmphasis: false,
    });
    expect(result.success).toBe(true);
  });

  it('fails when index is negative', () => {
    const result = WordTimingSchema.safeParse({
      word: 'Hello',
      index: -1,
      startTime: 0,
      endTime: 0.5,
      duration: 0.5,
      segmentId: 'seg-001',
      isEmphasis: false,
    });
    expect(result.success).toBe(false);
  });

  it('fails when times are negative', () => {
    const result = WordTimingSchema.safeParse({
      word: 'Hello',
      index: 0,
      startTime: -1,
      endTime: 0.5,
      duration: 0.5,
      segmentId: 'seg-001',
      isEmphasis: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('SFXCueSchema', () => {
  it('validates valid SFX cue', () => {
    const result = SFXCueSchema.safeParse({
      trigger: 'segment_start',
      sound: 'whoosh-01',
      volume: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it('validates SFX cue with triggerValue', () => {
    const result = SFXCueSchema.safeParse({
      trigger: 'word',
      triggerValue: 'AI',
      sound: 'pop-01',
      volume: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it('fails when volume is out of range', () => {
    const result = SFXCueSchema.safeParse({
      trigger: 'segment_start',
      sound: 'whoosh-01',
      volume: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('BRollSpecSchema', () => {
  it('validates code B-Roll', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'code',
      code: {
        content: 'const x = 1;',
        language: 'typescript',
        highlightLines: [1],
        typingEffect: true,
        typingSpeed: 30,
        theme: 'dark',
        showLineNumbers: true,
      },
      overlay: false,
      startOffset: 0,
      duration: 90,
    });
    expect(result.success).toBe(true);
  });

  it('validates browser B-Roll', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'browser',
      browser: {
        url: 'https://api.example.com',
        templateId: 'api-request',
        actions: [{ type: 'click', target: '#button', delay: 15, duration: 10 }],
        viewport: { width: 1280, height: 720 },
      },
      overlay: true,
      overlayOpacity: 0.8,
      position: 'right',
      startOffset: 30,
      duration: 120,
    });
    expect(result.success).toBe(true);
  });

  it('validates static B-Roll with zoom', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'static',
      static: {
        imageUrl: 'https://example.com/image.png',
        alt: 'Example diagram',
        zoom: { from: 1, to: 1.2 },
      },
      overlay: false,
      startOffset: 0,
      duration: 60,
    });
    expect(result.success).toBe(true);
  });
});

describe('DirectionSegmentSchema', () => {
  it('validates complete segment', () => {
    const segment = createValidSegment();
    const result = DirectionSegmentSchema.safeParse(segment);
    expect(result.success).toBe(true);
  });

  it('validates all segment types', () => {
    const types = [
      'intro',
      'hook',
      'explanation',
      'code_demo',
      'comparison',
      'example',
      'transition',
      'recap',
      'outro',
    ];

    types.forEach((type) => {
      const segment = createValidSegment({ type: type as any });
      const result = DirectionSegmentSchema.safeParse(segment);
      expect(result.success).toBe(true);
    });
  });

  it('validates all component names', () => {
    const components = [
      'NeuralNetworkAnimation',
      'DataFlowDiagram',
      'ComparisonChart',
      'MetricsCounter',
      'ProductMockup',
      'CodeHighlight',
      'BrandedTransition',
      'LowerThird',
      'TextOnGradient',
      'KineticText',
      'BrowserFrame',
    ];

    components.forEach((template) => {
      const segment = createValidSegment();
      segment.visual.template = template as any;
      const result = DirectionSegmentSchema.safeParse(segment);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Test: Edge cases (Issue #6 from code review)
// =============================================================================

describe('DirectionDocumentSchema - edge cases', () => {
  it('validates document with empty segments array', () => {
    const doc = createValidDirectionDocument({ segments: [] });
    const result = DirectionDocumentSchema.safeParse(doc);

    // Empty segments is technically valid per schema (may want to add min:1 constraint)
    expect(result.success).toBe(true);
  });

  it('validates segment with wordCount: 0', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({
          content: {
            text: '',
            wordCount: 0,
            keywords: [],
            emphasis: [],
          },
        }),
      ],
    });
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
  });

  it('validates segment with empty keywords and emphasis arrays', () => {
    const doc = createValidDirectionDocument({
      segments: [
        createValidSegment({
          content: {
            text: 'Simple text',
            wordCount: 2,
            keywords: [],
            emphasis: [],
          },
        }),
      ],
    });
    const result = DirectionDocumentSchema.safeParse(doc);

    expect(result.success).toBe(true);
  });
});

describe('BRollSpecSchema - discriminated union enforcement', () => {
  it('fails when type is code but code config is missing', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'code',
      // Missing code config!
      overlay: false,
      startOffset: 0,
      duration: 90,
    });

    expect(result.success).toBe(false);
  });

  it('fails when type is browser but browser config is missing', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'browser',
      // Missing browser config!
      overlay: false,
      startOffset: 0,
      duration: 90,
    });

    expect(result.success).toBe(false);
  });

  it('validates code type with code config present', () => {
    const result = BRollSpecSchema.safeParse({
      type: 'code',
      code: {
        content: 'const x = 1;',
        language: 'typescript',
        typingEffect: true,
        typingSpeed: 30,
        theme: 'dark',
        showLineNumbers: true,
      },
      overlay: false,
      startOffset: 0,
      duration: 90,
    });

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Test: Sub-schema direct tests (Issue #7 from code review)
// =============================================================================

describe('SegmentContentSchema', () => {
  it('validates valid content', () => {
    const result = SegmentContentSchema.safeParse({
      text: 'Hello world',
      wordCount: 2,
      keywords: ['hello', 'world'],
      emphasis: [],
    });
    expect(result.success).toBe(true);
  });

  it('fails when text is missing', () => {
    const result = SegmentContentSchema.safeParse({
      wordCount: 2,
      keywords: [],
      emphasis: [],
    });
    expect(result.success).toBe(false);
  });

  it('fails when wordCount is negative', () => {
    const result = SegmentContentSchema.safeParse({
      text: 'Hello',
      wordCount: -1,
      keywords: [],
      emphasis: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('SegmentTimingSchema', () => {
  it('validates estimated-only timing', () => {
    const result = SegmentTimingSchema.safeParse({
      estimatedStartSec: 0,
      estimatedEndSec: 5,
      estimatedDurationSec: 5,
      timingSource: 'estimated',
    });
    expect(result.success).toBe(true);
  });

  it('validates extracted timing with wordTimings', () => {
    const result = SegmentTimingSchema.safeParse({
      estimatedStartSec: 0,
      estimatedEndSec: 5,
      estimatedDurationSec: 5,
      actualStartSec: 0,
      actualEndSec: 4.8,
      actualDurationSec: 4.8,
      wordTimings: [
        {
          word: 'Hello',
          index: 0,
          startTime: 0,
          endTime: 0.5,
          duration: 0.5,
          segmentId: 'seg-001',
          isEmphasis: false,
        },
      ],
      timingSource: 'extracted',
    });
    expect(result.success).toBe(true);
  });

  it('fails when timingSource is missing', () => {
    const result = SegmentTimingSchema.safeParse({
      estimatedStartSec: 0,
      estimatedEndSec: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe('SegmentVisualSchema', () => {
  it('validates visual with motion config', () => {
    const result = SegmentVisualSchema.safeParse({
      template: 'TextOnGradient',
      motion: {
        entrance: { type: 'fade', delay: 0, duration: 15, easing: 'easeOut' },
        emphasis: { type: 'none', trigger: 'none', intensity: 0, duration: 0 },
        exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
      },
    });
    expect(result.success).toBe(true);
  });

  it('fails when template is invalid', () => {
    const result = SegmentVisualSchema.safeParse({
      template: 'InvalidComponent',
      motion: {
        entrance: { type: 'fade', delay: 0, duration: 15, easing: 'easeOut' },
        emphasis: { type: 'none', trigger: 'none', intensity: 0, duration: 0 },
        exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
      },
    });
    expect(result.success).toBe(false);
  });

  it('validates visual with optional broll', () => {
    const result = SegmentVisualSchema.safeParse({
      template: 'CodeHighlight',
      motion: {
        entrance: { type: 'slide', direction: 'up', delay: 0, duration: 15, easing: 'spring' },
        emphasis: { type: 'pulse', trigger: 'onWord', intensity: 0.3, duration: 10 },
        exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
      },
      broll: {
        type: 'code',
        code: {
          content: 'const x = 1;',
          language: 'typescript',
          typingEffect: false,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: true,
        },
        overlay: false,
        startOffset: 0,
        duration: 60,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('SegmentAudioSchema', () => {
  it('validates audio with all optional fields', () => {
    const result = SegmentAudioSchema.safeParse({
      mood: 'energetic',
      sfxCues: [{ trigger: 'segment_start', sound: 'whoosh', volume: 0.5 }],
      musicTransition: 'smooth',
      voiceEmphasis: 'excited',
    });
    expect(result.success).toBe(true);
  });

  it('validates empty audio object', () => {
    const result = SegmentAudioSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('fails when mood is invalid', () => {
    const result = SegmentAudioSchema.safeParse({
      mood: 'invalid_mood',
    });
    expect(result.success).toBe(false);
  });
});
