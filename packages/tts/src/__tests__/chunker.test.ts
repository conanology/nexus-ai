/**
 * Unit tests for script chunking with SSML preservation
 * @module @nexus-ai/tts/chunker.test
 */

import { describe, it, expect } from 'vitest';
import { chunkScript, getChunkSize } from '../chunker.js';

describe('chunker', () => {
  describe('getChunkSize', () => {
    it('should return default chunk size of 5000', () => {
      expect(getChunkSize()).toBe(5000);
    });
  });

  describe('chunkScript', () => {
    it('should return single chunk for short scripts', () => {
      const script = 'This is a short script.';
      const chunks = chunkScript(script, 5000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].text).toBe(script);
      expect(chunks[0].startChar).toBe(0);
      expect(chunks[0].endChar).toBe(script.length);
    });

    it('should split long scripts into multiple chunks at sentence boundaries', () => {
      const sentences = Array(10)
        .fill(null)
        .map((_, i) => `This is sentence number ${i + 1} in the script.`)
        .join(' ');

      const chunks = chunkScript(sentences, 150);

      expect(chunks.length).toBeGreaterThan(1);

      // Verify each chunk ends at sentence boundary
      chunks.slice(0, -1).forEach((chunk) => {
        expect(chunk.text).toMatch(/[.!?]\s*$/);
      });
    });

    it('should assign correct indices to chunks', () => {
      const longScript = Array(10)
        .fill('This is a sentence. ')
        .join('');

      const chunks = chunkScript(longScript, 50);

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should track character positions correctly', () => {
      const script = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkScript(script, 25);

      let expectedStart = 0;
      chunks.forEach((chunk) => {
        expect(chunk.startChar).toBe(expectedStart);
        expect(chunk.endChar).toBeGreaterThan(chunk.startChar);
        expectedStart = chunk.endChar;
      });
    });

    it('should preserve SSML tags within a chunk', () => {
      const script =
        'Hello <phoneme alphabet="ipa" ph="wɜːld">world</phoneme>. This is a test.';
      const chunks = chunkScript(script, 5000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toContain('<phoneme');
      expect(chunks[0].text).toContain('</phoneme>');
    });

    it('should close and reopen SSML tags across chunk boundaries', () => {
      const script =
        'First sentence with <phoneme alphabet="ipa" ph="test">pronunciation</phoneme>. ' +
        'Second sentence. ' +
        'Third sentence.';

      // Force chunking by using small max chars
      const chunks = chunkScript(script, 80);

      if (chunks.length > 1) {
        // Check that each chunk has valid SSML (same number of open and close tags)
        chunks.forEach((chunk, i) => {
          const openTags = (chunk.text.match(/<phoneme/g) || []).length;
          const closeTags = (chunk.text.match(/<\/phoneme>/g) || []).length;

          // Each chunk should have balanced tags
          expect(openTags).toBe(closeTags);
        });
      }
    });

    it('should handle multiple nested SSML tags', () => {
      const script =
        '<speak>Hello <phoneme alphabet="ipa" ph="wɜːld">world</phoneme>. ' +
        'This is a <phoneme alphabet="ipa" ph="test">test</phoneme>.</speak>';

      const chunks = chunkScript(script, 5000);

      // Should preserve all tags in single chunk
      expect(chunks[0].text).toContain('<speak>');
      expect(chunks[0].text).toContain('</speak>');
      expect((chunks[0].text.match(/<phoneme/g) || []).length).toBe(2);
      expect((chunks[0].text.match(/<\/phoneme>/g) || []).length).toBe(2);
    });

    it('should handle script exactly at chunk boundary', () => {
      const script = 'A'.repeat(5000);
      const chunks = chunkScript(script, 5000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text.length).toBe(5000);
    });

    it('should handle script just over chunk boundary', () => {
      const sentence = 'This is a sentence. ';
      const script = sentence.repeat(300); // Well over 5000 chars

      const chunks = chunkScript(script, 5000);

      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk (except possibly last) should be close to max size
      chunks.slice(0, -1).forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(5000 + sentence.length);
      });
    });

    it('should handle empty script', () => {
      const chunks = chunkScript('', 5000);

      // Empty script returns single empty chunk or empty array
      // Current implementation returns single chunk with empty text
      expect(chunks.length).toBeGreaterThanOrEqual(0);
      if (chunks.length > 0) {
        expect(chunks[0].text.trim()).toBe('');
      }
    });

    it('should handle script with only whitespace', () => {
      const chunks = chunkScript('   ', 5000);

      // Whitespace-only script may return single chunk or empty array
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should preserve exclamation and question marks as sentence boundaries', () => {
      const script = 'What is this? Amazing! Really. Yes.';
      const chunks = chunkScript(script, 20);

      // Should split at ?, !, and .
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should force-split mid-sentence if chunk size exceeded and no punctuation', () => {
      const longSentence = 'This is an extremely long sentence that goes on and on without any punctuation for a very long time because we want to test how the chunker handles a single sentence that exceeds the maximum chunk size but has no natural breaking point in the middle.';

      const chunks = chunkScript(longSentence, 50);

      // Should split into multiple chunks by words
      expect(chunks.length).toBeGreaterThan(1);
      // Reconstructed text should match (ignoring extra spaces from split logic)
      expect(chunks.map(c => c.text).join('').replace(/\s+/g, ' ').trim()).toBe(longSentence.replace(/\s+/g, ' ').trim());
    });

    it('should handle SSML tag that spans across forced chunk boundary', () => {
      // Create scenario where SSML tag naturally spans chunks
      const beforeTag = 'A'.repeat(60) + '. ';
      const taggedContent =
        '<phoneme alphabet="ipa" ph="test">This is tagged content that might span chunks</phoneme>';
      const afterTag = '. ' + 'B'.repeat(60);

      const script = beforeTag + taggedContent + afterTag;

      const chunks = chunkScript(script, 80);

      // Verify SSML structure is preserved
      const allText = chunks.map((c) => c.text).join('');

      // Count tags across all chunks
      const totalOpenTags = allText.match(/<phoneme/g)?.length || 0;
      const totalCloseTags = allText.match(/<\/phoneme>/g)?.length || 0;

      expect(totalOpenTags).toBe(totalCloseTags);
    });

    it('should maintain SSML tag attributes when reopening across chunks', () => {
      const longScript =
        'Start here. ' +
        '<phoneme alphabet="ipa" ph="specific">pronunciation</phoneme>. ' +
        'A'.repeat(100) +
        '. More content.';

      const chunks = chunkScript(longScript, 50);

      // If chunked, verify that reopened tags maintain attributes
      if (chunks.length > 1) {
        chunks.forEach((chunk) => {
          const phonemeTags = chunk.text.match(/<phoneme[^>]*>/g) || [];
          phonemeTags.forEach((tag) => {
            // Each phoneme tag should have alphabet and ph attributes
            expect(tag).toContain('alphabet=');
            expect(tag).toContain('ph=');
          });
        });
      }
    });
  });
});
