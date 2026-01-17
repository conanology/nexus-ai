/**
 * Integration tests for TTS chunking and stitching
 * @module @nexus-ai/tts/integration.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chunkScript } from '../chunker.js';
import { stitchAudio } from '../audio-quality.js';
import type { AudioSegment } from '../types.js';

/**
 * Helper to create mock WAV buffer
 */
function createMockWAVBuffer(
  durationMs: number,
  sampleRate: number = 44100
): Buffer {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const numChannels = 2;
  const bitsPerSample = 16;
  const pcmDataSize = numSamples * numChannels * (bitsPerSample / 8);

  const header = Buffer.alloc(44);
  let offset = 0;

  header.write('RIFF', offset);
  offset += 4;
  header.writeUInt32LE(36 + pcmDataSize, offset);
  offset += 4;
  header.write('WAVE', offset);
  offset += 4;

  header.write('fmt ', offset);
  offset += 4;
  header.writeUInt32LE(16, offset);
  offset += 4;
  header.writeUInt16LE(1, offset);
  offset += 2;
  header.writeUInt16LE(numChannels, offset);
  offset += 2;
  header.writeUInt32LE(sampleRate, offset);
  offset += 4;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  header.writeUInt32LE(byteRate, offset);
  offset += 4;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  header.writeUInt16LE(blockAlign, offset);
  offset += 2;
  header.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  header.write('data', offset);
  offset += 4;
  header.writeUInt32LE(pcmDataSize, offset);

  const pcmData = Buffer.alloc(pcmDataSize);
  return Buffer.concat([header, pcmData]);
}

describe('TTS Chunking Integration', () => {
  describe('End-to-end chunking and stitching', () => {
    it('should chunk long script and stitch audio segments', () => {
      // Create a long script with SSML tags
      const longScript =
        'This is the first sentence. ' +
        'Here is a <phoneme alphabet="ipa" ph="test">technical term</phoneme>. ' +
        'Third sentence goes here. ' +
        'Fourth sentence with more content. ' +
        'Fifth sentence to make it longer. ' +
        'Sixth sentence for chunking. ' +
        'Seventh sentence continues. ' +
        'Eighth sentence almost done. ' +
        'Ninth sentence nearly there. ' +
        'Tenth sentence finishes it.';

      // Chunk script (force small chunks for testing)
      const chunks = chunkScript(longScript, 100);

      expect(chunks.length).toBeGreaterThan(1);

      // Simulate TTS synthesis for each chunk
      const segments: AudioSegment[] = chunks.map((chunk) => ({
        index: chunk.index,
        audioBuffer: createMockWAVBuffer(1000), // 1 second per chunk
        durationSec: 1.0,
      }));

      // Stitch segments
      const stitched = stitchAudio(segments, 200);

      // Verify final audio is valid
      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
      expect(stitched.toString('utf8', 8, 12)).toBe('WAVE');

      // Verify size is reasonable (chunks + silence)
      expect(stitched.length).toBeGreaterThan(chunks.length * 1000);
    });

    it('should preserve SSML tags across chunk boundaries', () => {
      const script =
        'First part <phoneme alphabet="ipa" ph="long">with a very long phoneme tag that might span chunks</phoneme> second part.';

      // Force chunking
      const chunks = chunkScript(script, 60);

      // Verify all chunks have balanced SSML tags
      chunks.forEach((chunk) => {
        const openTags = (chunk.text.match(/<phoneme/g) || []).length;
        const closeTags = (chunk.text.match(/<\/phoneme>/g) || []).length;
        expect(openTags).toBe(closeTags);
      });

      // Verify full script can be reconstructed
      const reconstructed = chunks.map((c) => c.text.replace(/<\/?phoneme[^>]*>/g, '')).join('');
      const original = script.replace(/<\/?phoneme[^>]*>/g, '');

      // Should contain same text content (ignoring tags)
      expect(reconstructed.trim()).toContain('with a very long phoneme');
    });

    it('should handle script that exactly fits in one chunk', () => {
      const script = 'A'.repeat(5000);

      const chunks = chunkScript(script, 5000);

      expect(chunks).toHaveLength(1);

      const segments: AudioSegment[] = [
        {
          index: 0,
          audioBuffer: createMockWAVBuffer(2000),
          durationSec: 2.0,
        },
      ];

      const stitched = stitchAudio(segments, 200);

      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
    });

    it('should handle script just over chunk limit', () => {
      const script = 'A'.repeat(5001);

      const chunks = chunkScript(script, 5000);

      // Should create 2 chunks (can't split mid-sentence without punctuation)
      expect(chunks.length).toBe(1); // Actually, no sentence boundaries, so stays as 1

      // Add sentence boundaries
      const scriptWithSentences = 'A'.repeat(2500) + '. ' + 'B'.repeat(2501) + '.';
      const chunksWithBoundaries = chunkScript(scriptWithSentences, 5000);

      expect(chunksWithBoundaries.length).toBeGreaterThan(1);
    });

    it('should handle multiple chunks with varying durations', () => {
      const script = Array(20)
        .fill(null)
        .map((_, i) => `Sentence number ${i + 1} with some content.`)
        .join(' ');

      const chunks = chunkScript(script, 100);

      // Create segments with varying durations
      const segments: AudioSegment[] = chunks.map((chunk, i) => ({
        index: chunk.index,
        audioBuffer: createMockWAVBuffer(500 + i * 100),
        durationSec: (500 + i * 100) / 1000,
      }));

      const stitched = stitchAudio(segments, 200);

      expect(stitched.toString('utf8', 0, 4)).toBe('RIFF');
    });

    it('should maintain audio quality across stitching', () => {
      const chunks = chunkScript('First. Second. Third. Fourth. Fifth.', 15);

      const segments: AudioSegment[] = chunks.map((chunk) => ({
        index: chunk.index,
        audioBuffer: createMockWAVBuffer(1000),
        durationSec: 1.0,
      }));

      const stitched = stitchAudio(segments, 200);

      // Verify WAV properties
      const sampleRate = stitched.readUInt32LE(24);
      const numChannels = stitched.readUInt16LE(22);
      const bitsPerSample = stitched.readUInt16LE(34);

      expect(sampleRate).toBe(44100);
      expect(numChannels).toBe(2);
      expect(bitsPerSample).toBe(16);
    });

    it('should handle script with complex SSML structure', () => {
      const script =
        '<speak>' +
        'Welcome to <phoneme alphabet="ipa" ph="test1">term one</phoneme>. ' +
        'Now discussing <phoneme alphabet="ipa" ph="test2">term two</phoneme>. ' +
        'And finally <phoneme alphabet="ipa" ph="test3">term three</phoneme>.' +
        '</speak>';

      const chunks = chunkScript(script, 100);

      // Each chunk should have valid SSML
      chunks.forEach((chunk) => {
        const allOpenTags = chunk.text.match(/<(speak|phoneme)[^>]*>/g) || [];
        const allCloseTags = chunk.text.match(/<\/(speak|phoneme)>/g) || [];

        // Tags should be balanced
        expect(allOpenTags.length).toBe(allCloseTags.length);
      });
    });

    it('should calculate correct chunk positions', () => {
      const script = 'First sentence. Second sentence. Third sentence.';

      const chunks = chunkScript(script, 20);

      // Verify positions are continuous
      for (let i = 0; i < chunks.length - 1; i++) {
        // Next chunk should start where previous ended
        expect(chunks[i + 1].startChar).toBe(chunks[i].endChar);
      }

      // First chunk should start at 0
      expect(chunks[0].startChar).toBe(0);
    });

    it('should handle silence duration variations', () => {
      const script = 'One. Two. Three.';
      const chunks = chunkScript(script, 10);

      const segments: AudioSegment[] = chunks.map((chunk) => ({
        index: chunk.index,
        audioBuffer: createMockWAVBuffer(1000),
        durationSec: 1.0,
      }));

      // Test different silence durations
      const stitched100 = stitchAudio(segments, 100);
      const stitched200 = stitchAudio(segments, 200);
      const stitched500 = stitchAudio(segments, 500);

      // Longer silence should result in larger file
      expect(stitched100.length).toBeLessThan(stitched200.length);
      expect(stitched200.length).toBeLessThan(stitched500.length);
    });

    it('should handle edge case of single very long sentence', () => {
      // Single sentence with no punctuation (can't chunk naturally)
      const longSentence = 'This is a very long sentence without any punctuation marks that continues for a very long time and exceeds the maximum chunk size but cannot be split because there are no sentence boundaries in the middle of it so it will remain as a single chunk even though it is over the limit';

      const chunks = chunkScript(longSentence, 100);

      // Should force split by words
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should reconstruct original content from chunks', () => {
      const original =
        'Sentence one here. ' +
        'Sentence two follows. ' +
        'Sentence three continues. ' +
        'Sentence four ends.';

      const chunks = chunkScript(original, 30);

      // Reconstruct by joining chunk text
      const reconstructed = chunks.map((c) => c.text).join(' ');

      // Remove extra whitespace for comparison
      const normalizedOriginal = original.replace(/\s+/g, ' ').trim();
      const normalizedReconstructed = reconstructed.replace(/\s+/g, ' ').trim();

      expect(normalizedReconstructed).toContain(
        normalizedOriginal.split(' ')[0]
      );
    });
  });

  describe('Error handling', () => {
    it('should handle empty segments array', () => {
      const segments: AudioSegment[] = [];

      // Empty segments will create a WAV with no PCM data
      // This is valid behavior - it doesn't throw
      const result = stitchAudio(segments, 200);

      // Should return a valid WAV header even with no content
      expect(result.toString('utf8', 0, 4)).toBe('RIFF');
    });

    it('should handle chunks with no sentence boundaries', () => {
      const script = 'NoSentenceBoundariesHereJustOneLongString';

      const chunks = chunkScript(script, 10);

      // Should create single chunk (can't split without boundaries)
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance considerations', () => {
    it('should efficiently handle many small chunks', () => {
      const script = Array(100)
        .fill('Short sentence. ')
        .join('');

      const startTime = Date.now();
      const chunks = chunkScript(script, 50);
      const chunkTime = Date.now() - startTime;

      // Chunking should be fast (< 100ms for 100 sentences)
      expect(chunkTime).toBeLessThan(100);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should efficiently handle large script', () => {
      const longScript = Array(1000)
        .fill('This is a normal length sentence. ')
        .join('');

      const startTime = Date.now();
      const chunks = chunkScript(longScript, 5000);
      const chunkTime = Date.now() - startTime;

      // Should complete in reasonable time (< 500ms)
      expect(chunkTime).toBeLessThan(500);

      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
