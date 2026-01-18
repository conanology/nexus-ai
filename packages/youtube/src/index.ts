/**
 * @nexus-ai/youtube
 * YouTube upload package with resumable uploads for NEXUS-AI pipeline
 *
 * @module @nexus-ai/youtube
 */

// Export all types
export * from './types.js';

// Export client (OAuth and YouTube API client)
export * from './client.js';

// Export uploader (Resumable upload implementation)
export * from './uploader.js';

// Export quota tracking
export * from './quota.js';

// Export main stage logic
export * from './youtube.js';

// Placeholder exports for future stories (4.2, 4.4)
export * from './metadata.js';
export * from './scheduler.js';

// Export thumbnail functionality (Story 4.3)
export * from './thumbnail.js';
