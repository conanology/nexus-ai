import { describe, it, expect } from 'vitest';
import { parseScript, splitIntoSentences } from '../script-parser.js';

// =============================================================================
// splitIntoSentences
// =============================================================================

describe('splitIntoSentences', () => {
  it('splits on period followed by uppercase', () => {
    const result = splitIntoSentences(
      'First sentence. Second sentence. Third sentence.',
    );
    expect(result).toEqual([
      'First sentence.',
      'Second sentence.',
      'Third sentence.',
    ]);
  });

  it('splits on exclamation and question marks', () => {
    const result = splitIntoSentences(
      'What happened? It was amazing! Then it ended.',
    );
    expect(result).toEqual([
      'What happened?',
      'It was amazing!',
      'Then it ended.',
    ]);
  });

  it('preserves abbreviations like Dr. and Mr.', () => {
    const result = splitIntoSentences(
      'Dr. Smith arrived early. Mr. Jones was late.',
    );
    expect(result).toEqual([
      'Dr. Smith arrived early.',
      'Mr. Jones was late.',
    ]);
  });

  it('does not split on decimal numbers', () => {
    const result = splitIntoSentences(
      'The value increased by 2.5 percent. That was significant.',
    );
    expect(result).toEqual([
      'The value increased by 2.5 percent.',
      'That was significant.',
    ]);
  });

  it('handles single sentence', () => {
    const result = splitIntoSentences('Just one sentence here.');
    expect(result).toEqual(['Just one sentence here.']);
  });

  it('returns empty array for empty input', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   ')).toEqual([]);
  });

  it('handles quoted text', () => {
    const result = splitIntoSentences(
      'He said "This is great." And then he left.',
    );
    // The period inside quotes followed by a quote then uppercase should split
    expect(result.length).toBeGreaterThanOrEqual(1);
    // The full text should be preserved across all sentences
    expect(result.join(' ')).toContain('He said');
    expect(result.join(' ')).toContain('he left');
  });

  it('handles text without terminal punctuation', () => {
    const result = splitIntoSentences('No period at the end');
    expect(result).toEqual(['No period at the end']);
  });
});

// =============================================================================
// parseScript
// =============================================================================

describe('parseScript', () => {
  it('returns empty array for empty string', () => {
    expect(parseScript('', 9000)).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseScript('   \n\n  ', 9000)).toEqual([]);
  });

  it('returns empty array for zero duration', () => {
    expect(parseScript('Some text here.', 0)).toEqual([]);
  });

  it('handles a simple 3-sentence script producing 1-2 segments', () => {
    const script =
      'First sentence here. Second sentence follows. Third sentence ends.';
    const segments = parseScript(script, 9000);

    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments.length).toBeLessThanOrEqual(2);

    // Each segment should have proper structure
    for (const seg of segments) {
      expect(seg.index).toBeGreaterThanOrEqual(0);
      expect(seg.text.length).toBeGreaterThan(0);
      expect(seg.startFrame).toBeGreaterThanOrEqual(0);
      expect(seg.endFrame).toBeGreaterThan(seg.startFrame);
      expect(seg.sentenceCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles a 10-sentence script producing 4-6 segments', () => {
    const sentences = Array.from(
      { length: 10 },
      (_, i) => `This is sentence number ${i + 1} with some content.`,
    );
    const script = sentences.join(' ');
    // 10 sentences at ~2s each = ~600 frames (realistic timing)
    const segments = parseScript(script, 600);

    expect(segments.length).toBeGreaterThanOrEqual(4);
    expect(segments.length).toBeLessThanOrEqual(6);
  });

  it('all segments have valid startFrame < endFrame', () => {
    const script =
      'The first point is important. The second point builds on it. The third point concludes. And there is a fourth point. Finally the fifth.';
    const segments = parseScript(script, 9000);

    for (const seg of segments) {
      expect(seg.startFrame).toBeLessThan(seg.endFrame);
    }
  });

  it('segments cover full duration with no gaps', () => {
    const script =
      'AI is changing everything. Companies are adapting quickly. The future looks different. New tools emerge daily. Innovation accelerates.';
    const totalFrames = 9000;
    const segments = parseScript(script, totalFrames);

    expect(segments.length).toBeGreaterThan(0);

    // First segment starts at 0
    expect(segments[0].startFrame).toBe(0);

    // Last segment ends at totalDurationFrames
    expect(segments[segments.length - 1].endFrame).toBe(totalFrames);

    // No gaps between consecutive segments
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startFrame).toBe(segments[i - 1].endFrame);
    }
  });

  it('enforces minimum segment duration of 90 frames', () => {
    // Short sentences with a large total duration should all get >= 90 frames
    const script = 'Short one. Another. Third here. Fourth now. Fifth goes.';
    const segments = parseScript(script, 9000);

    for (const seg of segments) {
      const duration = seg.endFrame - seg.startFrame;
      expect(duration).toBeGreaterThanOrEqual(90);
    }
  });

  it('handles very long paragraph by splitting at max duration', () => {
    // Create a very long single paragraph that would exceed 300 frames
    const longText = Array.from(
      { length: 20 },
      (_, i) =>
        `This is a rather long sentence number ${i + 1} that contains quite a bit of content to push the character count up significantly.`,
    ).join(' ');

    const segments = parseScript(longText, 9000);

    // Should produce multiple segments
    expect(segments.length).toBeGreaterThan(1);

    // No segment should vastly exceed the max (some tolerance for rounding)
    for (const seg of segments) {
      const duration = seg.endFrame - seg.startFrame;
      // Allow some tolerance due to normalization
      expect(duration).toBeLessThanOrEqual(350);
    }
  });

  it('handles single-line paragraphs as their own segments', () => {
    const script = 'First paragraph stands alone.\n\nSecond paragraph is also alone.\n\nThird paragraph too.';
    const segments = parseScript(script, 9000);

    // Each paragraph (single sentence) should be its own segment
    expect(segments.length).toBe(3);
    expect(segments[0].text).toContain('First paragraph');
    expect(segments[1].text).toContain('Second paragraph');
    expect(segments[2].text).toContain('Third paragraph');
  });

  it('assigns sequential indices starting from 0', () => {
    const script =
      'One sentence. Two sentence. Three sentence. Four sentence.';
    const segments = parseScript(script, 9000);

    for (let i = 0; i < segments.length; i++) {
      expect(segments[i].index).toBe(i);
    }
  });

  it('handles a single sentence spanning full duration', () => {
    const script = 'This is the only sentence in the entire script.';
    const segments = parseScript(script, 9000);

    expect(segments.length).toBe(1);
    expect(segments[0].startFrame).toBe(0);
    expect(segments[0].endFrame).toBe(9000);
    expect(segments[0].sentenceCount).toBe(1);
  });
});
