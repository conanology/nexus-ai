/**
 * @nexus-ai/timestamp-extraction
 * Audio download and format conversion utilities
 *
 * Handles downloading audio from GCS and converting to LINEAR16
 * format required by Google Cloud Speech-to-Text.
 */

import { Storage } from '@google-cloud/storage';
import { WaveFile } from 'wavefile';
import { createPipelineLogger } from '@nexus-ai/core';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Audio format information extracted from a WAV file.
 */
export interface AudioFormatInfo {
  /** Audio encoding format */
  encoding: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels */
  channels: number;
  /** Bit depth (e.g., 8, 16, 24, 32) */
  bitDepth: number;
  /** Duration in seconds */
  durationSec: number;
  /** File size in bytes */
  fileSizeBytes: number;
}

/**
 * Result of audio download and conversion.
 */
export interface AudioDownloadResult {
  /** Audio buffer in LINEAR16 format */
  buffer: Buffer;
  /** Original format information */
  originalFormat: AudioFormatInfo;
  /** Whether conversion was needed */
  conversionPerformed: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Target format for Google Cloud STT.
 */
const TARGET_FORMAT = {
  sampleRate: 24000,
  bitDepth: 16,
  channels: 1,
};

// -----------------------------------------------------------------------------
// GCS Client Management
// -----------------------------------------------------------------------------

let storageClient: Storage | null = null;

/**
 * Get or create the Storage client instance.
 */
function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

// -----------------------------------------------------------------------------
// Download Functions
// -----------------------------------------------------------------------------

/**
 * Download audio file from Google Cloud Storage.
 *
 * @param gcsUrl - GCS URL in format gs://bucket/path/to/file.wav
 * @param pipelineId - Pipeline ID for logging
 * @returns Audio buffer
 */
export async function downloadFromGCS(
  gcsUrl: string,
  pipelineId: string
): Promise<Buffer> {
  const log = createPipelineLogger(pipelineId, 'timestamp-extraction');

  // Parse GCS URL
  const match = gcsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCS URL format: ${gcsUrl}`);
  }

  const [, bucketName, filePath] = match;

  log.info(
    {
      bucket: bucketName,
      path: filePath,
    },
    'Downloading audio from GCS'
  );

  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  // Check if file exists
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Audio file not found: ${gcsUrl}`);
  }

  // Download file content
  const [buffer] = await file.download();

  log.info(
    {
      sizeBytes: buffer.length,
      sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
    },
    'Audio downloaded successfully'
  );

  return buffer;
}

// -----------------------------------------------------------------------------
// Format Validation and Conversion
// -----------------------------------------------------------------------------

/**
 * Validate audio format and extract metadata.
 *
 * @param buffer - Audio buffer (WAV format expected)
 * @returns Format information
 */
export function validateAudioFormat(buffer: Buffer): AudioFormatInfo {
  try {
    const wav = new WaveFile(buffer);

    // Get format info from WAV header
    const fmt = wav.fmt as {
      audioFormat: number;
      numChannels: number;
      sampleRate: number;
      bitsPerSample: number;
    };

    // Calculate duration
    const dataSize = wav.data
      ? (wav.data as { samples: Uint8Array }).samples.length
      : 0;
    const bytesPerSample = fmt.bitsPerSample / 8;
    const bytesPerSecond = fmt.sampleRate * fmt.numChannels * bytesPerSample;
    const durationSec = bytesPerSecond > 0 ? dataSize / bytesPerSecond : 0;

    // Determine encoding name
    let encoding: string;
    switch (fmt.audioFormat) {
      case 1:
        encoding = 'LINEAR16';
        break;
      case 3:
        encoding = 'FLOAT';
        break;
      case 6:
        encoding = 'ALAW';
        break;
      case 7:
        encoding = 'MULAW';
        break;
      default:
        encoding = `UNKNOWN(${fmt.audioFormat})`;
    }

    return {
      encoding,
      sampleRate: fmt.sampleRate,
      channels: fmt.numChannels,
      bitDepth: fmt.bitsPerSample,
      durationSec,
      fileSizeBytes: buffer.length,
    };
  } catch (error) {
    throw new Error(
      `Invalid audio format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert audio to LINEAR16 format if needed.
 *
 * @param buffer - Audio buffer
 * @param targetSampleRate - Target sample rate (default: 24000)
 * @returns Converted buffer (or original if no conversion needed)
 */
export function convertToLinear16(
  buffer: Buffer,
  targetSampleRate: number = TARGET_FORMAT.sampleRate
): { buffer: Buffer; converted: boolean } {
  const wav = new WaveFile(buffer);

  const fmt = wav.fmt as {
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
  };

  let converted = false;

  // Convert to correct bit depth if needed
  if (fmt.bitsPerSample !== TARGET_FORMAT.bitDepth) {
    wav.toBitDepth(TARGET_FORMAT.bitDepth.toString());
    converted = true;
  }

  // Resample if needed
  if (fmt.sampleRate !== targetSampleRate) {
    wav.toSampleRate(targetSampleRate);
    converted = true;
  }

  // Note: WaveFile doesn't have a native toMono method
  // If stereo conversion is needed, we'll need to handle it differently
  // For now, Google Cloud STT can handle mono or stereo audio

  return {
    buffer: Buffer.from(wav.toBuffer()),
    converted,
  };
}

/**
 * Download audio from GCS and convert to LINEAR16 format.
 *
 * @param gcsUrl - GCS URL to audio file
 * @param pipelineId - Pipeline ID for logging
 * @returns Download result with converted buffer
 */
export async function downloadAndConvert(
  gcsUrl: string,
  pipelineId: string
): Promise<AudioDownloadResult> {
  const log = createPipelineLogger(pipelineId, 'timestamp-extraction');

  // Download
  const originalBuffer = await downloadFromGCS(gcsUrl, pipelineId);

  // Validate format
  const originalFormat = validateAudioFormat(originalBuffer);

  log.info(
    {
      encoding: originalFormat.encoding,
      sampleRate: originalFormat.sampleRate,
      channels: originalFormat.channels,
      bitDepth: originalFormat.bitDepth,
      durationSec: originalFormat.durationSec,
    },
    'Original audio format'
  );

  // Convert if needed
  const { buffer, converted } = convertToLinear16(originalBuffer);

  if (converted) {
    log.info(
      {
        originalSampleRate: originalFormat.sampleRate,
        targetSampleRate: TARGET_FORMAT.sampleRate,
        originalBitDepth: originalFormat.bitDepth,
        targetBitDepth: TARGET_FORMAT.bitDepth,
        originalChannels: originalFormat.channels,
        targetChannels: TARGET_FORMAT.channels,
      },
      'Audio converted to LINEAR16'
    );
  } else {
    log.info({}, 'Audio already in correct format');
  }

  return {
    buffer,
    originalFormat,
    conversionPerformed: converted,
  };
}

/**
 * Check if a GCS URL is valid format.
 *
 * @param url - URL to validate
 * @returns True if valid GCS URL
 */
export function isValidGcsUrl(url: string): boolean {
  return /^gs:\/\/[a-z0-9][-a-z0-9._]*[a-z0-9]\//.test(url);
}
