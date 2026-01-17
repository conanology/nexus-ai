/**
 * TTS-specific types for NEXUS-AI
 * @module @nexus-ai/tts/types
 */

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
