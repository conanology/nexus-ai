/**
 * Tests for term extraction logic
 *
 * @module @nexus-ai/pronunciation/tests
 */

import { describe, it, expect } from 'vitest';
import { extractTerms, extractPronounceHints } from '../extractor.js';

describe('extractPronounceHints', () => {
  it('should extract terms from [PRONOUNCE: ...] hints', () => {
    const text = 'This is a test with [PRONOUNCE: PyTorch] in it.';
    const hints = extractPronounceHints(text);
    expect(hints).toEqual(['PyTorch']);
  });

  it('should extract multiple hints', () => {
    const text = 'Testing [PRONOUNCE: LLaMA] and [PRONOUNCE: RLHF] together.';
    const hints = extractPronounceHints(text);
    expect(hints).toEqual(['LLaMA', 'RLHF']);
  });

  it('should return empty array when no hints present', () => {
    const text = 'No hints here.';
    const hints = extractPronounceHints(text);
    expect(hints).toEqual([]);
  });

  it('should handle whitespace in hints', () => {
    const text = '[PRONOUNCE:   GPT-4  ]';
    const hints = extractPronounceHints(text);
    expect(hints).toEqual(['GPT-4']);
  });
});

describe('extractTerms', () => {
  it('should extract capitalized words not at sentence start', () => {
    const text = 'We use PyTorch and TensorFlow for training.';
    const terms = extractTerms(text);
    expect(terms).toContain('PyTorch');
    expect(terms).toContain('TensorFlow');
    expect(terms).not.toContain('We'); // Sentence start
  });

  it('should extract CamelCase terms', () => {
    const text = 'The system uses HuggingFace for amazing models.';
    const terms = extractTerms(text);
    expect(terms).toContain('HuggingFace');
  });

  it('should extract acronyms', () => {
    const text = 'We use RLHF and LLM for important concepts.';
    const terms = extractTerms(text);
    expect(terms).toContain('RLHF');
    expect(terms).toContain('LLM');
  });

  it('should extract terms with numbers', () => {
    const text = 'The model GPT-4 is better than GPT-3 version.';
    const terms = extractTerms(text);
    expect(terms).toContain('GPT-4');
    expect(terms).toContain('GPT-3');
  });

  it('should extract terms from PRONOUNCE hints', () => {
    const text = 'Use [PRONOUNCE: LLaMA] for inference.';
    const terms = extractTerms(text);
    expect(terms).toContain('LLaMA');
  });

  it('should deduplicate terms', () => {
    const text = 'PyTorch and PyTorch again.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms.filter((t) => t === 'PyTorch')).toHaveLength(1);
  });

  it('should handle mixed content', () => {
    const text =
      'In this paper, we discuss LLaMA-2 and [PRONOUNCE: HuggingFace] using PyTorch. The RLHF technique improves results.';
    const terms = extractTerms(text);
    expect(terms).toContain('LLaMA-2');
    expect(terms).toContain('HuggingFace');
    expect(terms).toContain('PyTorch');
    expect(terms).toContain('RLHF');
  });

  it('should not extract common words at sentence start', () => {
    const text = 'The model is trained. It performs well.';
    const terms = extractTerms(text);
    expect(terms).not.toContain('The');
    expect(terms).not.toContain('It');
  });

  it('should extract capitalized technical names mid-sentence', () => {
    const text = 'We fine-tuned Llama and trained GPT models.';
    const terms = extractTerms(text);
    expect(terms).toContain('Llama');
    expect(terms).toContain('GPT');
  });
});

describe('extractTerms context', () => {
  it('should provide sentence context for each term', () => {
    const text = 'We use PyTorch for training. Also, TensorFlow is good.';
    const termsWithContext = extractTerms(text, { includeContext: true });

    expect(termsWithContext).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          term: 'PyTorch',
          context: 'We use PyTorch for training.',
        }),
        expect.objectContaining({
          term: 'TensorFlow',
          context: 'Also, TensorFlow is good.',
        }),
      ])
    );
  });

  it('should handle multiple occurrences with different contexts', () => {
    const text = 'I love PyTorch. We use PyTorch daily.';
    const termsWithContext = extractTerms(text, { includeContext: true });

    const pytorchEntries = termsWithContext.filter((t) => t.term === 'PyTorch');
    expect(pytorchEntries).toHaveLength(2);
    expect(pytorchEntries[0].context).toBe('I love PyTorch.');
    expect(pytorchEntries[1].context).toBe('We use PyTorch daily.');
  });

  it('should handle empty string', () => {
    const text = '';
    const terms = extractTerms(text);
    expect(terms).toEqual([]);
  });

  it('should handle text with no technical terms', () => {
    const text = 'The cat sat on the mat.';
    const terms = extractTerms(text);
    expect(terms.length).toBe(0);
  });
});

  it('should handle text with only PRONOUNCE hints', () => {
    const text = '[PRONOUNCE: LLaMA] is good. [PRONOUNCE: RLHF] too.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('LLaMA');
    expect(terms).toContain('RLHF');
  });

  it('should handle text with numbers in terms', () => {
    const text = 'Using GPT-4 and GPT-3.5 versions.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('GPT-4');
    expect(terms).toContain('GPT-3.5');
  });
});

  it('should handle text with mixed case terms', () => {
    const text = 'We use pytorch and PyTorch.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('PyTorch');
    expect(terms.filter((t) => t === 'PyTorch')).toHaveLength(1);
  });

  it('should handle text with special characters', () => {
    const text = 'Using GPT-4 and (C++) code.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('GPT-4');
    expect(terms).toContain('C++');
  });

  it('should extract acronyms correctly', () => {
    const text = 'Using AI, ML, and NLP techniques.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('AI');
    expect(terms).toContain('ML');
    expect(terms).toContain('NLP');
  });

  it('should extract terms preserving original case', () => {
    const text = 'Using PyTorch and TensorFlow.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('PyTorch');
    expect(terms).toContain('TensorFlow');
  });

  it('should handle nested terms', () => {
    const text = 'HuggingFace Transformers uses BERT models.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('HuggingFace');
    expect(terms).toContain('Transformers');
    expect(terms).toContain('BERT');
  });

  it('should handle edge case with multiple hyphens', () => {
    const text = 'Using GPT-3.5-turbo model.';
    const terms = extractTerms(text, { includeContext: false });
    expect(terms).toContain('GPT-3.5-turbo');
  });
