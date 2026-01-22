/**
 * Error code constants for NEXUS-AI pipeline
 * All codes follow format: NEXUS_{DOMAIN}_{TYPE}
 */

// =============================================================================
// LLM Domain
// =============================================================================
export const NEXUS_LLM_TIMEOUT = 'NEXUS_LLM_TIMEOUT';
export const NEXUS_LLM_RATE_LIMIT = 'NEXUS_LLM_RATE_LIMIT';
export const NEXUS_LLM_INVALID_RESPONSE = 'NEXUS_LLM_INVALID_RESPONSE';
export const NEXUS_LLM_CONTEXT_LENGTH = 'NEXUS_LLM_CONTEXT_LENGTH';
export const NEXUS_LLM_GENERATION_FAILED = 'NEXUS_LLM_GENERATION_FAILED';

// =============================================================================
// TTS Domain
// =============================================================================
export const NEXUS_TTS_TIMEOUT = 'NEXUS_TTS_TIMEOUT';
export const NEXUS_TTS_RATE_LIMIT = 'NEXUS_TTS_RATE_LIMIT';
export const NEXUS_TTS_SYNTHESIS_FAILED = 'NEXUS_TTS_SYNTHESIS_FAILED';
export const NEXUS_TTS_INVALID_SSML = 'NEXUS_TTS_INVALID_SSML';
export const NEXUS_TTS_VOICE_NOT_FOUND = 'NEXUS_TTS_VOICE_NOT_FOUND';

// =============================================================================
// Image Domain
// =============================================================================
export const NEXUS_IMAGE_TIMEOUT = 'NEXUS_IMAGE_TIMEOUT';
export const NEXUS_IMAGE_GENERATION_FAILED = 'NEXUS_IMAGE_GENERATION_FAILED';
export const NEXUS_IMAGE_INVALID_DIMENSIONS = 'NEXUS_IMAGE_INVALID_DIMENSIONS';

// =============================================================================
// Storage Domain
// =============================================================================
export const NEXUS_STORAGE_READ_FAILED = 'NEXUS_STORAGE_READ_FAILED';
export const NEXUS_STORAGE_WRITE_FAILED = 'NEXUS_STORAGE_WRITE_FAILED';
export const NEXUS_STORAGE_NOT_FOUND = 'NEXUS_STORAGE_NOT_FOUND';
export const NEXUS_STORAGE_PERMISSION_DENIED = 'NEXUS_STORAGE_PERMISSION_DENIED';

// =============================================================================
// Quality Domain
// =============================================================================
export const NEXUS_QUALITY_GATE_FAIL = 'NEXUS_QUALITY_GATE_FAIL';
export const NEXUS_QUALITY_DEGRADED = 'NEXUS_QUALITY_DEGRADED';
export const NEXUS_QUALITY_WORD_COUNT = 'NEXUS_QUALITY_WORD_COUNT';
export const NEXUS_QUALITY_AUDIO_CLIPPING = 'NEXUS_QUALITY_AUDIO_CLIPPING';
export const NEXUS_QUALITY_FRAME_DROP = 'NEXUS_QUALITY_FRAME_DROP';

// =============================================================================
// Pipeline Domain
// =============================================================================
export const NEXUS_PIPELINE_TIMEOUT = 'NEXUS_PIPELINE_TIMEOUT';
export const NEXUS_PIPELINE_STAGE_FAILED = 'NEXUS_PIPELINE_STAGE_FAILED';
export const NEXUS_PIPELINE_ABORTED = 'NEXUS_PIPELINE_ABORTED';
export const NEXUS_PIPELINE_INVALID_STATE = 'NEXUS_PIPELINE_INVALID_STATE';

// =============================================================================
// News Domain
// =============================================================================
export const NEXUS_NEWS_NO_TOPICS = 'NEXUS_NEWS_NO_TOPICS';
export const NEXUS_NEWS_SOURCE_FAILED = 'NEXUS_NEWS_SOURCE_FAILED';
export const NEXUS_NEWS_INSUFFICIENT_TOPICS = 'NEXUS_NEWS_INSUFFICIENT_TOPICS';

// =============================================================================
// Script Domain
// =============================================================================
export const NEXUS_SCRIPT_GENERATION_FAILED = 'NEXUS_SCRIPT_GENERATION_FAILED';
export const NEXUS_SCRIPT_VALIDATION_FAILED = 'NEXUS_SCRIPT_VALIDATION_FAILED';
export const NEXUS_SCRIPT_WORD_COUNT_OUT_OF_RANGE = 'NEXUS_SCRIPT_WORD_COUNT_OUT_OF_RANGE';

// =============================================================================
// Pronunciation Domain
// =============================================================================
export const NEXUS_PRONUNCIATION_UNKNOWN_TERMS = 'NEXUS_PRONUNCIATION_UNKNOWN_TERMS';
export const NEXUS_PRONUNCIATION_DICTIONARY_FAILED = 'NEXUS_PRONUNCIATION_DICTIONARY_FAILED';

// =============================================================================
// Render Domain
// =============================================================================
export const NEXUS_RENDER_TIMEOUT = 'NEXUS_RENDER_TIMEOUT';
export const NEXUS_RENDER_FAILED = 'NEXUS_RENDER_FAILED';
export const NEXUS_RENDER_AUDIO_SYNC = 'NEXUS_RENDER_AUDIO_SYNC';

// =============================================================================
// YouTube Domain
// =============================================================================
export const NEXUS_YOUTUBE_UPLOAD_FAILED = 'NEXUS_YOUTUBE_UPLOAD_FAILED';
export const NEXUS_YOUTUBE_QUOTA_EXCEEDED = 'NEXUS_YOUTUBE_QUOTA_EXCEEDED';
export const NEXUS_YOUTUBE_AUTH_FAILED = 'NEXUS_YOUTUBE_AUTH_FAILED';

// =============================================================================
// Twitter Domain
// =============================================================================
export const NEXUS_TWITTER_POST_FAILED = 'NEXUS_TWITTER_POST_FAILED';
export const NEXUS_TWITTER_AUTH_FAILED = 'NEXUS_TWITTER_AUTH_FAILED';
export const NEXUS_TWITTER_RATE_LIMIT = 'NEXUS_TWITTER_RATE_LIMIT';

// =============================================================================
// Thumbnail Domain
// =============================================================================
export const NEXUS_THUMBNAIL_GENERATION_FAILED = 'NEXUS_THUMBNAIL_GENERATION_FAILED';
export const NEXUS_THUMBNAIL_INSUFFICIENT_VARIANTS = 'NEXUS_THUMBNAIL_INSUFFICIENT_VARIANTS';

// =============================================================================
// Notification Domain
// =============================================================================
export const NEXUS_NOTIFICATION_SEND_FAILED = 'NEXUS_NOTIFICATION_SEND_FAILED';
export const NEXUS_NOTIFICATION_RATE_LIMIT = 'NEXUS_NOTIFICATION_RATE_LIMIT';
export const NEXUS_NOTIFICATION_INVALID_CHANNEL = 'NEXUS_NOTIFICATION_INVALID_CHANNEL';

// =============================================================================
// Retry Domain
// =============================================================================
export const NEXUS_RETRY_EXHAUSTED = 'NEXUS_RETRY_EXHAUSTED';
export const NEXUS_RETRY_LOGIC_ERROR = 'NEXUS_RETRY_LOGIC_ERROR';
export const NEXUS_RETRY_INVALID_OPTIONS = 'NEXUS_RETRY_INVALID_OPTIONS';

// =============================================================================
// Fallback Domain
// =============================================================================
export const NEXUS_FALLBACK_EXHAUSTED = 'NEXUS_FALLBACK_EXHAUSTED';
export const NEXUS_FALLBACK_NO_PROVIDERS = 'NEXUS_FALLBACK_NO_PROVIDERS';

// =============================================================================
// Incident Domain
// =============================================================================
export const NEXUS_INCIDENT_LOGGING_FAILED = 'NEXUS_INCIDENT_LOGGING_FAILED';
export const NEXUS_INCIDENT_NOT_FOUND = 'NEXUS_INCIDENT_NOT_FOUND';
export const NEXUS_INCIDENT_QUERY_FAILED = 'NEXUS_INCIDENT_QUERY_FAILED';
export const NEXUS_INCIDENT_RESOLUTION_FAILED = 'NEXUS_INCIDENT_RESOLUTION_FAILED';

// =============================================================================
// Buffer Domain
// =============================================================================
export const NEXUS_BUFFER_NOT_FOUND = 'NEXUS_BUFFER_NOT_FOUND';
export const NEXUS_BUFFER_DEPLOYMENT_FAILED = 'NEXUS_BUFFER_DEPLOYMENT_FAILED';
export const NEXUS_BUFFER_EXHAUSTED = 'NEXUS_BUFFER_EXHAUSTED';
export const NEXUS_BUFFER_CREATE_FAILED = 'NEXUS_BUFFER_CREATE_FAILED';
export const NEXUS_BUFFER_INVALID_STATUS = 'NEXUS_BUFFER_INVALID_STATUS';
export const NEXUS_BUFFER_QUERY_FAILED = 'NEXUS_BUFFER_QUERY_FAILED';

// =============================================================================
// Queue Domain
// =============================================================================
export const NEXUS_QUEUE_TOPIC_NOT_FOUND = 'NEXUS_QUEUE_TOPIC_NOT_FOUND';
export const NEXUS_QUEUE_TOPIC_MAX_RETRIES = 'NEXUS_QUEUE_TOPIC_MAX_RETRIES';
export const NEXUS_QUEUE_TOPIC_SAVE_FAILED = 'NEXUS_QUEUE_TOPIC_SAVE_FAILED';
export const NEXUS_QUEUE_TOPIC_CLEAR_FAILED = 'NEXUS_QUEUE_TOPIC_CLEAR_FAILED';

// =============================================================================
// Generic / Unknown
// =============================================================================
export const NEXUS_UNKNOWN_ERROR = 'NEXUS_UNKNOWN_ERROR';
export const NEXUS_VALIDATION_ERROR = 'NEXUS_VALIDATION_ERROR';
export const NEXUS_CONFIG_ERROR = 'NEXUS_CONFIG_ERROR';
