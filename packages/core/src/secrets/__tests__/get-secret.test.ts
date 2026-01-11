/**
 * Tests for getSecret with GCP Secret Manager integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSecret,
  hasSecret,
  clearSecretCache,
  isSecretCached,
  getSecretCacheSize,
} from '../get-secret.js';
import { NexusError } from '../../errors/index.js';

describe('getSecret', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Clear cache before each test
    clearSecretCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('environment variable fallback', () => {
    it('should read from environment variable', async () => {
      process.env.NEXUS_TEST_SECRET = 'test-value';

      const value = await getSecret('nexus-test-secret');

      expect(value).toBe('test-value');
    });

    it('should convert kebab-case to SCREAMING_SNAKE', async () => {
      process.env.NEXUS_GEMINI_API_KEY = 'api-key-value';

      const value = await getSecret('nexus-gemini-api-key');

      expect(value).toBe('api-key-value');
    });

    it('should handle single word secret names', async () => {
      process.env.SECRET = 'single-word-secret';

      const value = await getSecret('secret');

      expect(value).toBe('single-word-secret');
    });

    it('should handle complex secret names', async () => {
      process.env.NEXUS_YOUTUBE_OAUTH_REFRESH_TOKEN = 'complex-token';

      const value = await getSecret('nexus-youtube-oauth-refresh-token');

      expect(value).toBe('complex-token');
    });
  });

  describe('caching behavior', () => {
    it('should cache secret after first retrieval', async () => {
      process.env.NEXUS_CACHED_SECRET = 'cached-value';

      expect(isSecretCached('nexus-cached-secret')).toBe(false);

      await getSecret('nexus-cached-secret');

      expect(isSecretCached('nexus-cached-secret')).toBe(true);
    });

    it('should return cached value on subsequent calls', async () => {
      process.env.NEXUS_CACHE_TEST = 'original-value';

      const value1 = await getSecret('nexus-cache-test');

      // Change env var - should still return cached value
      process.env.NEXUS_CACHE_TEST = 'changed-value';

      const value2 = await getSecret('nexus-cache-test');

      expect(value1).toBe('original-value');
      expect(value2).toBe('original-value');
    });

    it('should clear cache with clearSecretCache', async () => {
      process.env.NEXUS_CLEAR_TEST = 'value';

      await getSecret('nexus-clear-test');
      expect(isSecretCached('nexus-clear-test')).toBe(true);

      clearSecretCache();

      expect(isSecretCached('nexus-clear-test')).toBe(false);
    });

    it('should track cache size correctly', async () => {
      expect(getSecretCacheSize()).toBe(0);

      process.env.NEXUS_SIZE_TEST_1 = 'value1';
      process.env.NEXUS_SIZE_TEST_2 = 'value2';

      await getSecret('nexus-size-test-1');
      expect(getSecretCacheSize()).toBe(1);

      await getSecret('nexus-size-test-2');
      expect(getSecretCacheSize()).toBe(2);

      clearSecretCache();
      expect(getSecretCacheSize()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw NexusError when secret not found and no project ID', async () => {
      delete process.env.NEXUS_NONEXISTENT;
      delete process.env.NEXUS_PROJECT_ID;

      try {
        await getSecret('nexus-nonexistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });

    it('should throw with NEXUS_SECRET_NO_PROJECT code when no env var and no project', async () => {
      delete process.env.NEXUS_MISSING_KEY;
      delete process.env.NEXUS_PROJECT_ID;

      try {
        await getSecret('nexus-missing-key');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
        expect((error as NexusError).code).toBe('NEXUS_SECRET_NO_PROJECT');
      }
    });

    it('should include secret name and env var name in error context', async () => {
      delete process.env.NEXUS_MISSING_KEY;
      delete process.env.NEXUS_PROJECT_ID;

      try {
        await getSecret('nexus-missing-key');
        expect.fail('Should have thrown');
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.context?.secretName).toBe('nexus-missing-key');
        expect(nexusError.context?.envVarName).toBe('NEXUS_MISSING_KEY');
      }
    });

    it('should include stage "secrets" in error', async () => {
      delete process.env.NEXUS_MISSING;
      delete process.env.NEXUS_PROJECT_ID;

      try {
        await getSecret('nexus-missing');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as NexusError).stage).toBe('secrets');
      }
    });
  });

  describe('empty values', () => {
    it('should not treat empty string as valid secret', async () => {
      process.env.NEXUS_EMPTY = '';
      delete process.env.NEXUS_PROJECT_ID;

      try {
        await getSecret('nexus-empty');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });
});

describe('hasSecret', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearSecretCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when secret exists in env', () => {
    process.env.NEXUS_API_KEY = 'some-value';

    expect(hasSecret('nexus-api-key')).toBe(true);
  });

  it('should return false when secret does not exist', () => {
    delete process.env.NEXUS_NONEXISTENT;

    expect(hasSecret('nexus-nonexistent')).toBe(false);
  });

  it('should convert kebab-case to SCREAMING_SNAKE', () => {
    process.env.NEXUS_MY_SECRET_KEY = 'value';

    expect(hasSecret('nexus-my-secret-key')).toBe(true);
  });

  it('should return true for cached secrets', async () => {
    process.env.NEXUS_CACHED = 'value';

    // Get and cache the secret
    await getSecret('nexus-cached');

    // Delete env var
    delete process.env.NEXUS_CACHED;

    // hasSecret should still return true because it's cached
    expect(hasSecret('nexus-cached')).toBe(true);
  });

  it('should return false for empty string env vars', () => {
    process.env.NEXUS_EMPTY_CHECK = '';

    // Empty strings should not count as valid secrets
    expect(hasSecret('nexus-empty-check')).toBe(false);
  });
});

describe('clearSecretCache', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearSecretCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should clear all cached secrets', async () => {
    process.env.NEXUS_A = 'a';
    process.env.NEXUS_B = 'b';

    await getSecret('nexus-a');
    await getSecret('nexus-b');

    expect(getSecretCacheSize()).toBe(2);

    clearSecretCache();

    expect(getSecretCacheSize()).toBe(0);
    expect(isSecretCached('nexus-a')).toBe(false);
    expect(isSecretCached('nexus-b')).toBe(false);
  });
});

describe('isSecretCached', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearSecretCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return false for uncached secret', () => {
    expect(isSecretCached('nexus-uncached')).toBe(false);
  });

  it('should return true after secret is retrieved', async () => {
    process.env.NEXUS_TO_CACHE = 'value';

    expect(isSecretCached('nexus-to-cache')).toBe(false);

    await getSecret('nexus-to-cache');

    expect(isSecretCached('nexus-to-cache')).toBe(true);
  });
});

// Mock for Secret Manager SDK
const mockAccessSecretVersion = vi.fn();

vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn().mockImplementation(() => ({
    accessSecretVersion: mockAccessSecretVersion,
  })),
}));

describe('getSecret - Secret Manager integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearSecretCache();
    vi.clearAllMocks();
    // Silence debug logs in tests
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should retrieve secret from Secret Manager when env var not set', async () => {
    // Setup: no env var, but project ID is set
    delete process.env.NEXUS_SM_TEST;
    process.env.NEXUS_PROJECT_ID = 'test-project';

    // Mock Secret Manager response
    mockAccessSecretVersion.mockResolvedValue([
      {
        payload: {
          data: Buffer.from('secret-manager-value'),
        },
      },
    ]);

    const value = await getSecret('nexus-sm-test');

    expect(value).toBe('secret-manager-value');
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/test-project/secrets/nexus-sm-test/versions/latest',
    });
  });

  it('should handle string payload from Secret Manager', async () => {
    delete process.env.NEXUS_STRING_PAYLOAD;
    process.env.NEXUS_PROJECT_ID = 'test-project';

    mockAccessSecretVersion.mockResolvedValue([
      {
        payload: {
          data: 'string-secret-value', // String instead of Buffer
        },
      },
    ]);

    const value = await getSecret('nexus-string-payload');

    expect(value).toBe('string-secret-value');
  });

  it('should cache Secret Manager values', async () => {
    delete process.env.NEXUS_SM_CACHE;
    process.env.NEXUS_PROJECT_ID = 'test-project';

    mockAccessSecretVersion.mockResolvedValue([
      {
        payload: {
          data: Buffer.from('cached-sm-value'),
        },
      },
    ]);

    // First call - should hit Secret Manager
    await getSecret('nexus-sm-cache');
    expect(mockAccessSecretVersion).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const value2 = await getSecret('nexus-sm-cache');
    expect(value2).toBe('cached-sm-value');
    expect(mockAccessSecretVersion).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should throw NEXUS_SECRET_EMPTY when payload is empty', async () => {
    delete process.env.NEXUS_EMPTY_PAYLOAD;
    process.env.NEXUS_PROJECT_ID = 'test-project';

    mockAccessSecretVersion.mockResolvedValue([
      {
        payload: {
          data: null, // Empty payload
        },
      },
    ]);

    try {
      await getSecret('nexus-empty-payload');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NexusError);
      expect((error as NexusError).code).toBe('NEXUS_SECRET_EMPTY');
    }
  });

  it('should throw NEXUS_SECRET_MANAGER_ERROR when SDK fails', async () => {
    delete process.env.NEXUS_SDK_ERROR;
    process.env.NEXUS_PROJECT_ID = 'test-project';

    mockAccessSecretVersion.mockRejectedValue(
      new Error('Permission denied: Secret not found')
    );

    try {
      await getSecret('nexus-sdk-error');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NexusError);
      expect((error as NexusError).code).toBe('NEXUS_SECRET_MANAGER_ERROR');
      expect((error as NexusError).message).toContain('Permission denied');
    }
  });

  it('should prefer env var over Secret Manager', async () => {
    process.env.NEXUS_PREFER_ENV = 'env-var-value';
    process.env.NEXUS_PROJECT_ID = 'test-project';

    const value = await getSecret('nexus-prefer-env');

    expect(value).toBe('env-var-value');
    expect(mockAccessSecretVersion).not.toHaveBeenCalled();
  });
});
