/**
 * Meme Selector Tests
 *
 * Validates the "taste engine" that decides IF and WHAT meme reaction
 * should appear after a given scene.
 */

import { describe, it, expect } from 'vitest';
import { selectMemeReaction } from '../meme/meme-selector.js';
import type { MemeContext } from '../meme/meme-selector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultContext(overrides: Partial<MemeContext> = {}): MemeContext {
  return {
    previousWasMeme: false,
    totalMemeCount: 0,
    sceneIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reaction type detection
// ---------------------------------------------------------------------------

describe('selectMemeReaction — reaction type detection', () => {
  it('returns "rip" for stat with "700" + "replaced"', () => {
    const result = selectMemeReaction(
      'Klarna replaced 700 full-time agents with AI.',
      'stat-callout',
      200,
      defaultContext(),
      { number: '700', label: 'agents replaced' },
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('rip');
  });

  it('returns "mind_blown" for stat with "2.3 million"', () => {
    const result = selectMemeReaction(
      'The platform now serves 2.3 million active users every month.',
      'stat-callout',
      200,
      defaultContext(),
      { number: '2.3M', label: 'active users' },
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('mind_blown');
  });

  it('returns "money" for stat with revenue + billion', () => {
    const result = selectMemeReaction(
      'Revenue reached 5 billion dollars in Q4.',
      'stat-callout',
      200,
      defaultContext(),
      { number: '5B', label: 'quarterly revenue' },
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('money');
  });

  it('returns "shocked" for "unprecedented growth"', () => {
    const result = selectMemeReaction(
      'The company experienced unprecedented growth in the market.',
      'narration-default',
      200,
      defaultContext(),
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('shocked');
  });

  it('returns "this_is_fine" for ironic failure statement', () => {
    const result = selectMemeReaction(
      'The rollout was supposed to be smooth, but everything went wrong and the system crashed.',
      'text-emphasis',
      200,
      defaultContext(),
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('this_is_fine');
  });

  it('returns "speed" for rapid change language', () => {
    const result = selectMemeReaction(
      'The entire industry transformed overnight.',
      'narration-default',
      200,
      defaultContext(),
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('speed');
  });

  it('returns "impressed" for comparison with "better"', () => {
    const result = selectMemeReaction(
      'The new approach is dramatically better and faster.',
      'comparison',
      200,
      defaultContext(),
    );
    expect(result).toBeDefined();
    expect(result!.reactionType).toBe('impressed');
  });

  it('returns a search query with the selection', () => {
    const result = selectMemeReaction(
      'The AI performed the staggering task of replacing thousands.',
      'text-emphasis',
      200,
      defaultContext(),
    );
    expect(result).toBeDefined();
    expect(result!.searchQuery).toBeTruthy();
    expect(typeof result!.searchQuery).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Guard clauses — when NOT to insert a meme
// ---------------------------------------------------------------------------

describe('selectMemeReaction — guard clauses', () => {
  it('returns null for intro scene', () => {
    const result = selectMemeReaction(
      'Welcome to this staggering episode.',
      'intro',
      200,
      defaultContext(),
    );
    expect(result).toBeNull();
  });

  it('returns null for outro scene', () => {
    const result = selectMemeReaction(
      'Thanks for watching this unprecedented show.',
      'outro',
      200,
      defaultContext(),
    );
    expect(result).toBeNull();
  });

  it('returns null for quote scene', () => {
    const result = selectMemeReaction(
      'As he said, the growth was staggering.',
      'quote',
      200,
      defaultContext(),
    );
    expect(result).toBeNull();
  });

  it('returns null for chapter-break scene', () => {
    const result = selectMemeReaction(
      'The unprecedented rise of AI.',
      'chapter-break',
      200,
      defaultContext(),
    );
    expect(result).toBeNull();
  });

  it('returns null when previous scene was a meme (no back-to-back)', () => {
    const result = selectMemeReaction(
      'The growth was staggering and unprecedented.',
      'narration-default',
      200,
      defaultContext({ previousWasMeme: true }),
    );
    expect(result).toBeNull();
  });

  it('returns null when max memes reached (5)', () => {
    const result = selectMemeReaction(
      'The growth was staggering and unprecedented.',
      'narration-default',
      200,
      defaultContext({ totalMemeCount: 5 }),
    );
    expect(result).toBeNull();
  });

  it('returns null for short scene (< 120 frames)', () => {
    const result = selectMemeReaction(
      'The growth was staggering.',
      'narration-default',
      80,
      defaultContext(),
    );
    expect(result).toBeNull();
  });

  it('returns null when text has no triggering patterns', () => {
    const result = selectMemeReaction(
      'The landscape of enterprise software is changing.',
      'narration-default',
      200,
      defaultContext(),
    );
    expect(result).toBeNull();
  });
});
