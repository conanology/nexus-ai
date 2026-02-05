/**
 * WAV file utilities for parsing audio headers and calculating duration.
 *
 * WAV files consist of:
 * - RIFF header (12 bytes): 'RIFF' + file size + 'WAVE'
 * - Format chunk (24+ bytes): 'fmt ' + chunk size + audio format data
 * - Data chunk (8+ bytes): 'data' + data size + actual audio samples
 *
 * @module @nexus-ai/core/utils/wav-utils
 */

export interface WavHeaderInfo {
  /** Sample rate in Hz (e.g., 44100) */
  sampleRate: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  numChannels: number;
  /** Bits per sample (typically 16 or 24) */
  bitsPerSample: number;
  /** Byte offset where audio data begins */
  dataOffset: number;
  /** Size of the audio data in bytes */
  dataSize: number;
}

/**
 * Parse WAV header to extract audio parameters.
 *
 * @param buffer - WAV file buffer
 * @returns Parsed WAV header information
 * @throws Error if buffer is not a valid WAV file
 *
 * @example
 * ```typescript
 * const wavInfo = parseWavHeader(audioBuffer);
 * const bytesPerSecond = wavInfo.sampleRate * wavInfo.numChannels * (wavInfo.bitsPerSample / 8);
 * const durationSec = wavInfo.dataSize / bytesPerSecond;
 * ```
 */
export function parseWavHeader(buffer: Buffer): WavHeaderInfo {
  if (buffer.length < 44) {
    throw new Error('Buffer too small to contain valid WAV header (minimum 44 bytes)');
  }

  // Validate RIFF header
  const riffHeader = buffer.toString('ascii', 0, 4);
  if (riffHeader !== 'RIFF') {
    throw new Error(`Invalid WAV file: expected 'RIFF' header, got '${riffHeader}'`);
  }

  // Validate WAVE format
  const waveFormat = buffer.toString('ascii', 8, 12);
  if (waveFormat !== 'WAVE') {
    throw new Error(`Invalid WAV file: expected 'WAVE' format, got '${waveFormat}'`);
  }

  // Parse chunks - need to find 'fmt ' and 'data' chunks
  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;
  let foundFmt = false;
  let foundData = false;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      // Format chunk found
      if (offset + 8 + 16 > buffer.length) {
        throw new Error('Invalid WAV file: fmt chunk too small');
      }

      const audioFormat = buffer.readUInt16LE(offset + 8);
      if (audioFormat !== 1 && audioFormat !== 3) {
        // 1 = PCM, 3 = IEEE float
        throw new Error(`Unsupported WAV audio format: ${audioFormat} (only PCM and IEEE float supported)`);
      }

      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      // byteRate at offset + 16 (4 bytes)
      // blockAlign at offset + 20 (2 bytes)
      bitsPerSample = buffer.readUInt16LE(offset + 22);

      foundFmt = true;
    } else if (chunkId === 'data') {
      // Data chunk found
      dataOffset = offset + 8;
      dataSize = chunkSize;
      foundData = true;
    }

    // Move to next chunk (chunkId + chunkSize + actual data)
    offset += 8 + chunkSize;

    // If we found both chunks, we can stop
    if (foundFmt && foundData) {
      break;
    }
  }

  if (!foundFmt) {
    throw new Error('Invalid WAV file: fmt chunk not found');
  }

  if (!foundData) {
    throw new Error('Invalid WAV file: data chunk not found');
  }

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    dataOffset,
    dataSize,
  };
}

/**
 * Calculate audio duration from WAV header info.
 *
 * @param wavInfo - Parsed WAV header information
 * @returns Duration in seconds
 */
export function calculateWavDuration(wavInfo: WavHeaderInfo): number {
  const bytesPerSample = wavInfo.bitsPerSample / 8;
  const bytesPerSecond = wavInfo.sampleRate * wavInfo.numChannels * bytesPerSample;
  return wavInfo.dataSize / bytesPerSecond;
}

/**
 * Calculate audio duration directly from a WAV buffer.
 * Convenience function that combines parseWavHeader and calculateWavDuration.
 *
 * @param buffer - WAV file buffer
 * @returns Duration in seconds
 * @throws Error if buffer is not a valid WAV file
 *
 * @example
 * ```typescript
 * const durationSec = getWavDuration(audioBuffer);
 * ```
 */
export function getWavDuration(buffer: Buffer): number {
  const wavInfo = parseWavHeader(buffer);
  return calculateWavDuration(wavInfo);
}
