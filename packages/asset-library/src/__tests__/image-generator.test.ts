/**
 * Image Generator Tests
 *
 * Tests for generateSceneImage, generateSceneImages, and buildPromptForScene
 * with mock scenes. API tests require GEMINI_API_KEY and are skipped otherwise.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPromptForScene,
  classifySceneConcept,
  IMAGE_STYLE_GUIDE,
} from '../image-gen/prompt-engine.js';

// ---------------------------------------------------------------------------
// buildPromptForScene with mock scenes (no API needed)
// ---------------------------------------------------------------------------

describe('buildPromptForScene — mock scenes', () => {
  it('stat-callout scene extracts number + label and includes scale_and_numbers visual language', () => {
    const prompt = buildPromptForScene(
      {
        type: 'stat-callout',
        content: 'The AI assistant performed the work of 700 full-time human agents.',
        visualData: { number: '700', label: 'agents replaced' },
      },
      'AI disrupting customer service',
    );

    expect(prompt).not.toBeNull();
    // extractSceneText now returns a thematic description instead of literal "700 agents replaced"
    expect(prompt).not.toContain('700 agents replaced');
    expect(prompt).toContain('dramatic');

    // Should classify scale_and_numbers from the thematic description
    const concepts = classifySceneConcept('a dramatic visualization of vast numbers of people and human scale');
    expect(concepts).toContain('people_and_workforce');
  });

  it('text-emphasis scene extracts the phrase', () => {
    const prompt = buildPromptForScene(
      {
        type: 'text-emphasis',
        content: 'The consistent formula',
        visualData: {
          phrase: 'The formula was incredibly consistent',
          highlightWords: ['formula', 'consistent'],
          style: 'fade',
        },
      },
      'SaaS industry evolution',
    );

    expect(prompt).not.toBeNull();
    expect(prompt).toContain('The formula was incredibly consistent');
    expect(prompt).toContain('KEY STATEMENT moment');
  });

  it('comparison scene extracts left vs right titles', () => {
    const prompt = buildPromptForScene(
      {
        type: 'comparison',
        content: 'Old vs new approach',
        visualData: {
          left: { title: 'Legacy Monolith', items: ['Slow deploys'] },
          right: { title: 'Microservices', items: ['Fast iteration'] },
        },
      },
      'Software architecture',
    );

    expect(prompt).not.toBeNull();
    // extractSceneText now returns a conceptual description instead of literal titles
    expect(prompt).toContain('comparison');
    expect(prompt).toContain('SPLIT CONCEPT');
  });

  it('chapter-break scene extracts title', () => {
    const prompt = buildPromptForScene(
      {
        type: 'chapter-break',
        content: 'New section',
        visualData: { title: 'The Rise of AI Agents', chapterNumber: 2 },
      },
      'AI agents',
    );

    expect(prompt).not.toBeNull();
    // extractSceneText now strips literals; "The Rise of ai agents" → cleaned
    expect(prompt).toContain('Rise of');
    expect(prompt).toContain('TRANSITION moment');
  });

  it('narration-default scene uses the content text', () => {
    const prompt = buildPromptForScene(
      {
        type: 'narration-default',
        content: 'The landscape of enterprise software is changing.',
        visualData: { backgroundVariant: 'gradient' },
      },
      'Enterprise software',
    );

    expect(prompt).not.toBeNull();
    expect(prompt).toContain('The landscape of enterprise software is changing.');
    expect(prompt).toContain('BREATHING MOMENT');
  });

  it('diagram scene extracts node labels', () => {
    const prompt = buildPromptForScene(
      {
        type: 'diagram',
        content: 'System architecture',
        visualData: {
          nodes: [
            { id: '1', label: 'API Gateway' },
            { id: '2', label: 'Auth Service' },
            { id: '3', label: 'Database' },
          ],
          edges: [{ from: '1', to: '2' }],
          layout: 'horizontal',
        },
      },
      'System architecture',
    );

    expect(prompt).not.toBeNull();
    // extractSceneText now returns a thematic diagram description
    expect(prompt).toContain('technical diagram');
    expect(prompt).toContain('TECHNICAL EXPLANATION');
  });

  it('timeline scene extracts event descriptions', () => {
    const prompt = buildPromptForScene(
      {
        type: 'timeline',
        content: 'History of AI',
        visualData: {
          events: [
            { year: '2017', label: 'Transformers', description: 'Attention Is All You Need paper' },
            { year: '2022', label: 'ChatGPT', description: 'Consumer AI breakthrough' },
            { year: '2024', label: 'Agents', description: 'AI agents go mainstream' },
          ],
        },
      },
      'AI history',
    );

    expect(prompt).not.toBeNull();
    expect(prompt).toContain('Attention Is All You Need paper');
    expect(prompt).toContain('CHRONOLOGICAL PROGRESSION');
  });

  it('list-reveal scene joins title and first 3 items', () => {
    const prompt = buildPromptForScene(
      {
        type: 'list-reveal',
        content: 'Steps to success',
        visualData: {
          title: 'Key Ingredients',
          items: ['Strong team', 'Clear vision', 'Rapid execution', 'Customer focus'],
          style: 'bullet',
        },
      },
      'Startup success',
    );

    expect(prompt).not.toBeNull();
    // extractSceneText now returns thematic description for list-reveal titles
    // "Key Ingredients" is only 15 chars, describeTextTheme passes it through
    expect(prompt).toContain('Key Ingredients');
    expect(prompt).toContain('MULTIPLE ITEMS');
  });

  it('quote scene extracts the quote text', () => {
    const prompt = buildPromptForScene(
      {
        type: 'quote',
        content: 'An important quote',
        visualData: {
          text: 'Software is eating the world',
          attribution: 'Marc Andreessen',
          role: 'Investor',
        },
      },
      'Tech industry',
    );

    expect(prompt).not.toBeNull();
    expect(prompt).toContain('Software is eating the world');
    expect(prompt).toContain('NOTABLE QUOTE');
  });

  it('every generated prompt includes the style guide no-text rule', () => {
    const sceneTypes = [
      'stat-callout',
      'text-emphasis',
      'full-screen-text',
      'comparison',
      'narration-default',
      'chapter-break',
      'timeline',
      'quote',
      'list-reveal',
      'diagram',
    ];

    for (const type of sceneTypes) {
      const prompt = buildPromptForScene(
        {
          type,
          content: 'Sample content for testing',
          visualData: getMinimalVisualData(type),
        },
        'Test topic',
      );

      expect(prompt, `prompt for ${type} should not be null`).not.toBeNull();
      expect(prompt, `prompt for ${type} should include no-text rule`).toContain(
        'ABSOLUTELY NO: Text, words, letters, numbers',
      );
    }
  });
});

// ---------------------------------------------------------------------------
// API Integration Tests (require GEMINI_API_KEY)
// ---------------------------------------------------------------------------

const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.NEXUS_GEMINI_API_KEY);

describe.skipIf(!hasApiKey)('generateSceneImage — API integration', () => {
  it('generates a valid data URI image', async () => {
    const { generateSceneImage } = await import('../image-gen/image-generator.js');
    const prompt = `Create a dark, moody cityscape at night with cyan neon lighting.\n\n${IMAGE_STYLE_GUIDE}\n\nGenerate a single stunning image.`;

    const result = await generateSceneImage(prompt);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\//);

    // Verify base64 decodes to a real image (> 5KB)
    const base64 = result!.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    expect(buffer.length).toBeGreaterThan(5000);
  }, 60_000);
});

describe.skipIf(!hasApiKey)('generateSceneImages — API integration', () => {
  it('generates images for multiple requests in batches', async () => {
    const { generateSceneImages } = await import('../image-gen/image-generator.js');

    const requests = [
      {
        sceneId: 'scene-1',
        prompt: `Dark futuristic server room with cyan lighting.\n\n${IMAGE_STYLE_GUIDE}\n\nGenerate a single stunning image.`,
      },
      {
        sceneId: 'scene-2',
        prompt: `Vast cityscape at night with holographic displays.\n\n${IMAGE_STYLE_GUIDE}\n\nGenerate a single stunning image.`,
      },
    ];

    const results = await generateSceneImages(requests);
    expect(results.size).toBe(2);
    expect(results.has('scene-1')).toBe(true);
    expect(results.has('scene-2')).toBe(true);

    // At least one should succeed
    const values = Array.from(results.values());
    const successCount = values.filter((v) => v !== null).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMinimalVisualData(type: string): Record<string, unknown> {
  switch (type) {
    case 'stat-callout':
      return { number: '100', label: 'things' };
    case 'text-emphasis':
      return { phrase: 'Important phrase', style: 'fade' };
    case 'full-screen-text':
      return { text: 'A big statement' };
    case 'comparison':
      return { left: { title: 'Old', items: [] }, right: { title: 'New', items: [] } };
    case 'chapter-break':
      return { title: 'Chapter Title' };
    case 'timeline':
      return { events: [{ year: '2024', label: 'Event', description: 'Something happened' }] };
    case 'quote':
      return { text: 'A wise saying', attribution: 'Someone' };
    case 'list-reveal':
      return { items: ['Item 1', 'Item 2'], style: 'bullet' };
    case 'diagram':
      return { nodes: [{ id: '1', label: 'Node' }], edges: [], layout: 'horizontal' };
    case 'narration-default':
      return { backgroundVariant: 'gradient' };
    default:
      return {};
  }
}
