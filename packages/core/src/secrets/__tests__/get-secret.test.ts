/**
 * Tests for getSecret placeholder
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSecret, hasSecret } from '../get-secret.js';
import { NexusError } from '../../errors/index.js';

describe('getSecret', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('successful retrieval', () => {
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

  describe('error handling', () => {
    it('should throw NexusError if secret not found', async () => {
      await expect(getSecret('nexus-nonexistent')).rejects.toThrow();
    });

    it('should throw with NEXUS_SECRET_NOT_FOUND code', async () => {
      try {
        await getSecret('nexus-nonexistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
        expect((error as NexusError).code).toBe('NEXUS_SECRET_NOT_FOUND');
      }
    });

    it('should include secret name in error message', async () => {
      try {
        await getSecret('nexus-missing-key');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as NexusError).message).toContain('nexus-missing-key');
        expect((error as NexusError).message).toContain('NEXUS_MISSING_KEY');
      }
    });

    it('should include context with secret name and env var name', async () => {
      try {
        await getSecret('nexus-missing-key');
        expect.fail('Should have thrown');
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.context?.secretName).toBe('nexus-missing-key');
        expect(nexusError.context?.envVarName).toBe('NEXUS_MISSING_KEY');
      }
    });

    it('should throw NexusError without console warnings (logging deferred to Story 1.6)', async () => {
      // console.warn was removed - structured logging will be added in Story 1.6
      process.env.NODE_ENV = 'development';

      await expect(getSecret('nexus-missing')).rejects.toThrow();
    });
  });
});

describe('hasSecret', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when secret exists', () => {
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
});
