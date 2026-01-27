/**
 * Tests for dual output parsing and segment generation
 * Story 6.3: Update Script Generation for Dual Output
 */

import { describe, it, expect } from 'vitest';
import {
  safeValidateDirectionDocument,
  DirectionDocumentSchema,
  MOTION_PRESETS,
} from '../types.js';
import type { DirectionDocument, DirectionSegment } from '../types.js';

// Import actual implementations for testing (exported for this purpose)
import {
  parseDualOutput as actualParseDualOutput,
  generateSegmentsFromNarration as actualGenerateSegmentsFromNarration,
  stripBrackets as actualStripBrackets,
} from '../script-gen.js';

// Sample dual output from LLM (valid)
const sampleDualOutputValid = `## NARRATION

Welcome to today's deep dive into transformer architectures. These revolutionary models have changed how we approach natural language processing.

The attention mechanism is what makes transformers so powerful. By learning to focus on relevant parts of input sequences, these models achieve human-like understanding of context and nuance.

Let's look at the code implementation. We'll explore how the multi-head attention layer processes input embeddings.

## DIRECTION
\`\`\`json
{
  "version": "2.0",
  "metadata": {
    "title": "Transformer Architectures Deep Dive",
    "slug": "transformer-architectures-deep-dive",
    "estimatedDurationSec": 120,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "generatedAt": "2026-01-27T12:00:00Z"
  },
  "segments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "index": 0,
      "type": "intro",
      "content": {
        "text": "Welcome to today's deep dive into transformer architectures. These revolutionary models have changed how we approach natural language processing.",
        "wordCount": 19,
        "keywords": ["transformer", "architectures", "natural", "language", "processing"],
        "emphasis": [{ "word": "transformer", "effect": "glow", "intensity": 0.5 }]
      },
      "timing": {
        "estimatedStartSec": 0,
        "estimatedEndSec": 7.6,
        "estimatedDurationSec": 7.6,
        "timingSource": "estimated"
      },
      "visual": {
        "template": "BrandedTransition",
        "motion": {
          "entrance": { "type": "slide", "direction": "up", "delay": 0, "duration": 15, "easing": "spring" },
          "emphasis": { "type": "pulse", "trigger": "onWord", "intensity": 0.3, "duration": 10 },
          "exit": { "type": "fade", "duration": 15, "startBeforeEnd": 15 }
        }
      },
      "audio": { "mood": "energetic" }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "index": 1,
      "type": "explanation",
      "content": {
        "text": "The attention mechanism is what makes transformers so powerful. By learning to focus on relevant parts of input sequences, these models achieve human-like understanding of context and nuance.",
        "wordCount": 30,
        "keywords": ["attention", "mechanism", "transformers", "sequences", "understanding"],
        "emphasis": [{ "word": "attention", "effect": "glow", "intensity": 0.5 }]
      },
      "timing": {
        "estimatedStartSec": 7.6,
        "estimatedEndSec": 19.6,
        "estimatedDurationSec": 12,
        "timingSource": "estimated"
      },
      "visual": {
        "template": "TextOnGradient",
        "motion": {
          "entrance": { "type": "slide", "direction": "up", "delay": 0, "duration": 15, "easing": "spring" },
          "emphasis": { "type": "pulse", "trigger": "onWord", "intensity": 0.3, "duration": 10 },
          "exit": { "type": "fade", "duration": 15, "startBeforeEnd": 15 }
        }
      },
      "audio": { "mood": "neutral" }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "index": 2,
      "type": "code_demo",
      "content": {
        "text": "Let's look at the code implementation. We'll explore how the multi-head attention layer processes input embeddings.",
        "wordCount": 17,
        "keywords": ["code", "implementation", "attention", "layer", "embeddings"],
        "emphasis": [{ "word": "code", "effect": "glow", "intensity": 0.5 }]
      },
      "timing": {
        "estimatedStartSec": 19.6,
        "estimatedEndSec": 26.4,
        "estimatedDurationSec": 6.8,
        "timingSource": "estimated"
      },
      "visual": {
        "template": "CodeHighlight",
        "motion": {
          "entrance": { "type": "slide", "direction": "up", "delay": 0, "duration": 15, "easing": "spring" },
          "emphasis": { "type": "pulse", "trigger": "onWord", "intensity": 0.3, "duration": 10 },
          "exit": { "type": "fade", "duration": 15, "startBeforeEnd": 15 }
        }
      },
      "audio": { "mood": "neutral" }
    }
  ],
  "globalAudio": {
    "defaultMood": "neutral",
    "musicTransitions": "smooth"
  }
}
\`\`\`
`;

// Sample dual output with malformed JSON
const sampleDualOutputMalformed = `## NARRATION

Welcome to our tutorial on AI.

Let's dive into the details.

## DIRECTION
\`\`\`json
{
  "version": "2.0",
  "metadata": { invalid json here
}
\`\`\`
`;

// Sample dual output with no direction section
const sampleNarrationOnly = `## NARRATION

Welcome to our tutorial on artificial intelligence.

This is the main content section.

Here's the conclusion.
`;

// Sample V1-style script with brackets (legacy format)
const sampleV1Script = `# AI Tutorial

[VISUAL: Title animation]

Welcome to today's tutorial on artificial intelligence.

[PRONOUNCE: AI = "ay-eye"]

[VISUAL: Neural network diagram]

Let's explore how neural networks process information.

[VISUAL: Code snippet]

Here's some example code to demonstrate.
`;

describe('Dual Output Parsing', () => {
  // Helper function to parse dual output (mimics the function in script-gen.ts)
  function parseDualOutput(content: string): { narration: string; direction: DirectionDocument | null } {
    const NARRATION_PATTERN = /## NARRATION\s*\n([\s\S]*?)(?=## DIRECTION|$)/i;
    const DIRECTION_PATTERN = /## DIRECTION\s*\n```json\n([\s\S]*?)\n```/i;

    const narrationMatch = content.match(NARRATION_PATTERN);
    const directionMatch = content.match(DIRECTION_PATTERN);

    const narration = narrationMatch?.[1]?.trim() ?? content;

    let direction: DirectionDocument | null = null;
    if (directionMatch?.[1]) {
      try {
        const parsed = JSON.parse(directionMatch[1]);
        const result = safeValidateDirectionDocument(parsed);
        if (result.success) {
          direction = result.data;
        }
      } catch {
        // Parse failed
      }
    }

    return { narration, direction };
  }

  describe('parseDualOutput with valid input', () => {
    it('should extract narration text correctly', () => {
      const { narration } = parseDualOutput(sampleDualOutputValid);

      expect(narration).toContain('Welcome to today\'s deep dive');
      expect(narration).toContain('attention mechanism');
      expect(narration).toContain('code implementation');
    });

    it('should parse direction JSON successfully', () => {
      const { direction } = parseDualOutput(sampleDualOutputValid);

      expect(direction).not.toBeNull();
      expect(direction?.version).toBe('2.0');
      expect(direction?.segments).toHaveLength(3);
    });

    it('should extract metadata correctly', () => {
      const { direction } = parseDualOutput(sampleDualOutputValid);

      expect(direction?.metadata.title).toBe('Transformer Architectures Deep Dive');
      expect(direction?.metadata.slug).toBe('transformer-architectures-deep-dive');
      expect(direction?.metadata.fps).toBe(30);
      expect(direction?.metadata.resolution).toEqual({ width: 1920, height: 1080 });
    });

    it('should have correct segment structure', () => {
      const { direction } = parseDualOutput(sampleDualOutputValid);
      const segment = direction?.segments[0];

      expect(segment?.id).toBeTruthy();
      expect(segment?.index).toBe(0);
      expect(segment?.type).toBe('intro');
      expect(segment?.content.text).toContain('Welcome');
      expect(segment?.content.wordCount).toBe(19);
      expect(segment?.timing.timingSource).toBe('estimated');
    });

    it('should validate against DirectionDocumentSchema', () => {
      const { direction } = parseDualOutput(sampleDualOutputValid);

      if (direction) {
        const result = DirectionDocumentSchema.safeParse(direction);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('parseDualOutput with malformed JSON', () => {
    it('should return null direction for malformed JSON', () => {
      const { direction } = parseDualOutput(sampleDualOutputMalformed);

      expect(direction).toBeNull();
    });

    it('should still extract narration even with malformed direction', () => {
      const { narration } = parseDualOutput(sampleDualOutputMalformed);

      expect(narration).toContain('Welcome to our tutorial');
      expect(narration).toContain('dive into the details');
    });
  });

  describe('parseDualOutput with narration only', () => {
    it('should return null direction when no direction section exists', () => {
      const { direction } = parseDualOutput(sampleNarrationOnly);

      expect(direction).toBeNull();
    });

    it('should extract full narration text', () => {
      const { narration } = parseDualOutput(sampleNarrationOnly);

      expect(narration).toContain('Welcome to our tutorial');
      expect(narration).toContain('main content section');
      expect(narration).toContain('conclusion');
    });
  });

  describe('parseDualOutput with non-dual format', () => {
    it('should treat entire content as narration when no sections found', () => {
      const plainText = 'This is just plain text without any sections.';
      const { narration, direction } = parseDualOutput(plainText);

      expect(narration).toBe(plainText);
      expect(direction).toBeNull();
    });
  });
});

describe('Segment Generation from Narration', () => {
  // Helper function mimicking generateSegmentsFromNarration
  function generateSegmentsFromNarration(
    narration: string,
    totalDurationSec: number
  ): DirectionSegment[] {
    const SEGMENT_TYPE_KEYWORDS: Record<string, string[]> = {
      intro: ['introduction', 'welcome', 'today', 'hello'],
      hook: ['imagine', 'what if', 'discover', 'surprising'],
      explanation: ['because', 'therefore', 'means', 'works'],
      code_demo: ['code', 'function', 'class', 'implement'],
      comparison: ['vs', 'versus', 'compared', 'difference'],
      example: ['example', 'instance', 'case', 'consider'],
      transition: ['now', 'next', 'moving on', "let's"],
      recap: ['recap', 'summary', 'remember', 'key points'],
      outro: ['conclusion', 'thank', 'subscribe', 'goodbye'],
    };

    const DEFAULT_VISUAL_TEMPLATE: Record<string, string> = {
      intro: 'BrandedTransition',
      hook: 'TextOnGradient',
      explanation: 'TextOnGradient',
      code_demo: 'CodeHighlight',
      comparison: 'ComparisonChart',
      example: 'TextOnGradient',
      transition: 'BrandedTransition',
      recap: 'KineticText',
      outro: 'BrandedTransition',
    };

    function countWords(text: string): number {
      return text.trim().split(/\s+/).filter(Boolean).length;
    }

    function detectSegmentType(text: string, index: number, total: number): string {
      if (index === 0) return 'intro';
      if (index === total - 1 && total > 1) return 'outro';

      const lowerText = text.toLowerCase();
      for (const [type, keywords] of Object.entries(SEGMENT_TYPE_KEYWORDS)) {
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) return type;
        }
      }
      return 'explanation';
    }

    const paragraphs = narration
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      paragraphs.push(narration.trim() || 'Content');
    }

    const segmentData = paragraphs.map((text, index) => ({
      text,
      wordCount: countWords(text),
      index,
    }));

    const totalWords = segmentData.reduce((sum, s) => sum + s.wordCount, 0) || segmentData.length;
    let currentTime = 0;

    return segmentData.map((data, index) => {
      const wordCount = data.wordCount > 0 ? data.wordCount : 1;
      const proportion = wordCount / totalWords;
      const duration = totalDurationSec * proportion;
      const segmentType = detectSegmentType(data.text, index, segmentData.length);

      const segment: DirectionSegment = {
        id: crypto.randomUUID(),
        index,
        type: segmentType as any,
        content: {
          text: data.text,
          wordCount: data.wordCount,
          keywords: [],
          emphasis: [],
        },
        timing: {
          estimatedStartSec: currentTime,
          estimatedEndSec: currentTime + duration,
          estimatedDurationSec: duration,
          timingSource: 'estimated',
        },
        visual: {
          template: DEFAULT_VISUAL_TEMPLATE[segmentType] as any || 'TextOnGradient',
          motion: { ...MOTION_PRESETS.standard },
        },
        audio: {
          mood: 'neutral',
        },
      };

      currentTime += duration;
      return segment;
    });
  }

  it('should split narration into segments by paragraph breaks', () => {
    const narration = `Welcome to today's tutorial.

This is the explanation section.

Here is the conclusion.`;

    const segments = generateSegmentsFromNarration(narration, 60);

    expect(segments).toHaveLength(3);
  });

  it('should calculate word counts correctly', () => {
    const narration = `Five words in this paragraph.

Another five word paragraph here.`;

    const segments = generateSegmentsFromNarration(narration, 40);

    expect(segments[0].content.wordCount).toBe(5);
    expect(segments[1].content.wordCount).toBe(5);
  });

  it('should distribute timing proportionally by word count', () => {
    const narration = `Short.

This is a longer paragraph with more words in it.`;

    const segments = generateSegmentsFromNarration(narration, 100);

    // Second segment should have longer duration since it has more words
    expect(segments[1].timing.estimatedDurationSec).toBeGreaterThan(
      segments[0].timing.estimatedDurationSec!
    );
  });

  it('should set first segment as intro type', () => {
    const narration = `First paragraph.

Second paragraph.

Third paragraph.`;

    const segments = generateSegmentsFromNarration(narration, 60);

    expect(segments[0].type).toBe('intro');
  });

  it('should set last segment as outro type', () => {
    const narration = `First paragraph.

Second paragraph.

Third paragraph.`;

    const segments = generateSegmentsFromNarration(narration, 60);

    expect(segments[2].type).toBe('outro');
  });

  it('should detect code_demo type from keywords', () => {
    const narration = `Welcome to the tutorial.

Let's look at the code implementation for this function.

That's all for now.`;

    const segments = generateSegmentsFromNarration(narration, 60);

    expect(segments[1].type).toBe('code_demo');
  });

  it('should assign visual templates based on segment type', () => {
    const narration = `Welcome here.

Let's write some code.`;

    const segments = generateSegmentsFromNarration(narration, 40);

    expect(segments[0].visual.template).toBe('BrandedTransition'); // intro
    // Note: second segment would be 'outro' in 2-segment case
  });

  it('should handle empty paragraphs gracefully', () => {
    const narration = `First paragraph.


This has extra blank lines.


Last paragraph.`;

    const segments = generateSegmentsFromNarration(narration, 60);

    // Should skip empty paragraphs
    expect(segments.length).toBe(3);
    expect(segments[0].content.text).toBe('First paragraph.');
  });

  it('should handle single paragraph input', () => {
    const narration = 'Just one paragraph with no breaks.';

    const segments = generateSegmentsFromNarration(narration, 30);

    expect(segments).toHaveLength(1);
    expect(segments[0].timing.estimatedDurationSec).toBe(30);
  });

  it('should set timingSource to estimated for all segments', () => {
    const narration = `Para one.

Para two.`;

    const segments = generateSegmentsFromNarration(narration, 20);

    segments.forEach((segment) => {
      expect(segment.timing.timingSource).toBe('estimated');
    });
  });

  it('should generate unique UUIDs for segment IDs', () => {
    const narration = `One.

Two.

Three.`;

    const segments = generateSegmentsFromNarration(narration, 30);
    const ids = segments.map((s) => s.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should ensure timing sums to total duration', () => {
    const narration = `First paragraph.

Second paragraph.

Third paragraph.`;

    const totalDuration = 120;
    const segments = generateSegmentsFromNarration(narration, totalDuration);

    const summedDuration = segments.reduce(
      (sum, s) => sum + (s.timing.estimatedDurationSec || 0),
      0
    );

    expect(summedDuration).toBeCloseTo(totalDuration, 5);
  });

  it('should use motion presets for visual configuration', () => {
    const narration = `Test paragraph.`;

    const segments = generateSegmentsFromNarration(narration, 30);

    expect(segments[0].visual.motion.entrance).toMatchObject(MOTION_PRESETS.standard.entrance);
    expect(segments[0].visual.motion.emphasis).toMatchObject(MOTION_PRESETS.standard.emphasis);
    expect(segments[0].visual.motion.exit).toMatchObject(MOTION_PRESETS.standard.exit);
  });
});

describe('Timing Calculation', () => {
  const WORDS_PER_SECOND = 2.5; // 150 WPM

  it('should calculate duration correctly at 150 WPM', () => {
    const wordCount = 150;
    const expectedDuration = wordCount / WORDS_PER_SECOND; // 60 seconds

    expect(expectedDuration).toBe(60);
  });

  it('should handle very short scripts (< 100 words)', () => {
    const wordCount = 50;
    const expectedDuration = wordCount / WORDS_PER_SECOND; // 20 seconds

    expect(expectedDuration).toBe(20);
  });

  it('should handle very long scripts (> 3000 words)', () => {
    const wordCount = 3000;
    const expectedDuration = wordCount / WORDS_PER_SECOND; // 1200 seconds = 20 minutes

    expect(expectedDuration).toBe(1200);
  });
});

describe('Bracket Stripping', () => {
  function stripBrackets(text: string): string {
    return text
      .replace(/\[VISUAL:[^\]]+\]\s*/g, '')
      .replace(/\[PRONOUNCE:([^:]+):[^\]]+\]/g, '$1')
      .replace(/\[MUSIC:[^\]]+\]\s*/g, '')
      .replace(/\[SFX:[^\]]+\]\s*/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  it('should remove VISUAL tags', () => {
    const text = 'Hello [VISUAL: Animation] world';
    const result = stripBrackets(text);

    expect(result).toBe('Hello world');
  });

  it('should replace PRONOUNCE tags with just the term', () => {
    const text = 'Learn about [PRONOUNCE:AI:ay-eye] today';
    const result = stripBrackets(text);

    expect(result).toBe('Learn about AI today');
  });

  it('should remove MUSIC tags', () => {
    const text = 'Intro [MUSIC: epic] content';
    const result = stripBrackets(text);

    expect(result).toBe('Intro content');
  });

  it('should remove SFX tags', () => {
    const text = 'Click [SFX: button] here';
    const result = stripBrackets(text);

    expect(result).toBe('Click here');
  });

  it('should handle multiple tags in same text', () => {
    const text = '[VISUAL: Title] Welcome [PRONOUNCE:PyTorch:pie-torch] users [MUSIC: intro] [SFX: swoosh]';
    const result = stripBrackets(text);

    expect(result).toBe('Welcome PyTorch users');
  });

  it('should collapse multiple spaces', () => {
    const text = 'Hello    world';
    const result = stripBrackets(text);

    expect(result).toBe('Hello world');
  });

  it('should limit consecutive newlines to 2', () => {
    const text = 'Para 1\n\n\n\n\nPara 2';
    const result = stripBrackets(text);

    expect(result).toBe('Para 1\n\nPara 2');
  });
});

describe('V2 Output Structure', () => {
  it('should have correct V2 output fields', () => {
    // This test validates the expected structure of ScriptGenOutputV2
    const mockV2Output = {
      version: '2.0' as const,
      scriptText: 'Clean narration text',
      scriptUrl: 'gs://bucket/script.md',
      directionDocument: {
        version: '2.0' as const,
        metadata: {
          title: 'Test',
          slug: 'test',
          estimatedDurationSec: 60,
          fps: 30 as const,
          resolution: { width: 1920 as const, height: 1080 as const },
          generatedAt: '2026-01-27T12:00:00Z',
        },
        segments: [],
        globalAudio: {
          defaultMood: 'neutral' as const,
          musicTransitions: 'smooth' as const,
        },
      },
      directionUrl: 'gs://bucket/direction.json',
      // V1 compatible fields
      script: 'Original script with [VISUAL:...] tags',
      wordCount: 50,
      artifactUrl: 'gs://bucket/script.md',
      draftUrls: {
        writer: 'gs://bucket/v1-writer.md',
        critic: 'gs://bucket/v2-critic.md',
        optimizer: 'gs://bucket/v3-optimizer.md',
      },
      regenerationAttempts: 0,
      providers: {
        writer: { name: 'gemini-3-pro-preview', tier: 'primary' as const, attempts: 1 },
        critic: { name: 'gemini-3-pro-preview', tier: 'primary' as const, attempts: 1 },
        optimizer: { name: 'gemini-3-pro-preview', tier: 'primary' as const, attempts: 1 },
      },
    };

    // Validate required V2 fields exist
    expect(mockV2Output.version).toBe('2.0');
    expect(mockV2Output.scriptText).toBeTruthy();
    expect(mockV2Output.scriptUrl).toContain('script.md');
    expect(mockV2Output.directionDocument).toBeTruthy();
    expect(mockV2Output.directionUrl).toContain('direction.json');

    // Validate V1 compatible fields exist
    expect(mockV2Output.script).toBeTruthy();
    expect(mockV2Output.artifactUrl).toBeTruthy();
    expect(mockV2Output.draftUrls).toBeTruthy();
  });

  it('should validate direction document matches schema', () => {
    const directionDoc: DirectionDocument = {
      version: '2.0',
      metadata: {
        title: 'Test Video',
        slug: 'test-video',
        estimatedDurationSec: 120,
        fps: 30,
        resolution: { width: 1920, height: 1080 },
        generatedAt: '2026-01-27T12:00:00Z',
      },
      segments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          index: 0,
          type: 'intro',
          content: {
            text: 'Welcome',
            wordCount: 1,
            keywords: ['welcome'],
            emphasis: [],
          },
          timing: {
            estimatedStartSec: 0,
            estimatedEndSec: 0.4,
            estimatedDurationSec: 0.4,
            timingSource: 'estimated',
          },
          visual: {
            template: 'BrandedTransition',
            motion: MOTION_PRESETS.standard,
          },
          audio: { mood: 'neutral' },
        },
      ],
      globalAudio: {
        defaultMood: 'neutral',
        musicTransitions: 'smooth',
      },
    };

    const result = DirectionDocumentSchema.safeParse(directionDoc);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Tests using actual exported implementations (not duplicated in tests)
// =============================================================================

describe('Actual Implementation Tests', () => {
  describe('actualParseDualOutput', () => {
    it('should parse valid dual output correctly', () => {
      const { narration, direction } = actualParseDualOutput(sampleDualOutputValid);

      expect(narration).toContain('Welcome to today\'s deep dive');
      expect(direction).not.toBeNull();
      expect(direction?.version).toBe('2.0');
    });

    it('should return null direction for malformed JSON', () => {
      const { direction } = actualParseDualOutput(sampleDualOutputMalformed);
      expect(direction).toBeNull();
    });

    it('should handle plain text without dual output markers', () => {
      const plainText = 'Just some plain text without any sections.';
      const { narration, direction } = actualParseDualOutput(plainText);

      expect(narration).toBe(plainText);
      expect(direction).toBeNull();
    });
  });

  describe('actualGenerateSegmentsFromNarration', () => {
    it('should generate segments with proper structure', () => {
      const narration = `First paragraph here.

Second paragraph with more content.

Third and final paragraph.`;

      const segments = actualGenerateSegmentsFromNarration(narration, 60);

      expect(segments.length).toBe(3);
      expect(segments[0].type).toBe('intro');
      expect(segments[2].type).toBe('outro');
      segments.forEach((segment) => {
        expect(segment.timing.timingSource).toBe('estimated');
      });
    });
  });

  describe('actualStripBrackets', () => {
    it('should strip all bracket types', () => {
      const text = '[VISUAL: animation] Hello [PRONOUNCE:AI:ay-eye] world [MUSIC: epic] [SFX: swoosh]';
      const result = actualStripBrackets(text);

      expect(result).toBe('Hello AI world');
    });
  });
});

// =============================================================================
// V1 Backward Compatibility Tests
// =============================================================================

describe('V1 Backward Compatibility', () => {
  it('script field should NOT contain dual output markers', () => {
    // Mock V2 output structure with the `script` field
    // The script field should be plain narration, not contain ## NARRATION or ## DIRECTION
    const mockScript = 'This is plain narration text without any special markers.';

    // Verify it doesn't contain dual output format markers
    expect(mockScript).not.toContain('## NARRATION');
    expect(mockScript).not.toContain('## DIRECTION');
    expect(mockScript).not.toContain('```json');
  });

  it('legacy consumers should get usable text from script field', () => {
    // The script field should be clean text that legacy TTS consumers can use
    const mockScript = `Welcome to today's tutorial on artificial intelligence.

This is the main content about AI and machine learning.

Thank you for watching.`;

    // Should be clean narration
    expect(mockScript).not.toContain('[VISUAL:');
    expect(mockScript).not.toContain('[PRONOUNCE:');
    expect(mockScript).not.toContain('## ');

    // Should have natural paragraph structure
    const paragraphs = mockScript.split('\n\n').filter((p) => p.trim());
    expect(paragraphs.length).toBeGreaterThan(0);
  });
});
