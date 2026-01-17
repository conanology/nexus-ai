/**
 * Script chunking utilities for long TTS inputs
 * @module @nexus-ai/tts/chunker
 *
 * NOTE: This is a placeholder for Story 3.2 (audio chunking and stitching).
 * Currently implements basic single-chunk behavior.
 */

/**
 * Chunk script for TTS synthesis
 *
 * For Story 3.1, we process scripts as single chunks.
 * Story 3.2 will implement actual chunking for long scripts.
 *
 * @param script - SSML-tagged script
 * @returns Array of script chunks (currently always single element)
 */
export function chunkScript(script: string): string[] {
  // TODO: Story 3.2 - Implement actual chunking for long scripts
  // For now, return the entire script as a single chunk
  return [script];
}

/**
 * Get optimal chunk size for TTS processing
 *
 * @returns Maximum characters per chunk
 */
export function getChunkSize(): number {
  // TODO: Story 3.2 - Determine optimal chunk size based on TTS provider limits
  // Gemini TTS supports up to 5000 characters per request
  return 5000;
}
