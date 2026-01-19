/**
 * Twitter API client setup
 */

import { TwitterApi } from 'twitter-api-v2';
import { getSecret, logger } from '@nexus-ai/core';
import type { TwitterCredentials } from './types.js';

/**
 * Initialize Twitter API client with OAuth 2.0 credentials from Secret Manager
 */
export async function createTwitterClient(): Promise<TwitterApi> {
  logger.info('Initializing Twitter API client');
  
  try {
    // Load credentials from GCP Secret Manager
    const credentials = await loadTwitterCredentials();
    
    // Create Twitter API client with OAuth 1.0a (User context)
    // Note: Twitter API v2 supports both OAuth 1.0a and OAuth 2.0
    // We use OAuth 1.0a because posting tweets requires user context.
    // OAuth 1.0a tokens don't expire, so no refresh logic needed.
    const client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
    
    logger.info('Twitter API client initialized successfully');
    
    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Twitter API client');
    throw error;
  }
}

/**
 * Load Twitter credentials from GCP Secret Manager
 */
export async function loadTwitterCredentials(): Promise<TwitterCredentials> {
  try {
    // Get credentials JSON from Secret Manager
    const secretValue = await getSecret('nexus-twitter-oauth');
    
    // Parse JSON credentials
    const credentials = JSON.parse(secretValue) as TwitterCredentials;
    
    // Validate required fields
    if (!credentials.appKey || !credentials.appSecret || 
        !credentials.accessToken || !credentials.accessSecret) {
      throw new Error('Missing required Twitter OAuth credentials');
    }
    
    logger.debug('Twitter credentials loaded successfully');
    
    return credentials;
  } catch (error) {
    logger.error({ error }, 'Failed to load Twitter credentials from Secret Manager');
    throw error;
  }
}
