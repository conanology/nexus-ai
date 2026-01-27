/**
 * Tests for V1 → V2 compatibility layer
 * @module @nexus-ai/script-gen/compatibility.test
 */

import { describe, it, expect } from 'vitest';
import {
  getScriptText,
  getDirectionDocument,
  parseLegacyVisualCues,
  mapV1ComponentToV2,
  detectSegmentType,
} from '../compatibility.js';
import {
  isV2Output,
  validateDirectionDocument,
  MOTION_PRESETS,
  type ScriptGenOutputV1,
  type ScriptGenOutputV2,
  type DirectionDocument,
} from '../types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const sampleV1Output: ScriptGenOutputV1 = {
  script: `[VISUAL:neural_network] Today we're exploring transformer architectures.
[PRONOUNCE:GPT:dʒiː.piː.tiː] has revolutionized natural language processing.
[VISUAL:data_flow] The attention mechanism [SFX:whoosh] processes tokens in parallel.
[MUSIC:energetic] Let's dive into the technical details.`,
  wordCount: 30,
  artifactUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
  draftUrls: {
    writer: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/v1-writer.md',
    critic: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/v2-critic.md',
    optimizer: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/v3-optimizer.md',
  },
  regenerationAttempts: 0,
  providers: {
    writer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    critic: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    optimizer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
  },
};

const sampleV2Output: ScriptGenOutputV2 = {
  ...sampleV1Output,
  version: '2.0',
  scriptText: "Today we're exploring transformer architectures. GPT has revolutionized natural language processing.",
  scriptUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
  directionDocument: {
    version: '2.0',
    metadata: {
      title: 'Transformer Architectures',
      slug: 'transformer-architectures',
      estimatedDurationSec: 12,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      generatedAt: '2026-01-27T10:00:00Z',
    },
    segments: [
      {
        id: 'test-segment-1',
        index: 0,
        type: 'intro',
        content: {
          text: "Today we're exploring transformer architectures.",
          wordCount: 5,
          keywords: ['transformer'],
          emphasis: [],
        },
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: 6,
          estimatedDurationSec: 6,
          timingSource: 'estimated',
        },
        visual: {
          template: 'NeuralNetworkAnimation',
          motion: MOTION_PRESETS.standard,
        },
        audio: {
          mood: 'neutral',
        },
      },
    ],
    globalAudio: {
      defaultMood: 'neutral',
      musicTransitions: 'smooth',
    },
  },
  directionUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/direction.json',
};

// =============================================================================
// Task 1: Module Structure Tests
// =============================================================================

describe('Compatibility Module Structure', () => {
  describe('isV2Output type guard', () => {
    it('should return true for V2 output', () => {
      expect(isV2Output(sampleV2Output)).toBe(true);
    });

    it('should return false for V1 output', () => {
      expect(isV2Output(sampleV1Output)).toBe(false);
    });
  });
});

// =============================================================================
// Task 2: getScriptText Tests
// =============================================================================

describe('getScriptText', () => {
  describe('V2 output', () => {
    it('should return scriptText directly for V2 output', () => {
      const result = getScriptText(sampleV2Output);
      expect(result).toBe(sampleV2Output.scriptText);
    });
  });

  describe('V1 output', () => {
    it('should strip [VISUAL:...] tags', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[VISUAL:neural_network] Hello world.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('Hello world.');
    });

    it('should strip [PRONOUNCE:term:ipa] tags but keep the term', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[PRONOUNCE:GPT:dʒiː.piː.tiː] is amazing.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('GPT is amazing.');
    });

    it('should strip [MUSIC:...] tags', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[MUSIC:energetic] Let us begin.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('Let us begin.');
    });

    it('should strip [SFX:...] tags', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: 'The sound [SFX:whoosh] is cool.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('The sound is cool.');
    });

    it('should strip all bracket patterns in complex script', () => {
      const result = getScriptText(sampleV1Output);
      // Newlines between visual cue blocks are preserved
      expect(result).toBe(
        "Today we're exploring transformer architectures.\nGPT has revolutionized natural language processing.\nThe attention mechanism processes tokens in parallel.\nLet's dive into the technical details."
      );
    });

    it('should preserve paragraph structure', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[VISUAL:intro] First paragraph.\n\n[VISUAL:main] Second paragraph.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('First paragraph.\n\nSecond paragraph.');
    });

    it('should trim whitespace and normalize newlines', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '  [VISUAL:test]  Hello world.  \n\n\n  ',
      };
      const result = getScriptText(v1);
      expect(result).toBe('Hello world.');
    });

    it('should preserve unicode and special characters', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[VISUAL:test] Café résumé 日本語 🚀',
      };
      const result = getScriptText(v1);
      expect(result).toBe('Café résumé 日本語 🚀');
    });
  });
});

// =============================================================================
// Task 3: parseLegacyVisualCues Tests
// =============================================================================

describe('parseLegacyVisualCues', () => {
  it('should produce a valid DirectionDocument', () => {
    const script = '[VISUAL:neural_network] Introduction text. [VISUAL:data_flow] Main content.';
    const result = parseLegacyVisualCues(script, 60);

    // Should pass Zod validation
    expect(() => validateDirectionDocument(result)).not.toThrow();
    expect(result.version).toBe('2.0');
  });

  it('should parse multiple visual cues into segments', () => {
    const script = '[VISUAL:neural_network] First segment. [VISUAL:data_flow] Second segment.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].content.text).toBe('First segment.');
    expect(result.segments[1].content.text).toBe('Second segment.');
  });

  it('should generate UUID for each segment', () => {
    const script = '[VISUAL:test] Segment one. [VISUAL:test2] Segment two.';
    const result = parseLegacyVisualCues(script, 60);

    // Each segment should have a unique id
    expect(result.segments[0].id).toBeTruthy();
    expect(result.segments[1].id).toBeTruthy();
    expect(result.segments[0].id).not.toBe(result.segments[1].id);
  });

  it('should distribute timing proportionally by word count', () => {
    // 3 words + 6 words = 9 words total
    const script = '[VISUAL:a] One two three. [VISUAL:b] Four five six seven eight nine.';
    const result = parseLegacyVisualCues(script, 90);

    // First segment: 3/9 * 90 = 30 sec
    // Second segment: 6/9 * 90 = 60 sec
    expect(result.segments[0].timing.estimatedDurationSec).toBeCloseTo(30, 0);
    expect(result.segments[1].timing.estimatedDurationSec).toBeCloseTo(60, 0);
  });

  it('should set default motion config using MOTION_PRESETS.standard', () => {
    const script = '[VISUAL:test] Test content.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.segments[0].visual.motion).toEqual(MOTION_PRESETS.standard);
  });

  it('should set default globalAudio settings', () => {
    const script = '[VISUAL:test] Test content.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.globalAudio.defaultMood).toBe('neutral');
    expect(result.globalAudio.musicTransitions).toBe('smooth');
  });

  it('should extract keywords from visual cue content', () => {
    const script = '[VISUAL:neural_network] Test content.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.segments[0].content.keywords).toContain('neural');
    expect(result.segments[0].content.keywords).toContain('network');
  });

  it('should handle empty script gracefully', () => {
    const result = parseLegacyVisualCues('', 60);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].content.text).toBe('');
  });

  it('should handle script with no visual cues', () => {
    const script = 'This is plain text with no cues.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].content.text).toBe('This is plain text with no cues.');
    // Single segment defaults to 'intro' (index 0)
    expect(result.segments[0].type).toBe('intro');
  });

  it('should parse [PRONOUNCE:term:ipa] tags into segment emphasis', () => {
    const script = '[VISUAL:test] Hello [PRONOUNCE:GPT:dʒiː.piː.tiː] world.';
    const result = parseLegacyVisualCues(script, 60);

    expect(result.segments[0].content.emphasis).toEqual(
      expect.arrayContaining([expect.objectContaining({ word: 'GPT' })])
    );
  });
});

// =============================================================================
// Task 4: getDirectionDocument Tests
// =============================================================================

describe('getDirectionDocument', () => {
  it('should return directionDocument directly for V2 output', () => {
    const result = getDirectionDocument(sampleV2Output, 60);
    expect(result).toBe(sampleV2Output.directionDocument);
  });

  it('should call parseLegacyVisualCues for V1 output', () => {
    const result = getDirectionDocument(sampleV1Output, 60);

    // Should return a valid DirectionDocument
    expect(() => validateDirectionDocument(result)).not.toThrow();
    expect(result.version).toBe('2.0');
  });

  it('should validate returned DirectionDocument', () => {
    const result = getDirectionDocument(sampleV1Output, 60);
    // This will throw if validation fails
    validateDirectionDocument(result);
  });
});

// =============================================================================
// Task 5: Component Name Mapping Tests
// =============================================================================

describe('mapV1ComponentToV2', () => {
  it('should map neural_network to NeuralNetworkAnimation', () => {
    expect(mapV1ComponentToV2('neural_network')).toBe('NeuralNetworkAnimation');
  });

  it('should map neuralnetwork to NeuralNetworkAnimation', () => {
    expect(mapV1ComponentToV2('neuralnetwork')).toBe('NeuralNetworkAnimation');
  });

  it('should map data_flow to DataFlowDiagram', () => {
    expect(mapV1ComponentToV2('data_flow')).toBe('DataFlowDiagram');
  });

  it('should map comparison to ComparisonChart', () => {
    expect(mapV1ComponentToV2('comparison')).toBe('ComparisonChart');
  });

  it('should map code to CodeHighlight', () => {
    expect(mapV1ComponentToV2('code')).toBe('CodeHighlight');
  });

  it('should handle case-insensitive matching', () => {
    expect(mapV1ComponentToV2('NEURAL_NETWORK')).toBe('NeuralNetworkAnimation');
    expect(mapV1ComponentToV2('Neural_Network')).toBe('NeuralNetworkAnimation');
  });

  it('should handle hyphens in input', () => {
    expect(mapV1ComponentToV2('code-highlight')).toBe('CodeHighlight');
    expect(mapV1ComponentToV2('lower-third')).toBe('LowerThird');
  });

  it('should fallback to TextOnGradient for unknown components', () => {
    expect(mapV1ComponentToV2('unknown_component')).toBe('TextOnGradient');
    expect(mapV1ComponentToV2('')).toBe('TextOnGradient');
  });

  it('should map all ComponentName values with aliases', () => {
    // Test all known mappings
    expect(mapV1ComponentToV2('metrics')).toBe('MetricsCounter');
    expect(mapV1ComponentToV2('counter')).toBe('MetricsCounter');
    expect(mapV1ComponentToV2('product')).toBe('ProductMockup');
    expect(mapV1ComponentToV2('mockup')).toBe('ProductMockup');
    expect(mapV1ComponentToV2('transition')).toBe('BrandedTransition');
    expect(mapV1ComponentToV2('lower_third')).toBe('LowerThird');
    expect(mapV1ComponentToV2('text')).toBe('TextOnGradient');
  });
});

// =============================================================================
// Task 6: Segment Type Detection Tests
// =============================================================================

describe('detectSegmentType', () => {
  it('should detect first segment as intro', () => {
    expect(detectSegmentType('Any text', 0, 3)).toBe('intro');
  });

  it('should detect last segment as outro', () => {
    expect(detectSegmentType('Any text', 2, 3)).toBe('outro');
  });

  it('should detect code_demo from code block presence', () => {
    const text = '```typescript\nconst x = 1;\n```';
    expect(detectSegmentType(text, 1, 4)).toBe('code_demo');
  });

  it('should detect code_demo from programming keywords', () => {
    expect(detectSegmentType('The function returns a value', 1, 4)).toBe('code_demo');
    expect(detectSegmentType('Use the API endpoint', 1, 4)).toBe('code_demo');
  });

  it('should detect comparison from comparison words', () => {
    expect(detectSegmentType('React vs Vue comparison', 1, 4)).toBe('comparison');
    expect(detectSegmentType('Compared to the previous version', 1, 4)).toBe('comparison');
    expect(detectSegmentType('Python versus JavaScript', 1, 4)).toBe('comparison');
  });

  it('should default to explanation for middle segments', () => {
    expect(detectSegmentType('This explains how it works', 1, 4)).toBe('explanation');
  });

  it('should handle single segment as intro', () => {
    // Edge case: only one segment total
    expect(detectSegmentType('Any text', 0, 1)).toBe('intro');
  });
});

// =============================================================================
// Task 8: Edge Case Tests
// =============================================================================

describe('Edge Cases', () => {
  describe('getScriptText edge cases', () => {
    it('should handle consecutive visual cues', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[VISUAL:a][VISUAL:b] Text.',
      };
      const result = getScriptText(v1);
      expect(result).toBe('Text.');
    });

    it('should handle malformed brackets gracefully', () => {
      const v1: ScriptGenOutputV1 = {
        ...sampleV1Output,
        script: '[VISUAL:test Text without closing bracket.',
      };
      // Should not crash, keeps malformed content
      const result = getScriptText(v1);
      expect(result).toContain('Text without closing bracket');
    });
  });

  describe('parseLegacyVisualCues edge cases', () => {
    it('should handle consecutive visual cues with no text between', () => {
      const script = '[VISUAL:a][VISUAL:b] Text here.';
      const result = parseLegacyVisualCues(script, 60);

      // Should create segments even for empty text
      expect(result.segments.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long scripts', () => {
      // Create a long script
      const segments = Array.from({ length: 50 }, (_, i) => `[VISUAL:test${i}] Segment ${i} text.`);
      const script = segments.join(' ');
      const result = parseLegacyVisualCues(script, 300);

      // Should process all segments
      expect(result.segments.length).toBe(50);
    });

    it('should throw error for audioDurationSec = 0', () => {
      expect(() => parseLegacyVisualCues('[VISUAL:test] Text.', 0)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should throw error for negative audioDurationSec', () => {
      expect(() => parseLegacyVisualCues('[VISUAL:test] Text.', -60)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should throw error for Infinity audioDurationSec', () => {
      expect(() => parseLegacyVisualCues('[VISUAL:test] Text.', Infinity)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should throw error for NaN audioDurationSec', () => {
      expect(() => parseLegacyVisualCues('[VISUAL:test] Text.', NaN)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });
  });

  describe('getDirectionDocument edge cases', () => {
    it('should throw error for audioDurationSec = 0', () => {
      expect(() => getDirectionDocument(sampleV1Output, 0)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should throw error for negative audioDurationSec', () => {
      expect(() => getDirectionDocument(sampleV1Output, -60)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should throw error for Infinity audioDurationSec', () => {
      expect(() => getDirectionDocument(sampleV1Output, Infinity)).toThrow(
        'audioDurationSec must be a positive finite number'
      );
    });

    it('should validate V2 directionDocument', () => {
      // Create a V2 output with invalid directionDocument
      const invalidV2: ScriptGenOutputV2 = {
        ...sampleV2Output,
        directionDocument: {
          ...sampleV2Output.directionDocument,
          version: 'invalid' as '2.0', // Invalid version
        },
      };
      expect(() => getDirectionDocument(invalidV2, 60)).toThrow();
    });
  });
});
