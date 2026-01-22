/**
 * YouTube API client with OAuth 2.0 authentication
 * @module @nexus-ai/youtube/client
 */

import { google, type youtube_v3 } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { getSecret, createLogger, NexusError, type Logger } from '@nexus-ai/core';
import type { YouTubeOAuthCredentials } from './types.js';

/**
 * Secret name for YouTube OAuth credentials
 */
const YOUTUBE_OAUTH_SECRET = 'nexus-youtube-oauth';

/**
 * YouTube API scopes required for upload operations
 */
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
] as const;

/**
 * YouTube client wrapper with automatic token refresh
 */
export class YouTubeClient {
  private oauth2Client: OAuth2Client | null = null;
  private youtube: youtube_v3.Youtube | null = null;
  private credentials: YouTubeOAuthCredentials | null = null;
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('youtube.client');
  }

  /**
   * Initialize the YouTube client with OAuth credentials from Secret Manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing YouTube client');

    try {
      // Load OAuth credentials from Secret Manager
      const credentialsJson = await getSecret(YOUTUBE_OAUTH_SECRET);
      this.credentials = JSON.parse(credentialsJson) as YouTubeOAuthCredentials;

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        this.credentials.client_id,
        this.credentials.client_secret
      );

      // Set credentials (googleapis handles refresh automatically)
      this.oauth2Client.setCredentials({
        access_token: this.credentials.access_token,
        refresh_token: this.credentials.refresh_token,
        token_type: this.credentials.token_type,
        expiry_date: this.credentials.expiry_date,
      });

      // Set up automatic token refresh handler
      this.oauth2Client.on('tokens', (tokens: Credentials) => {
        this.logger.info({
          hasAccessToken: !!tokens.access_token,
          expiryDate: tokens.expiry_date,
        }, 'OAuth tokens refreshed');
        // Note: In production, you might want to persist the refreshed tokens
        // back to Secret Manager
      });

      // Create YouTube API client
      this.youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client,
      });

      this.logger.info('YouTube client initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize YouTube client');
      throw error;
    }
  }

  /**
   * Get the YouTube API client instance
   * @throws NexusError if client not initialized
   */
  getYouTubeApi(): youtube_v3.Youtube {
    if (!this.youtube) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_NOT_INITIALIZED',
        'YouTube client not initialized. Call initialize() first.',
        'youtube'
      );
    }
    return this.youtube;
  }

  /**
   * Get the OAuth2 client for direct API calls
   * @throws NexusError if client not initialized
   */
  getOAuth2Client(): OAuth2Client {
    if (!this.oauth2Client) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_NOT_INITIALIZED',
        'YouTube client not initialized. Call initialize() first.',
        'youtube'
      );
    }
    return this.oauth2Client;
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.youtube !== null && this.oauth2Client !== null;
  }

  /**
   * Force refresh the access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.oauth2Client) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_NOT_INITIALIZED',
        'YouTube client not initialized. Call initialize() first.',
        'youtube'
      );
    }

    this.logger.info('Manually refreshing access token');

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      this.logger.info({
        expiryDate: credentials.expiry_date,
      }, 'Access token refreshed successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to refresh access token');
      throw error;
    }
  }

  /**
   * Get the current access token (will refresh if expired)
   */
  async getAccessToken(): Promise<string> {
    if (!this.oauth2Client) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_NOT_INITIALIZED',
        'YouTube client not initialized. Call initialize() first.',
        'youtube'
      );
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    if (!accessToken.token) {
      throw NexusError.retryable(
        'NEXUS_YOUTUBE_TOKEN_FAILED',
        'Failed to get access token from OAuth2 client',
        'youtube'
      );
    }

    return accessToken.token;
  }
}

/**
 * Singleton instance of the YouTube client
 */
let clientInstance: YouTubeClient | null = null;

/**
 * Get or create the YouTube client singleton
 */
export async function getYouTubeClient(): Promise<YouTubeClient> {
  if (!clientInstance) {
    clientInstance = new YouTubeClient();
    await clientInstance.initialize();
  }
  return clientInstance;
}

/**
 * Reset the YouTube client singleton (useful for testing)
 */
export function resetYouTubeClient(): void {
  clientInstance = null;
}
