/**
 * TTS-specific types for NEXUS-AI
 * @module @nexus-ai/tts/types
 */

import type { DirectionDocument } from '@nexus-ai/script-gen';

/**
 * Input for TTS synthesis stage
 */
export interface TTSInput {
  /** SSML-tagged script from pronunciation stage */
  ssmlScript: string;
  /** Optional voice ID to use */
  voice?: string;
  /** Speaking rate (0.9-1.1x normal) */
  rate?: number;
  /** Pitch adjustment (-20 to 20) */
  pitch?: number;
  /** Maximum characters per chunk (default: 5000) */
  maxChunkChars?: number;
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
  /** Pass-through direction document for downstream stages (timestamp-extraction, visual-gen) */
  directionDocument?: DirectionDocument;
}

/**
 * Output from TTS synthesis stage
 */
export interface TTSOutput {
  /** GCS URL to synthesized audio file */
  audioUrl: string;
  /** Audio duration in seconds */
  durationSec: number;
  /** Audio format (wav/mp3) */
  format: string;
  /** Sample rate in Hz (44100 for CD quality) */
  sampleRate: number;
  /** Number of segments if chunking was used */
  segmentCount?: number;
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
  /** Pass-through direction document for downstream stages (timestamp-extraction, visual-gen) */
  directionDocument?: DirectionDocument;
}

/**
 * Metadata about audio quality checks
 */
export interface AudioQualityInfo {
  /** Percentage of audio that is silent (<5% required) */
  silencePct: number;
  /** Whether clipping was detected */
  clippingDetected: boolean;
  /** Average loudness in dB */
  averageLoudnessDb: number;
  /** Duration validation result */
  durationValid: boolean;
}

/**
 * Information about a script chunk
 */
export interface ChunkInfo {
  /** Index of chunk in sequence (0-based) */
  index: number;
  /** Text content of chunk */
  text: string;
  /** Starting character position in original script */
  startChar: number;
  /** Ending character position in original script */
  endChar: number;
}

/**
 * Audio segment from chunk synthesis
 */
export interface AudioSegment {
  /** Index of segment in sequence (0-based) */
  index: number;
  /** Audio data as Buffer */
  audioBuffer: Buffer;
  /** Duration in seconds */
  durationSec: number;
}
