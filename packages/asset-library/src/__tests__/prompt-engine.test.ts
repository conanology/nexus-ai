/**
 * Prompt Engine Tests
 *
 * Validates concept classification, mood determination, master prompt building,
 * and scene-type-aware prompt construction. No API calls required.
 */

import { describe, it, expect } from 'vitest';
import {
  IMAGE_STYLE_GUIDE,
  SCENE_VISUAL_LANGUAGE,
  classifySceneConcept,
  determineMood,
  buildMasterPrompt,
  buildPromptForScene,
} from '../image-gen/prompt-engine.js';

// ---------------------------------------------------------------------------
// classifySceneConcept
// ---------------------------------------------------------------------------

describe('classifySceneConcept', () => {
  it('classifies "Klarna replaced 700 agents" → scale_and_numbers + people_and_workforce', () => {
    const concepts = classifySceneConcept('Klarna replaced 700 agents');
    expect(concepts).toContain('scale_and_numbers');
    expect(concepts).toContain('people_and_workforce');
  });

  it('classifies "Traditional SaaS vs AI-Native" → competition_and_comparison + business_and_saas', () => {
    const concepts = classifySceneConcept('Traditional SaaS vs AI-Native');
    expect(concepts).toContain('competition_and_comparison');
    expect(concepts).toContain('business_and_saas');
  });

  it('classifies "The future of AI" → ai_and_automation', () => {
    const concepts = classifySceneConcept('The future of AI');
    expect(concepts).toContain('ai_and_automation');
  });

  it('classifies "billion dollar revenue" → money_and_economics + scale_and_numbers', () => {
    const concepts = classifySceneConcept('billion dollar revenue');
    expect(concepts).toContain('money_and_economics');
    expect(concepts).toContain('scale_and_numbers');
  });

  it('classifies "In 2019, the landscape shifted dramatically" → time_and_history + disruption_and_change', () => {
    const concepts = classifySceneConcept('In 2019, the landscape shifted dramatically');
    expect(concepts).toContain('time_and_history');
    expect(concepts).toContain('disruption_and_change');
  });

  it('classifies text about servers and data → technology_and_infrastructure', () => {
    const concepts = classifySceneConcept('The server infrastructure handles petabytes of data');
    expect(concepts).toContain('technology_and_infrastructure');
  });

  it('defaults to technology_and_infrastructure for unrelated text', () => {
    const concepts = classifySceneConcept('The quick brown fox jumps over the lazy dog');
    expect(concepts).toEqual(['technology_and_infrastructure']);
  });

  it('returns at most 3 concepts', () => {
    const concepts = classifySceneConcept(
      'AI agents replaced 700 employees at a SaaS company, disrupting the traditional workforce model since 2020',
    );
    expect(concepts.length).toBeLessThanOrEqual(3);
  });

  it('ranks concepts by keyword match count (highest first)', () => {
    // "AI agents automate machine tasks" → many ai_and_automation keywords
    const concepts = classifySceneConcept(
      'AI agents automate machine tasks while the cost of revenue shifts',
    );
    expect(concepts[0]).toBe('ai_and_automation');
  });
});

// ---------------------------------------------------------------------------
// determineMood
// ---------------------------------------------------------------------------

describe('determineMood', () => {
  it('returns dramatic for stat-callout type', () => {
    expect(determineMood('stat-callout', 'any text')).toBe('dramatic');
  });

  it('returns dramatic for chapter-break type', () => {
    expect(determineMood('chapter-break', 'any text')).toBe('dramatic');
  });

  it('returns contemplative for quote type', () => {
    expect(determineMood('quote', 'any text')).toBe('contemplative');
  });

  it('returns energetic for comparison type', () => {
    expect(determineMood('comparison', 'any text')).toBe('energetic');
  });

  it('returns energetic for list-reveal type', () => {
    expect(determineMood('list-reveal', 'any text')).toBe('energetic');
  });

  it('returns dramatic for text with "unprecedented"', () => {
    expect(determineMood('narration-default', 'This unprecedented shift')).toBe('dramatic');
  });

  it('returns contemplative for text with "imagine"', () => {
    expect(determineMood('narration-default', 'Imagine a world where')).toBe('contemplative');
  });

  it('returns energetic for text with "rapidly"', () => {
    expect(determineMood('narration-default', 'The market is rapidly expanding')).toBe('energetic');
  });

  it('returns neutral for narration-default with neutral text', () => {
    expect(determineMood('narration-default', 'This is a basic explanation')).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// buildMasterPrompt
// ---------------------------------------------------------------------------

describe('buildMasterPrompt', () => {
  const baseParams = {
    sceneType: 'stat-callout' as const,
    sceneText: '700 agents replaced',
    topic: 'AI disrupting SaaS',
    mood: 'dramatic' as const,
    concepts: ['scale_and_numbers', 'people_and_workforce'],
  };

  it('includes IMAGE_STYLE_GUIDE in output', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain(IMAGE_STYLE_GUIDE);
  });

  it('includes scene-specific direction for stat-callout', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('DRAMATIC MOMENT');
    expect(prompt).toContain('SCALE and IMPACT');
  });

  it('includes mood modifier', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('Push the contrast');
  });

  it('includes primary visual concept from SCENE_VISUAL_LANGUAGE', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain(SCENE_VISUAL_LANGUAGE['scale_and_numbers']);
  });

  it('includes secondary visual element when 2+ concepts', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('Secondary visual element:');
    expect(prompt).toContain(SCENE_VISUAL_LANGUAGE['people_and_workforce']);
  });

  it('includes continuity reference when previousImagePrompt is provided', () => {
    const prompt = buildMasterPrompt({
      ...baseParams,
      previousImagePrompt: 'A vast server room with cyan lighting',
    });
    expect(prompt).toContain('[CONTINUITY]');
    expect(prompt).toContain('A vast server room with cyan lighting');
    expect(prompt).toContain('natural visual progression');
  });

  it('omits continuity section when no previous prompt', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).not.toContain('[CONTINUITY]');
  });

  it('includes "ABSOLUTELY NO" text rule in every prompt (via style guide)', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('ABSOLUTELY NO: Text, words, letters, numbers');
  });

  it('includes scene context with topic', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('AI disrupting SaaS');
  });

  it('includes negative text reinforcement in scene context', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('THEMATIC CONTEXT ONLY');
    expect(prompt).toContain('ZERO readable text');
  });

  it('ends with "Generate a single stunning image."', () => {
    const prompt = buildMasterPrompt(baseParams);
    expect(prompt).toContain('Generate a single stunning image.');
  });

  it('includes scene-specific direction for text-emphasis', () => {
    const prompt = buildMasterPrompt({
      ...baseParams,
      sceneType: 'text-emphasis',
    });
    expect(prompt).toContain('KEY STATEMENT moment');
  });

  it('includes scene-specific direction for comparison', () => {
    const prompt = buildMasterPrompt({
      ...baseParams,
      sceneType: 'comparison',
      mood: 'energetic',
    });
    expect(prompt).toContain('SPLIT CONCEPT');
    expect(prompt).toContain('left/right division');
  });

  it('includes scene-specific direction for chapter-break', () => {
    const prompt = buildMasterPrompt({
      ...baseParams,
      sceneType: 'chapter-break',
    });
    expect(prompt).toContain('TRANSITION moment');
    expect(prompt).toContain('BOLD and WIDE');
  });

  it('includes scene-specific direction for quote', () => {
    const prompt = buildMasterPrompt({
      ...baseParams,
      sceneType: 'quote',
      mood: 'contemplative',
    });
    expect(prompt).toContain('CONTEMPLATIVE and ELEGANT');
  });
});

// ---------------------------------------------------------------------------
// buildPromptForScene
// ---------------------------------------------------------------------------

describe('buildPromptForScene', () => {
  it('returns null for intro scene type', () => {
    const result = buildPromptForScene(
      { type: 'intro', content: 'Welcome', visualData: {} },
      'Tech topic',
    );
    expect(result).toBeNull();
  });

  it('returns null for outro scene type', () => {
    const result = buildPromptForScene(
      { type: 'outro', content: 'Goodbye', visualData: {} },
      'Tech topic',
    );
    expect(result).toBeNull();
  });

  it('returns null for logo-showcase scene type', () => {
    const result = buildPromptForScene(
      { type: 'logo-showcase', content: 'Companies', visualData: { logos: [], layout: 'grid' } },
      'Tech topic',
    );
    expect(result).toBeNull();
  });

  it('returns null for code-block scene type', () => {
    const result = buildPromptForScene(
      { type: 'code-block', content: 'Code', visualData: { code: 'console.log()' } },
      'Tech topic',
    );
    expect(result).toBeNull();
  });

  it('returns a prompt string for stat-callout with thematic description', () => {
    const result = buildPromptForScene(
      {
        type: 'stat-callout',
        content: 'The AI replaced 700 agents',
        visualData: { number: '700', label: 'agents replaced' },
      },
      'AI disrupting customer service',
    );
    expect(result).toBeTypeOf('string');
    // Should NOT contain literal numbers/labels — should contain thematic description
    expect(result).not.toContain('700 agents replaced');
    expect(result).toContain('dramatic');
  });

  it('returns a prompt string for text-emphasis with cleaned text', () => {
    const result = buildPromptForScene(
      {
        type: 'text-emphasis',
        content: 'Key statement',
        visualData: { phrase: 'The formula was incredibly consistent', style: 'fade' },
      },
      'Tech topic',
    );
    expect(result).toBeTypeOf('string');
    // stripLiterals leaves non-numeric text mostly intact
    expect(result).toContain('formula was incredibly consistent');
  });

  it('returns a prompt string for full-screen-text with cleaned text', () => {
    const result = buildPromptForScene(
      {
        type: 'full-screen-text',
        content: 'Big statement',
        visualData: { text: 'What if everything changed?' },
      },
      'Tech topic',
    );
    expect(result).toBeTypeOf('string');
    expect(result).toContain('everything changed');
  });

  it('returns a prompt for comparison with conceptual description', () => {
    const result = buildPromptForScene(
      {
        type: 'comparison',
        content: 'Comparing old and new',
        visualData: {
          left: { title: 'Traditional SaaS', items: [] },
          right: { title: 'AI-Native', items: [] },
        },
      },
      'SaaS disruption',
    );
    expect(result).toBeTypeOf('string');
    // Should not contain raw "Traditional SaaS vs AI-Native", but a thematic description
    expect(result).toContain('comparison');
  });

  it('returns a prompt for narration-default using cleaned scene content', () => {
    const result = buildPromptForScene(
      {
        type: 'narration-default',
        content: 'The landscape is evolving rapidly',
        visualData: {},
      },
      'Tech evolution',
    );
    expect(result).toBeTypeOf('string');
    expect(result).toContain('landscape is evolving rapidly');
  });

  it('returns a prompt for chapter-break with cleaned title', () => {
    const result = buildPromptForScene(
      {
        type: 'chapter-break',
        content: 'Section 2',
        visualData: { title: 'The Rise of AI Agents' },
      },
      'AI topic',
    );
    expect(result).toBeTypeOf('string');
    // "The Rise of AI Agents" → stripLiterals keeps "The Rise of ai agents"
    expect(result).toContain('Rise of');
  });

  it('includes visual continuity when previousPrompt is provided', () => {
    const result = buildPromptForScene(
      {
        type: 'text-emphasis',
        content: 'Next scene',
        visualData: { phrase: 'A key insight', style: 'slam' },
      },
      'Topic',
      'A vast cityscape with glowing servers',
    );
    expect(result).toContain('[CONTINUITY]');
    expect(result).toContain('A vast cityscape with glowing servers');
  });

  it('always includes the no-text rule', () => {
    const result = buildPromptForScene(
      {
        type: 'diagram',
        content: 'Architecture overview',
        visualData: {
          nodes: [{ id: '1', label: 'Gateway' }, { id: '2', label: 'Service' }],
          edges: [],
          layout: 'horizontal',
        },
      },
      'System architecture',
    );
    expect(result).toContain('ABSOLUTELY NO: Text, words, letters, numbers');
  });

  it('handles timeline with thematic event descriptions', () => {
    const result = buildPromptForScene(
      {
        type: 'timeline',
        content: 'History',
        visualData: {
          events: [
            { year: '2019', label: 'GPT-2', description: 'Language model released' },
            { year: '2022', label: 'ChatGPT', description: 'Consumer AI launched' },
          ],
        },
      },
      'AI history',
    );
    expect(result).toBeTypeOf('string');
    expect(result).toContain('timeline');
    expect(result).toContain('progression');
  });

  it('handles list-reveal with thematic title', () => {
    const result = buildPromptForScene(
      {
        type: 'list-reveal',
        content: 'Key ingredients for a successful startup',
        visualData: {
          title: 'Key Ingredients for Success',
          items: ['Build the tool', 'Launch it', 'Scale it'],
          style: 'numbered',
        },
      },
      'Startup advice',
    );
    expect(result).toBeTypeOf('string');
    // stripLiterals preserves non-numeric text, describeTextTheme passes it through
    expect(result).toContain('Key Ingredients');
  });

  it('handles quote with cleaned text', () => {
    const result = buildPromptForScene(
      {
        type: 'quote',
        content: 'Famous quote',
        visualData: { text: 'The best way to predict the future is to create it', attribution: 'Peter Drucker' },
      },
      'Innovation',
    );
    expect(result).toBeTypeOf('string');
    expect(result).toContain('predict the future');
  });
});
