import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks using vi.hoisted
const {
  mockGetSecret,
  mockSetCredentials,
  mockOn,
  mockRefreshAccessToken,
  mockGetAccessToken,
  mockOAuth2Client,
  mockYouTubeApi,
} = vi.hoisted(() => {
  const mockGetSecret = vi.fn();
  const mockSetCredentials = vi.fn();
  const mockOn = vi.fn();
  const mockRefreshAccessToken = vi.fn();
  const mockGetAccessToken = vi.fn();

  const mockOAuth2Client = {
    setCredentials: mockSetCredentials,
    on: mockOn,
    refreshAccessToken: mockRefreshAccessToken,
    getAccessToken: mockGetAccessToken,
  };

  const mockYouTubeApi = {
    videos: {
      insert: vi.fn(),
      list: vi.fn(),
    },
  };

  return {
    mockGetSecret,
    mockSetCredentials,
    mockOn,
    mockRefreshAccessToken,
    mockGetAccessToken,
    mockOAuth2Client,
    mockYouTubeApi,
  };
});

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => mockOAuth2Client),
    },
    youtube: vi.fn().mockReturnValue(mockYouTubeApi),
  },
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => ({
  getSecret: mockGetSecret,
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  NexusError: {
    critical: (code: string, message: string, stage: string) => {
      const error = new Error(message);
      (error as Error & { code: string }).code = code;
      return error;
    },
    retryable: (code: string, message: string, stage: string) => {
      const error = new Error(message);
      (error as Error & { code: string }).code = code;
      return error;
    },
  },
}));

import {
  YouTubeClient,
  getYouTubeClient,
  resetYouTubeClient,
  YOUTUBE_SCOPES,
} from '../client.js';

describe('YouTubeClient', () => {
  const mockCredentials = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    refresh_token: 'test-refresh-token',
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetYouTubeClient();
    mockGetSecret.mockResolvedValue(JSON.stringify(mockCredentials));
    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000,
      },
    });
    mockGetAccessToken.mockResolvedValue({ token: 'test-access-token' });
  });

  afterEach(() => {
    resetYouTubeClient();
  });

  describe('constructor', () => {
    it('should create a YouTubeClient instance', () => {
      const client = new YouTubeClient();
      expect(client).toBeInstanceOf(YouTubeClient);
    });

    it('should not be initialized on construction', () => {
      const client = new YouTubeClient();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      expect(client.isInitialized()).toBe(true);
      expect(mockGetSecret).toHaveBeenCalledWith('nexus-youtube-oauth');
    });

    it('should set OAuth credentials', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: mockCredentials.access_token,
        refresh_token: mockCredentials.refresh_token,
        token_type: mockCredentials.token_type,
        expiry_date: mockCredentials.expiry_date,
      });
    });

    it('should set up token refresh handler', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
    });

    it('should throw error if credentials retrieval fails', async () => {
      mockGetSecret.mockRejectedValue(new Error('Secret not found'));

      const client = new YouTubeClient();
      await expect(client.initialize()).rejects.toThrow('Secret not found');
    });

    it('should throw error if credentials are invalid JSON', async () => {
      mockGetSecret.mockResolvedValue('not-valid-json');

      const client = new YouTubeClient();
      await expect(client.initialize()).rejects.toThrow();
    });
  });

  describe('getYouTubeApi', () => {
    it('should return YouTube API after initialization', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      const api = client.getYouTubeApi();
      expect(api).toBe(mockYouTubeApi);
    });

    it('should throw error if not initialized', () => {
      const client = new YouTubeClient();

      expect(() => client.getYouTubeApi()).toThrow(
        'YouTube client not initialized'
      );
    });
  });

  describe('getOAuth2Client', () => {
    it('should return OAuth2 client after initialization', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      const oauth2 = client.getOAuth2Client();
      expect(oauth2).toBe(mockOAuth2Client);
    });

    it('should throw error if not initialized', () => {
      const client = new YouTubeClient();

      expect(() => client.getOAuth2Client()).toThrow(
        'YouTube client not initialized'
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      await client.refreshAccessToken();

      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(mockSetCredentials).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      const client = new YouTubeClient();

      await expect(client.refreshAccessToken()).rejects.toThrow(
        'YouTube client not initialized'
      );
    });

    it('should throw error if refresh fails', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      const client = new YouTubeClient();
      await client.initialize();

      await expect(client.refreshAccessToken()).rejects.toThrow('Refresh failed');
    });
  });

  describe('getAccessToken', () => {
    it('should return the access token', async () => {
      const client = new YouTubeClient();
      await client.initialize();

      const token = await client.getAccessToken();
      expect(token).toBe('test-access-token');
    });

    it('should throw error if not initialized', async () => {
      const client = new YouTubeClient();

      await expect(client.getAccessToken()).rejects.toThrow(
        'YouTube client not initialized'
      );
    });

    it('should throw error if no token available', async () => {
      mockGetAccessToken.mockResolvedValue({ token: null });

      const client = new YouTubeClient();
      await client.initialize();

      await expect(client.getAccessToken()).rejects.toThrow(
        'Failed to get access token'
      );
    });
  });
});

describe('Singleton helpers', () => {
  const mockCredentials = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    refresh_token: 'test-refresh-token',
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetYouTubeClient();
    mockGetSecret.mockResolvedValue(JSON.stringify(mockCredentials));
  });

  afterEach(() => {
    resetYouTubeClient();
  });

  describe('getYouTubeClient', () => {
    it('should create and initialize a YouTubeClient', async () => {
      const client = await getYouTubeClient();

      expect(client).toBeInstanceOf(YouTubeClient);
      expect(client.isInitialized()).toBe(true);
    });

    it('should return the same instance on subsequent calls', async () => {
      const client1 = await getYouTubeClient();
      const client2 = await getYouTubeClient();

      expect(client1).toBe(client2);
    });
  });

  describe('resetYouTubeClient', () => {
    it('should reset the singleton instance', async () => {
      const client1 = await getYouTubeClient();
      resetYouTubeClient();
      const client2 = await getYouTubeClient();

      expect(client1).not.toBe(client2);
    });
  });
});

describe('YOUTUBE_SCOPES', () => {
  it('should include upload scope', () => {
    expect(YOUTUBE_SCOPES).toContain(
      'https://www.googleapis.com/auth/youtube.upload'
    );
  });

  it('should include youtube scope', () => {
    expect(YOUTUBE_SCOPES).toContain(
      'https://www.googleapis.com/auth/youtube'
    );
  });
});
