/**
 * Tests for visual cue parser
 */

import { describe, it, expect } from 'vitest';
import { parseVisualCues } from '../visual-cue-parser.js';

describe('parseVisualCues', () => {
  it('should extract a single visual cue from script', () => {
    const script = 'This is a test script. [VISUAL: neural network animation] More content here.';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({
      index: 0,
      description: 'neural network animation',
      context: 'This is a test script. [VISUAL: neural network animation] More content here.',
      position: 23
    });
  });

  it('should extract multiple visual cues from script', () => {
    const script = 'Start [VISUAL: data flow diagram] middle [VISUAL: comparison chart] end.';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(2);
    expect(cues[0].description).toBe('data flow diagram');
    expect(cues[1].description).toBe('comparison chart');
  });

  it('should handle visual cues with extra whitespace', () => {
    const script = '[VISUAL:   neural network  ]';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(1);
    expect(cues[0].description).toBe('neural network');
  });

  it('should handle nested brackets gracefully', () => {
    const script = '[VISUAL: data flow [stage 1] diagram]';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(1);
    expect(cues[0].description).toBe('data flow [stage 1');
  });

  it('should handle malformed syntax by skipping invalid markers', () => {
    const script = '[VISUAL: valid] [VISUAL invalid] [VISUAL: also valid]';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(2);
    expect(cues[0].description).toBe('valid');
    expect(cues[1].description).toBe('also valid');
  });

  it('should handle empty descriptions', () => {
    const script = '[VISUAL: ] content [VISUAL:] more';
    const cues = parseVisualCues(script);

    // Empty descriptions should be filtered out
    expect(cues).toHaveLength(0);
  });

  it('should return empty array for script without visual cues', () => {
    const script = 'This is a script without any visual markers.';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(0);
  });

  it('should handle case-insensitive VISUAL marker', () => {
    const script = '[visual: test] [Visual: test2] [VISUAL: test3]';
    const cues = parseVisualCues(script);

    expect(cues).toHaveLength(3);
  });

  it('should preserve context around the visual cue', () => {
    const script = 'Before text [VISUAL: neural network] after text';
    const cues = parseVisualCues(script);

    expect(cues[0].context).toBe(script);
  });

  it('should track correct position for each cue', () => {
    const script = 'Start [VISUAL: first] middle [VISUAL: second] end';
    const cues = parseVisualCues(script);

    expect(cues[0].position).toBe(6);
    expect(cues[1].position).toBe(29);
  });

  it('should assign sequential indices to cues', () => {
    const script = '[VISUAL: one] [VISUAL: two] [VISUAL: three]';
    const cues = parseVisualCues(script);

    expect(cues[0].index).toBe(0);
    expect(cues[1].index).toBe(1);
    expect(cues[2].index).toBe(2);
  });
});
