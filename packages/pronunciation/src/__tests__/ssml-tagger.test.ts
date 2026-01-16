/**
 * Unit tests for SSML tagger
 *
 * @module @nexus-ai/pronunciation/__tests__/ssml-tagger
 */

import { describe, it, expect } from 'vitest';
import {
  tagScript,
  parsePronunciationHints,
  escapeXml,
  type SSMLTagOptions,
} from '../ssml-tagger.js';
import type { PronunciationEntry } from '../types.js';

describe('escapeXml', () => {
  it('should escape XML special characters', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
    expect(escapeXml('A & B')).toBe('A &amp; B');
    expect(escapeXml('"quotes"')).toBe('&quot;quotes&quot;');
    expect(escapeXml("'apostrophe'")).toBe('&apos;apostrophe&apos;');
  });

  it('should escape & first to avoid double-escaping', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('should handle text with no special characters', () => {
    expect(escapeXml('Hello World')).toBe('Hello World');
  });

  it('should handle empty string', () => {
    expect(escapeXml('')).toBe('');
  });
});

describe('parsePronunciationHints', () => {
  it('should parse pronunciation hints from script', () => {
    const script = 'The new [PRONOUNCE: Mixtral = "mix-trahl"] model is powerful.';
    const hints = parsePronunciationHints(script);

    expect(hints).toHaveLength(1);
    expect(hints[0]).toEqual({
      term: 'Mixtral',
      pronunciation: 'mix-trahl',
      position: expect.any(Number),
    });
  });

  it('should parse multiple hints', () => {
    const script = `
      The [PRONOUNCE: LLaMA = "lah-mah"] and [PRONOUNCE: Gemini = "jem-in-eye"] models.
    `;
    const hints = parsePronunciationHints(script);

    expect(hints).toHaveLength(2);
    expect(hints[0].term).toBe('LLaMA');
    expect(hints[0].pronunciation).toBe('lah-mah');
    expect(hints[1].term).toBe('Gemini');
    expect(hints[1].pronunciation).toBe('jem-in-eye');
  });

  it('should handle hints with extra whitespace', () => {
    const script = '[PRONOUNCE:   GPT-4  =  "gee-pee-tee-four"  ]';
    const hints = parsePronunciationHints(script);

    expect(hints).toHaveLength(1);
    expect(hints[0].term).toBe('GPT-4');
    expect(hints[0].pronunciation).toBe('gee-pee-tee-four');
  });

  it('should return empty array when no hints found', () => {
    const script = 'This is a script with no pronunciation hints.';
    const hints = parsePronunciationHints(script);

    expect(hints).toEqual([]);
  });
});

describe('tagScript', () => {
  const createEntry = (term: string, ipa: string): PronunciationEntry => ({
    term: term.toLowerCase(),
    ipa,
    ssml: `<phoneme alphabet="ipa" ph="${ipa}">${term}</phoneme>`,
    verified: true,
    source: 'seed',
    usageCount: 0,
    lastUsed: null,
    addedDate: '2026-01-16',
  });

  describe('Basic SSML Tag Generation', () => {
    it('should tag single technical term with SSML', () => {
      const script = 'The GPT model is powerful.';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>');
      expect(result).toContain('The');
      expect(result).toContain('model is powerful.');
    });

    it('should tag multiple terms in script', () => {
      const script = 'GPT and LLaMA are both LLM models.';
      const pronunciations = new Map([
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')],
        ['llama', createEntry('LLaMA', 'ˈlɑːmə')],
        ['llm', createEntry('LLM', 'ɛlɛlˈɛm')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="ˈlɑːmə">LLaMA</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="ɛlɛlˈɛm">LLM</phoneme>');
    });

    it('should handle case-insensitive matching while preserving original case', () => {
      const script = 'GPT, gpt, and Gpt are all tagged.';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      // Should preserve original case in the SSML output
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">gpt</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">Gpt</phoneme>');
    });
  });

  describe('Longest-First Term Replacement', () => {
    it('should replace longer terms first to prevent partial replacements', () => {
      const script = 'GPT-4 is better than GPT-3.';
      const pronunciations = new Map([
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')],
        ['gpt-4', createEntry('GPT-4', 'dʒiːpiːˈtiːfɔːr')],
        ['gpt-3', createEntry('GPT-3', 'dʒiːpiːˈtiːθriː')],
      ]);

      const result = tagScript(script, pronunciations);

      // GPT-4 and GPT-3 should be replaced, not "GPT" within them
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiːfɔːr">GPT-4</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiːθriː">GPT-3</phoneme>');
      expect(result).not.toContain(
        '<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>-4'
      );
    });

    it('should handle nested terms correctly', () => {
      const script = 'DALL-E uses DALL technology.';
      const pronunciations = new Map([
        ['dall', createEntry('DALL', 'dɑːl')],
        ['dall-e', createEntry('DALL-E', 'ˈdɑːliː')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('<phoneme alphabet="ipa" ph="ˈdɑːliː">DALL-E</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="dɑːl">DALL</phoneme> technology');
    });
  });

  describe('Word Boundary Protection', () => {
    it('should only replace whole words using word boundaries', () => {
      const script = 'The BERT model has BERTology research.';
      const pronunciations = new Map([['bert', createEntry('BERT', 'bɜːrt')]]);

      const result = tagScript(script, pronunciations);

      // Should replace "BERT" but not "BERT" within "BERTology"
      expect(result).toContain('<phoneme alphabet="ipa" ph="bɜːrt">BERT</phoneme> model');
      expect(result).toContain('BERTology');
      expect(result).not.toContain(
        '<phoneme alphabet="ipa" ph="bɜːrt">BERT</phoneme>ology'
      );
    });

    it('should handle punctuation at word boundaries', () => {
      const script = 'GPT-4, GPT-3.5, and GPT.';
      const pronunciations = new Map([
        ['gpt-4', createEntry('GPT-4', 'dʒiːpiːˈtiːfɔːr')],
        ['gpt-3.5', createEntry('GPT-3.5', 'dʒiːpiːˈtiːθriːpɔɪntfaɪv')],
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiːfɔːr">GPT-4</phoneme>,');
      expect(result).toContain(
        '<phoneme alphabet="ipa" ph="dʒiːpiːˈtiːθriːpɔɪntfaɪv">GPT-3.5</phoneme>,'
      );
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>.');
    });
  });

  describe('Pronunciation Hint Processing', () => {
    it('should process pronunciation hints and generate SSML tags', () => {
      const script = 'The new [PRONOUNCE: Mixtral = "mix-trahl"] model is powerful.';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations, { processHints: true });

      // Should generate SSML phoneme tag from hint
      expect(result).toContain('<phoneme alphabet="ipa"');
      expect(result).toContain('>Mixtral</phoneme>');
      expect(result).not.toContain('[PRONOUNCE:');
    });

    it('should convert pronunciation guidance to IPA', () => {
      const script = 'Use [PRONOUNCE: LLaMA = "lah-mah"] for inference.';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations, { processHints: true });

      // Should convert "lah-mah" to IPA approximation
      expect(result).toContain('<phoneme');
      expect(result).toContain('ph="lɑːmɑː"'); // "ah" -> "ɑː"
      expect(result).toContain('>LLaMA</phoneme>');
      expect(result).not.toContain('[PRONOUNCE:');
    });

    it('should handle multiple hints in same script', () => {
      const script = '[PRONOUNCE: Mixtral = "mix-trahl"] and [PRONOUNCE: LLaMA = "lah-mah"] models.';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations, { processHints: true });

      expect(result).toContain('>Mixtral</phoneme>');
      expect(result).toContain('>LLaMA</phoneme>');
      expect(result).not.toContain('[PRONOUNCE:');
    });

    it('should use existing pronunciation entry if term already in dictionary', () => {
      const script = 'The [PRONOUNCE: GPT = "gee-pee-tee"] model works.';
      const pronunciations = new Map([
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')], // Existing entry
      ]);

      const result = tagScript(script, pronunciations, { processHints: true });

      // Should use existing IPA, not convert hint
      expect(result).toContain('ph="dʒiːpiːˈtiː"');
      expect(result).not.toContain('geepeestee'); // Not the hint pronunciation
    });

    it('should not process hints when processHints is false', () => {
      const script = 'The [PRONOUNCE: Mixtral = "mix-trahl"] model.';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations, { processHints: false });

      // Hints should be preserved as-is (and XML-escaped)
      expect(result).toContain('[PRONOUNCE:');
    });
  });

  describe('XML Escaping', () => {
    it('should escape XML special characters in script content', () => {
      const script = 'The <model> uses A & B with "quotes".';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations);

      expect(result).toContain('&lt;model&gt;');
      expect(result).toContain('A &amp; B');
      expect(result).toContain('&quot;quotes&quot;');
    });

    it('should not escape SSML tags themselves', () => {
      const script = 'The GPT model works.';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      // SSML tags should remain valid XML
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>');
      expect(result).not.toContain('&lt;phoneme');
      expect(result).not.toContain('&gt;');
    });
  });

  describe('Visual Cue Preservation', () => {
    it('should preserve [VISUAL: ...] cues in output', () => {
      const script = '[VISUAL: Show AI diagram] The GPT model learns from data.';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('[VISUAL: Show AI diagram]');
      expect(result).toContain('<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>');
    });

    it('should maintain paragraph structure', () => {
      const script = 'Paragraph one with GPT.\n\nParagraph two with LLM.';
      const pronunciations = new Map([
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')],
        ['llm', createEntry('LLM', 'ɛlɛlˈɛm')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('\n\n');
      expect(result.split('\n\n')).toHaveLength(2);
    });

    it('should preserve line breaks', () => {
      const script = 'Line 1: GPT\nLine 2: LLM\nLine 3: BERT';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      expect(result.split('\n')).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty script', () => {
      const script = '';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations);

      expect(result).toBe('');
    });

    it('should handle script with no technical terms', () => {
      const script = 'This is a simple sentence.';
      const pronunciations = new Map<string, PronunciationEntry>();

      const result = tagScript(script, pronunciations);

      expect(result).toBe('This is a simple sentence.');
    });

    it('should handle multiple occurrences of same term', () => {
      const script = 'GPT is great. GPT uses transformers. GPT learns fast.';
      const pronunciations = new Map([['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')]]);

      const result = tagScript(script, pronunciations);

      const matches = result.match(/<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT<\/phoneme>/g);
      expect(matches).toHaveLength(3);
    });

    it('should handle terms with special regex characters', () => {
      const script = 'Use C++ and C# for development.';
      const pronunciations = new Map([
        ['c++', createEntry('C++', 'siːplʌsplʌs')],
        ['c#', createEntry('C#', 'siːʃɑːrp')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('<phoneme alphabet="ipa" ph="siːplʌsplʌs">C++</phoneme>');
      expect(result).toContain('<phoneme alphabet="ipa" ph="siːʃɑːrp">C#</phoneme>');
    });

    it('should handle terms in quotes and parentheses', () => {
      const script = 'The "GPT" model (LLM) is powerful.';
      const pronunciations = new Map([
        ['gpt', createEntry('GPT', 'dʒiːpiːˈtiː')],
        ['llm', createEntry('LLM', 'ɛlɛlˈɛm')],
      ]);

      const result = tagScript(script, pronunciations);

      expect(result).toContain('&quot;<phoneme alphabet="ipa" ph="dʒiːpiːˈtiː">GPT</phoneme>&quot;');
      expect(result).toContain('(<phoneme alphabet="ipa" ph="ɛlɛlˈɛm">LLM</phoneme>)');
    });
  });
});
