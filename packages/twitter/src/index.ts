/**
 * @nexus-ai/twitter - Twitter/X posting for NEXUS-AI pipeline
 * 
 * Automatically posts video links to Twitter/X when videos are published
 */

// Export types
export type {
  TwitterInput,
  TwitterOutput,
  TwitterCredentials,
  TweetResult,
  TwitterStageInput,
  TwitterStageOutput,
} from './types.js';

// Export client functions
export { createTwitterClient, loadTwitterCredentials } from './client.js';

// Export main stage function
export { executeTwitter, postTweet, formatTweetText } from './twitter.js';
