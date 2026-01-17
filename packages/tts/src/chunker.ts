/**
 * Script chunking utilities for long TTS inputs
 * @module @nexus-ai/tts/chunker
 *
 * Implements intelligent chunking that:
 * - Splits at sentence boundaries (never mid-sentence)
 * - Preserves SSML phoneme tags across chunk boundaries
 * - Tracks character positions for debugging
 */

import type { ChunkInfo } from './types.js';

/**
 * Chunk script for TTS synthesis with SSML tag preservation
 *
 * Splits long scripts at sentence boundaries while preserving SSML markup.
 * CRITICAL: Never splits mid-sentence or mid-SSML-tag.
 *
 * @param script - SSML-tagged script from pronunciation stage
 * @param maxChars - Maximum characters per chunk (default: 5000)
 * @returns Array of ChunkInfo objects with indices and character positions
 *
 * @example
 * ```typescript
 * const chunks = chunkScript(longScript, 5000);
 * // chunks[0].text includes properly closed SSML tags
 * // chunks[1].text reopens any tags that were closed
 * ```
 */
export function chunkScript(
  script: string,
  maxChars: number = 5000
): ChunkInfo[] {
  // If script is within limit, return single chunk
  if (script.length <= maxChars) {
    return [
      {
        index: 0,
        text: script,
        startChar: 0,
        endChar: script.length,
      },
    ];
  }

  const chunks: ChunkInfo[] = [];
  let currentChunk = '';
  let currentStart = 0;

  // Split into sentences at boundaries: ". ", "! ", "? "
  // Use lookahead to preserve the punctuation with the sentence
  const sentences = script.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    // If adding this sentence exceeds limit
    if (currentChunk.length + sentence.length > maxChars) {
      // If current chunk has content, push it first
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunks.length,
          text: currentChunk, // Removed trim() to preserve spacing
          startChar: currentStart,
          endChar: currentStart + currentChunk.length,
        });
        currentStart += currentChunk.length;
        currentChunk = '';
      }

      // If the sentence itself is larger than maxChars, we must force-split it
      if (sentence.length > maxChars) {
        // Try splitting by words to find a safe break point
        const words = sentence.split(' ');
        let tempChunk = '';
        
        for (const word of words) {
          if (tempChunk.length + word.length + 1 > maxChars) {
            // Push what we have so far
            if (tempChunk.length > 0) {
              chunks.push({
                index: chunks.length,
                text: tempChunk, // Removed trim()
                startChar: currentStart,
                endChar: currentStart + tempChunk.length,
              });
              currentStart += tempChunk.length;
              tempChunk = '';
            }
          }
          tempChunk += word + ' ';
        }
        // Keep the remainder as the start of the next chunk
        currentChunk = tempChunk;
      } else {
        // Sentence fits in a new chunk
        currentChunk = sentence + ' ';
      }
    } else {
      // Sentence fits in current chunk
      currentChunk += sentence + ' ';
    }
  }

  // Add final chunk if any content remains
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunks.length,
      text: currentChunk, // Removed trim()
      startChar: currentStart,
      endChar: currentStart + currentChunk.length,
    });
  }

  // Preserve SSML tags across chunk boundaries
  return preserveSSMLTags(chunks);
}

/**
 * Preserve SSML tags across chunk boundaries
 *
 * CRITICAL: Ensures SSML phoneme tags remain valid across chunks.
 * If a tag opens in one chunk but closes in the next, we:
 * 1. Close open tags at end of first chunk
 * 2. Reopen those tags at start of next chunk
 *
 * @param chunks - Raw chunks from sentence splitting
 * @returns Chunks with SSML tags properly preserved
 *
 * @example
 * Input chunks:
 * - Chunk 0: "Hello <phoneme alphabet='ipa' ph='wɜːld'>wo"
 * - Chunk 1: "rld</phoneme> today"
 *
 * Output chunks:
 * - Chunk 0: "Hello <phoneme alphabet='ipa' ph='wɜːld'>wo</phoneme>"
 * - Chunk 1: "<phoneme alphabet='ipa' ph='wɜːld'>rld</phoneme> today"
 */
function preserveSSMLTags(chunks: ChunkInfo[]): ChunkInfo[] {
  // Track SSML tags that are open across chunks
  const openTagsStack: Array<{ tagName: string; fullTag: string }> = [];

  return chunks.map((chunk, chunkIndex) => {
    let text = chunk.text;

    // Prepend any tags that were left open from previous chunk
    if (openTagsStack.length > 0) {
      const reopenTags = openTagsStack.map((t) => t.fullTag).join('');
      text = reopenTags + text;
    }

    // Parse SSML tags in this chunk
    // Regex now handles:
    // 1. Tag name (Group 1)
    // 2. Attributes (Group 2)
    // 3. Self-closing slash (Group 3, optional)
    const tagPattern = /<(\w+)([^>]*?)(\/?)>/g;
    const closePattern = /<\/(\w+)>/g;

    // Find all opening tags
    const openingTags: Array<{ tagName: string; fullTag: string; pos: number; isSelfClosing: boolean }> =
      [];
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      // If it's not a closing tag (doesn't start with </)
      // Note: tagPattern doesn't match strings starting with </ because of the first char < followed by \w
      openingTags.push({
        tagName: match[1],
        fullTag: match[0],
        pos: match.index,
        isSelfClosing: match[3] === '/',
      });
    }

    // Find all closing tags
    const closingTags: Array<{ tagName: string; pos: number }> = [];
    while ((match = closePattern.exec(text)) !== null) {
      closingTags.push({
        tagName: match[1],
        pos: match.index,
      });
    }

    // Determine which tags remain open at end of chunk
    // Process tags in order by position
    const allTags = [
      ...openingTags.map((t) => ({ ...t, type: 'open' as const })),
      ...closingTags.map((t) => ({ ...t, type: 'close' as const })),
    ].sort((a, b) => a.pos - b.pos);

    const tagStack: Array<{ tagName: string; fullTag: string }> = [];

    for (const tag of allTags) {
      if (tag.type === 'open') {
        // Only push to stack if it's NOT self-closing
        if (!tag.isSelfClosing) {
          tagStack.push({
            tagName: tag.tagName,
            fullTag: (tag as any).fullTag,
          });
        }
      } else {
        // Find matching opening tag and remove from stack
        // We look for the most recent matching tag (LIFO) to handle nesting correctly
        let matchIndex = -1;
        for (let i = tagStack.length - 1; i >= 0; i--) {
          if (tagStack[i].tagName === tag.tagName) {
            matchIndex = i;
            break;
          }
        }
        
        if (matchIndex !== -1) {
          tagStack.splice(matchIndex, 1);
        }
      }
    }

    // Tags remaining in stack are unclosed - close them before chunk ends
    if (tagStack.length > 0 && chunkIndex < chunks.length - 1) {
      // Close tags in reverse order (LIFO)
      const closeTags = tagStack
        .reverse()
        .map((t) => `</${t.tagName}>`)
        .join('');
      text = text + closeTags;

      // Remember to reopen these tags in next chunk
      openTagsStack.length = 0; // Clear previous
      openTagsStack.push(...tagStack.reverse());
    } else {
      // Clear open tags stack if no unclosed tags
      openTagsStack.length = 0;
    }

    return {
      ...chunk,
      text,
    };
  });
}

/**
 * Get optimal chunk size for TTS processing
 *
 * @returns Maximum characters per chunk (Gemini TTS limit)
 */
export function getChunkSize(): number {
  return 5000;
}
