/**
 * @nexus-ai/timestamp-extraction
 * Google Cloud Speech-to-Text client wrapper
 *
 * Provides word-level timestamp extraction from audio files.
 * Uses long-running recognition for audio > 1 minute.
 */

import { SpeechClient, protos } from '@google-cloud/speech';
import { createPipelineLogger, CostTracker } from '@nexus-ai/core';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Configuration for STT recognition.
 */
export interface STTConfig {
  /** Audio encoding format */
  encoding: 'LINEAR16' | 'FLAC' | 'MP3' | 'OGG_OPUS';
  /** Sample rate in Hz (must match audio file) */
  sampleRateHertz: number;
  /** Language code for recognition */
  languageCode: string;
  /** Model to use for recognition */
  model?: 'latest_long' | 'latest_short' | 'video' | 'phone_call';
  /** Whether to use enhanced model (higher cost, better accuracy) */
  useEnhanced?: boolean;
}

/**
 * A single word with timing from STT.
 */
export interface STTWord {
  /** The recognized word */
  word: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Result from STT extraction.
 */
export interface STTExtractionResult {
  /** All recognized words with timing */
  words: STTWord[];
  /** Full transcript text */
  transcript: string;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Total audio duration in seconds */
  audioDurationSec: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Default STT configuration matching Gemini TTS output.
 */
export const DEFAULT_STT_CONFIG: STTConfig = {
  encoding: 'LINEAR16',
  sampleRateHertz: 24000, // Match Gemini TTS output
  languageCode: 'en-US',
  model: 'latest_long',
  useEnhanced: true,
};

/**
 * Cost per minute for different recognition models.
 */
const STT_COST_PER_MINUTE = {
  standard: 0.004,
  enhanced: 0.009,
};

/**
 * Maximum timeout for long-running recognition in milliseconds.
 * Set to 120s for the actual operation, which accommodates longer audio files.
 */
const MAX_RECOGNITION_TIMEOUT_MS = 120000; // 2 minutes

// Encoding map for type-safe conversion
const ENCODING_MAP: Record<STTConfig['encoding'], number> = {
  LINEAR16: 1,
  FLAC: 2,
  MP3: 8,
  OGG_OPUS: 6,
};

// -----------------------------------------------------------------------------
// Client Management
// -----------------------------------------------------------------------------

let speechClient: SpeechClient | null = null;

/**
 * Get or create the Speech client instance.
 * Uses Application Default Credentials (ADC) automatically.
 */
export function createSpeechClient(): SpeechClient {
  if (!speechClient) {
    speechClient = new SpeechClient();
  }
  return speechClient;
}

/**
 * Close the Speech client connection.
 * Call this when shutting down the application.
 */
export async function closeSpeechClient(): Promise<void> {
  if (speechClient) {
    await speechClient.close();
    speechClient = null;
  }
}

/**
 * Reset the Speech client singleton.
 * Used for test isolation to prevent state leaking between tests.
 */
export function resetSpeechClient(): void {
  speechClient = null;
}

// -----------------------------------------------------------------------------
// Recognition Functions
// -----------------------------------------------------------------------------

/**
 * Extract word-level timestamps from audio using Google Cloud STT.
 *
 * Uses long-running recognition for audio files, which is required
 * for audio longer than 1 minute or when using GCS URIs.
 *
 * @param audioContent - Audio content as base64 string or GCS URI
 * @param config - STT configuration
 * @param pipelineId - Pipeline ID for logging and cost tracking
 * @param costTracker - Cost tracker instance
 * @returns Extraction result with word timings
 */
export async function recognizeLongRunning(
  audioContent: string | Buffer,
  config: STTConfig = DEFAULT_STT_CONFIG,
  pipelineId: string,
  costTracker?: CostTracker
): Promise<STTExtractionResult> {
  const startTime = Date.now();
  const log = createPipelineLogger(pipelineId, 'timestamp-extraction');
  const client = createSpeechClient();

  // Build recognition config with proper encoding type
  const recognitionConfig: protos.google.cloud.speech.v1.IRecognitionConfig = {
    encoding: ENCODING_MAP[config.encoding],
    sampleRateHertz: config.sampleRateHertz,
    languageCode: config.languageCode,
    enableWordTimeOffsets: true, // CRITICAL: Enable word-level timing
    model: config.model,
    useEnhanced: config.useEnhanced,
  };

  // Build audio config based on input type
  const audio: protos.google.cloud.speech.v1.IRecognitionAudio = {};
  if (typeof audioContent === 'string' && audioContent.startsWith('gs://')) {
    // GCS URI - use directly
    audio.uri = audioContent;
    log.info({ uri: audioContent }, 'Using GCS URI for STT');
  } else {
    // Buffer or base64 - convert to base64
    const base64Content =
      audioContent instanceof Buffer
        ? audioContent.toString('base64')
        : audioContent;
    audio.content = base64Content;
    log.info(
      { contentLength: base64Content.length },
      'Using inline content for STT'
    );
  }

  log.info(
    {
      encoding: config.encoding,
      sampleRate: config.sampleRateHertz,
      model: config.model,
      enhanced: config.useEnhanced,
    },
    'Starting long-running recognition'
  );

  try {
    // Start long-running recognition and wait for result
    const [operation] = await client.longRunningRecognize({
      config: recognitionConfig,
      audio,
    });

    // Wait for the operation to complete with timeout
    const operationPromise = operation.promise();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`STT recognition timed out after ${MAX_RECOGNITION_TIMEOUT_MS}ms`)),
        MAX_RECOGNITION_TIMEOUT_MS
      );
    });

    // Race between operation completion and timeout
    const operationResult = await Promise.race([
      operationPromise,
      timeoutPromise,
    ]);

    // Extract response from operation result (first element of tuple)
    const response = (operationResult as unknown[])[0] as protos.google.cloud.speech.v1.ILongRunningRecognizeResponse;

    // Parse results
    const result = parseRecognitionResponse(response);
    const processingTimeMs = Date.now() - startTime;

    // Track costs
    if (costTracker && result.audioDurationSec > 0) {
      const costPerMinute = config.useEnhanced
        ? STT_COST_PER_MINUTE.enhanced
        : STT_COST_PER_MINUTE.standard;
      const minutes = Math.ceil(result.audioDurationSec / 60);
      const cost = minutes * costPerMinute;

      costTracker.recordApiCall('google-stt', {}, cost);

      log.info(
        {
          audioDurationMin: minutes,
          cost,
          model: config.model,
        },
        'STT cost recorded'
      );
    }

    log.info(
      {
        wordCount: result.words.length,
        confidence: result.confidence,
        processingTimeMs,
      },
      'STT recognition complete'
    );

    return {
      ...result,
      processingTimeMs,
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    log.error(
      {
        error,
        processingTimeMs,
      },
      'STT recognition failed'
    );
    throw error;
  }
}

/**
 * Parse the recognition response into our result format.
 */
function parseRecognitionResponse(
  response: protos.google.cloud.speech.v1.ILongRunningRecognizeResponse
): Omit<STTExtractionResult, 'processingTimeMs'> {
  const words: STTWord[] = [];
  let transcript = '';
  let totalConfidence = 0;
  let resultCount = 0;
  let audioDurationSec = 0;

  if (!response.results || response.results.length === 0) {
    return {
      words: [],
      transcript: '',
      confidence: 0,
      audioDurationSec: 0,
    };
  }

  for (const result of response.results) {
    if (!result.alternatives || result.alternatives.length === 0) continue;

    const alternative = result.alternatives[0];
    const altConfidence = alternative.confidence ?? 0;

    // Accumulate transcript
    if (alternative.transcript) {
      transcript += (transcript ? ' ' : '') + alternative.transcript;
    }

    // Accumulate confidence
    totalConfidence += altConfidence;
    resultCount++;

    // Extract word timings
    if (alternative.words) {
      for (const wordInfo of alternative.words) {
        if (!wordInfo.word) continue;

        const wordStartTime = parseGoogleDuration(wordInfo.startTime);
        const wordEndTime = parseGoogleDuration(wordInfo.endTime);

        // Track max end time for audio duration
        if (wordEndTime > audioDurationSec) {
          audioDurationSec = wordEndTime;
        }

        words.push({
          word: wordInfo.word,
          startTime: wordStartTime,
          endTime: wordEndTime,
          confidence: altConfidence, // Use alternative confidence for each word
        });
      }
    }
  }

  return {
    words,
    transcript: transcript.trim(),
    confidence: resultCount > 0 ? totalConfidence / resultCount : 0,
    audioDurationSec,
  };
}

/**
 * Parse Google's duration format to seconds.
 * Google returns { seconds: string | number | Long, nanos: number }
 */
function parseGoogleDuration(
  duration: protos.google.protobuf.IDuration | null | undefined
): number {
  if (!duration) return 0;

  let seconds: number;
  if (typeof duration.seconds === 'string') {
    seconds = parseInt(duration.seconds, 10);
  } else if (typeof duration.seconds === 'number') {
    seconds = duration.seconds;
  } else if (duration.seconds) {
    // Handle Long type by converting to number
    seconds = Number(duration.seconds);
  } else {
    seconds = 0;
  }

  const nanos = duration.nanos ?? 0;

  return seconds + nanos / 1e9;
}

// -----------------------------------------------------------------------------
// Fallback Decision
// -----------------------------------------------------------------------------

/**
 * Thresholds for deciding when to use fallback.
 */
export const FALLBACK_THRESHOLDS = {
  /** Minimum confidence score to trust STT results */
  MIN_CONFIDENCE: 0.8,
  /** Maximum word count mismatch ratio before fallback */
  MAX_WORD_COUNT_MISMATCH: 0.2,
  /**
   * Maximum API timeout in milliseconds (for external reference).
   * Note: The actual recognition timeout is MAX_RECOGNITION_TIMEOUT_MS (120s)
   * which is higher to accommodate long audio files. This threshold is
   * the soft limit for quality gate evaluation.
   */
  MAX_API_TIMEOUT_MS: 30000,
};

/**
 * Determine if we should use estimated timing fallback.
 *
 * @param sttResult - Result from STT (null if error)
 * @param expectedWordCount - Expected number of words
 * @param error - Error from STT call (null if success)
 * @returns Whether to use fallback and reason
 */
export function shouldUseFallback(
  sttResult: STTExtractionResult | null,
  expectedWordCount: number,
  error: Error | null
): { useFallback: boolean; reason: string } {
  // API error → fallback
  if (error || !sttResult) {
    return { useFallback: true, reason: 'stt-api-error' };
  }

  // Low confidence → fallback
  if (sttResult.confidence < FALLBACK_THRESHOLDS.MIN_CONFIDENCE) {
    return {
      useFallback: true,
      reason: `low-confidence: ${(sttResult.confidence * 100).toFixed(1)}%`,
    };
  }

  // Word count mismatch → fallback
  if (expectedWordCount > 0) {
    const mismatchRatio =
      Math.abs(sttResult.words.length - expectedWordCount) / expectedWordCount;
    if (mismatchRatio > FALLBACK_THRESHOLDS.MAX_WORD_COUNT_MISMATCH) {
      return {
        useFallback: true,
        reason: `word-count-mismatch: ${sttResult.words.length}/${expectedWordCount} (${(mismatchRatio * 100).toFixed(1)}% diff)`,
      };
    }
  }

  return { useFallback: false, reason: '' };
}
