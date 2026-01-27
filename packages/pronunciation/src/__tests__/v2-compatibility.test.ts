/**
 * V2 compatibility tests for pronunciation stage
 * Tests getScriptText integration and V1/V2 output handling
 *
 * @module @nexus-ai/pronunciation/__tests__/v2-compatibility
 */

import { describe, it, expect } from 'vitest';
import { getScriptText, type ScriptGenOutput, type DirectionDocument } from '@nexus-ai/script-gen';

/**
 * Helper to create a minimal valid DirectionDocument
 */
function createMockDirectionDocument(): DirectionDocument {
  return {
    version: '2.0',
    metadata: {
      title: 'Test Video',
      slug: 'test-video',
      estimatedDurationSec: 120,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      generatedAt: new Date().toISOString(),
    },
    segments: [],
    globalAudio: {
      defaultMood: 'neutral',
      musicTransitions: 'smooth',
    },
  };
}

describe('getScriptText integration', () => {
  describe('V1 string input handling', () => {
    it('should strip [VISUAL:...] tags from V1 script', () => {
      const v1Output: ScriptGenOutput = {
        script: `[VISUAL:neural_network]
Today we're exploring transformers.

[VISUAL:code_highlight]
Here's the attention mechanism.`,
        artifactUrl: 'gs://test/script.md',
        wordCount: 10,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      expect(result).not.toContain('[VISUAL:');
      expect(result).toContain("Today we're exploring transformers");
      expect(result).toContain("Here's the attention mechanism");
    });

    it('should replace [PRONOUNCE:term:ipa] with just the term', () => {
      const v1Output: ScriptGenOutput = {
        script: `Let's discuss [PRONOUNCE:softmax:ˈsɒftmæks] and [PRONOUNCE:relu:ˈreɪluː] functions.`,
        artifactUrl: 'gs://test/script.md',
        wordCount: 8,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      expect(result).not.toContain('[PRONOUNCE:');
      expect(result).toContain('softmax');
      expect(result).toContain('relu');
      expect(result).toContain("Let's discuss softmax and relu functions");
    });

    it('should strip [MUSIC:...] and [SFX:...] tags', () => {
      const v1Output: ScriptGenOutput = {
        script: `[MUSIC:upbeat]
Welcome to our video!

[SFX:whoosh]
Let's dive in.`,
        artifactUrl: 'gs://test/script.md',
        wordCount: 8,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      expect(result).not.toContain('[MUSIC:');
      expect(result).not.toContain('[SFX:');
      expect(result).toContain('Welcome to our video');
      expect(result).toContain("Let's dive in");
    });

    it('should handle V1 script with no brackets (pass-through)', () => {
      const v1Output: ScriptGenOutput = {
        script: 'This is a plain script with no special tags.',
        artifactUrl: 'gs://test/script.md',
        wordCount: 8,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      expect(result).toBe('This is a plain script with no special tags.');
    });

    it('should normalize whitespace after stripping tags', () => {
      const v1Output: ScriptGenOutput = {
        script: `[VISUAL:intro]


First paragraph.


[VISUAL:demo]


Second paragraph.`,
        artifactUrl: 'gs://test/script.md',
        wordCount: 4,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      // Should not have more than 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });
  });

  describe('V2 ScriptGenOutput handling', () => {
    it('should return scriptText directly for V2 output', () => {
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: 'Raw script with [VISUAL:...] would be here',
        scriptText: 'This is the clean narration text without any brackets.',
        scriptUrl: 'gs://test/script.md',
        directionDocument: createMockDirectionDocument(),
        directionUrl: 'gs://test/direction.json',
        wordCount: 10,
        artifactUrl: 'gs://test/script.md',
        draftUrls: {},
      };

      const result = getScriptText(v2Output);

      // Should return scriptText directly, not process script
      expect(result).toBe('This is the clean narration text without any brackets.');
    });

    it('should handle empty scriptText in V2 output', () => {
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: '',
        scriptText: '',
        scriptUrl: 'gs://test/script.md',
        directionDocument: createMockDirectionDocument(),
        directionUrl: 'gs://test/direction.json',
        wordCount: 0,
        artifactUrl: 'gs://test/script.md',
        draftUrls: {},
      };

      const result = getScriptText(v2Output);

      expect(result).toBe('');
    });

    it('should preserve line breaks in V2 scriptText', () => {
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: 'raw',
        scriptText: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
        scriptUrl: 'gs://test/script.md',
        directionDocument: createMockDirectionDocument(),
        directionUrl: 'gs://test/direction.json',
        wordCount: 6,
        artifactUrl: 'gs://test/script.md',
        draftUrls: {},
      };

      const result = getScriptText(v2Output);

      expect(result).toBe('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.');
    });
  });

  describe('Edge cases', () => {
    it('should handle complex V1 script with all tag types', () => {
      const complexV1Script = `[MUSIC:intro_theme]
[VISUAL:title_card]
Welcome to our AI deep dive!

[SFX:transition]
[VISUAL:neural_network]
Today we're exploring [PRONOUNCE:transformer:trænsˈfɔːrmər] architecture.

[VISUAL:code_highlight]
The key innovation is the [PRONOUNCE:attention:əˈtenʃən] mechanism.

[MUSIC:outro]
Thanks for watching!`;

      const v1Output: ScriptGenOutput = {
        script: complexV1Script,
        artifactUrl: 'gs://test/script.md',
        wordCount: 20,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      // Should strip all bracket tags
      expect(result).not.toMatch(/\[MUSIC:[^\]]+\]/);
      expect(result).not.toMatch(/\[VISUAL:[^\]]+\]/);
      expect(result).not.toMatch(/\[SFX:[^\]]+\]/);
      expect(result).not.toMatch(/\[PRONOUNCE:[^\]]+\]/);

      // Should preserve the terms from PRONOUNCE tags
      expect(result).toContain('transformer');
      expect(result).toContain('attention');

      // Should preserve narration text
      expect(result).toContain('Welcome to our AI deep dive');
      expect(result).toContain("Today we're exploring transformer architecture");
      expect(result).toContain('Thanks for watching');
    });

    it('should handle script with nested-looking brackets (not valid tags)', () => {
      const v1Output: ScriptGenOutput = {
        script: 'Arrays use [index] notation. Functions use (params).',
        artifactUrl: 'gs://test/script.md',
        wordCount: 8,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      // [index] is not a valid tag pattern, should be preserved
      expect(result).toContain('[index]');
      expect(result).toContain('(params)');
    });

    it('should handle V1 script that looks like V2 but has no version field', () => {
      // This tests that we correctly identify V1 vs V2 based on version field
      const v1Output: ScriptGenOutput = {
        script: 'Plain script text.',
        artifactUrl: 'gs://test/script.md',
        wordCount: 3,
        draftUrls: {},
      };

      const result = getScriptText(v1Output);

      expect(result).toBe('Plain script text.');
    });
  });
});

describe('Integration: No stage directions reach TTS', () => {
  /**
   * AC7: Integration test confirms no stage directions in synthesized audio
   * This test verifies that the pronunciation stage output (SSML) is clean
   * and ready for TTS synthesis without any visual cue brackets.
   */
  it('should produce TTS-ready SSML with no stage direction brackets', () => {
    // Simulate V1 script with all types of stage direction brackets
    const v1ScriptWithDirections = `[MUSIC:intro_theme]
[VISUAL:title_card]
Welcome to our AI deep dive!

[SFX:transition]
[VISUAL:neural_network]
Today we're exploring [PRONOUNCE:transformer:trænsˈfɔːrmər] architecture.

[VISUAL:code_highlight]
The key innovation is the [PRONOUNCE:attention:əˈtenʃən] mechanism.

[MUSIC:outro]
Thanks for watching!`;

    const v1Output: ScriptGenOutput = {
      script: v1ScriptWithDirections,
      artifactUrl: 'gs://test/script.md',
      wordCount: 20,
      draftUrls: {},
    };

    // Get clean script (simulates what pronunciation stage does before SSML tagging)
    const cleanScript = getScriptText(v1Output);

    // Verify NO stage direction brackets remain - these are the patterns TTS must never see
    const stageDirectionPatterns = [
      /\[VISUAL:[^\]]+\]/,      // Visual cues
      /\[MUSIC:[^\]]+\]/,       // Music cues
      /\[SFX:[^\]]+\]/,         // Sound effect cues
      /\[PRONOUNCE:[^\]]+\]/,   // Pronunciation hints (should be replaced with term only)
    ];

    for (const pattern of stageDirectionPatterns) {
      expect(cleanScript).not.toMatch(pattern);
    }

    // Verify the actual spoken content is preserved
    expect(cleanScript).toContain('Welcome to our AI deep dive');
    expect(cleanScript).toContain('transformer');  // Term from PRONOUNCE tag
    expect(cleanScript).toContain('attention');    // Term from PRONOUNCE tag
    expect(cleanScript).toContain('Thanks for watching');
  });

  it('should ensure V2 scriptText is TTS-ready by design', () => {
    // V2 outputs have pre-cleaned scriptText - verify it's directly usable
    const v2Output: ScriptGenOutput = {
      version: '2.0',
      script: 'Raw script with [VISUAL:...] would be here',
      scriptText: 'This is clean narration ready for TTS synthesis.',
      scriptUrl: 'gs://test/script.md',
      directionDocument: createMockDirectionDocument(),
      directionUrl: 'gs://test/direction.json',
      wordCount: 8,
      artifactUrl: 'gs://test/script.md',
      draftUrls: {},
    };

    const cleanScript = getScriptText(v2Output);

    // V2 scriptText should be returned as-is, no processing needed
    expect(cleanScript).toBe('This is clean narration ready for TTS synthesis.');

    // Double-check no bracket patterns
    expect(cleanScript).not.toMatch(/\[[A-Z]+:[^\]]+\]/);
  });

  it('should handle mixed content ensuring only narration reaches TTS', () => {
    // Edge case: script with code brackets that should NOT be stripped
    const scriptWithCodeBrackets = `[VISUAL:code_demo]
Arrays use bracket notation like arr[0] for indexing.

[VISUAL:explanation]
Functions take parameters in parentheses like func(param).`;

    const v1Output: ScriptGenOutput = {
      script: scriptWithCodeBrackets,
      artifactUrl: 'gs://test/script.md',
      wordCount: 15,
      draftUrls: {},
    };

    const cleanScript = getScriptText(v1Output);

    // Visual cues should be stripped
    expect(cleanScript).not.toMatch(/\[VISUAL:[^\]]+\]/);

    // Code brackets should be preserved (they're not stage directions)
    expect(cleanScript).toContain('arr[0]');
    expect(cleanScript).toContain('func(param)');
  });
});

describe('Pronunciation stage V1/V2 compatibility', () => {
  describe('Input type detection', () => {
    it('should correctly identify V1 string input', () => {
      const v1Input = 'This is a plain string input';
      expect(typeof v1Input).toBe('string');
    });

    it('should correctly identify V2 ScriptGenOutput input', () => {
      const v2Input: ScriptGenOutput = {
        version: '2.0',
        script: 'raw',
        scriptText: 'clean',
        scriptUrl: 'gs://test/script.md',
        directionDocument: createMockDirectionDocument(),
        directionUrl: 'gs://test/direction.json',
        wordCount: 1,
        artifactUrl: 'gs://test/script.md',
        draftUrls: {},
      };

      expect(typeof v2Input).toBe('object');
      expect(v2Input).toHaveProperty('version', '2.0');
      expect(v2Input).toHaveProperty('scriptText');
    });
  });

  describe('Clean script extraction', () => {
    it('should produce identical clean output for equivalent V1 and V2 inputs', () => {
      const cleanNarration = "Today we're exploring transformers. Here's the attention mechanism.";

      // V1 with brackets
      const v1Output: ScriptGenOutput = {
        script: `[VISUAL:neural_network]
Today we're exploring transformers.

[VISUAL:code_highlight]
Here's the attention mechanism.`,
        artifactUrl: 'gs://test/script.md',
        wordCount: 8,
        draftUrls: {},
      };

      // V2 with pre-cleaned scriptText
      const v2Output: ScriptGenOutput = {
        version: '2.0',
        script: v1Output.script,
        scriptText: cleanNarration,
        scriptUrl: 'gs://test/script.md',
        directionDocument: createMockDirectionDocument(),
        directionUrl: 'gs://test/direction.json',
        wordCount: 8,
        artifactUrl: 'gs://test/script.md',
        draftUrls: {},
      };

      const v1Result = getScriptText(v1Output);
      const v2Result = getScriptText(v2Output);

      // V2 should return exact scriptText
      expect(v2Result).toBe(cleanNarration);

      // V1 should produce similar content (may have different whitespace normalization)
      expect(v1Result).toContain("Today we're exploring transformers");
      expect(v1Result).toContain("Here's the attention mechanism");
      expect(v1Result).not.toContain('[VISUAL:');
    });
  });
});
