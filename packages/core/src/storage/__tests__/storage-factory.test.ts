import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStorageClient,
  isLocalStorageMode,
  resetStorageClient,
} from '../storage-factory.js';
import { LocalStorageClient } from '../local-storage-client.js';

describe('storage-factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetStorageClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetStorageClient();
  });

  describe('isLocalStorageMode', () => {
    it('returns true when STORAGE_MODE=local', () => {
      process.env.STORAGE_MODE = 'local';
      process.env.NEXUS_BUCKET_NAME = 'some-bucket';
      expect(isLocalStorageMode()).toBe(true);
    });

    it('returns true when NEXUS_BUCKET_NAME is unset', () => {
      delete process.env.STORAGE_MODE;
      delete process.env.NEXUS_BUCKET_NAME;
      expect(isLocalStorageMode()).toBe(true);
    });

    it('returns false when NEXUS_BUCKET_NAME is set and STORAGE_MODE is not local', () => {
      delete process.env.STORAGE_MODE;
      process.env.NEXUS_BUCKET_NAME = 'nexus-ai-artifacts';
      expect(isLocalStorageMode()).toBe(false);
    });
  });

  describe('getStorageClient', () => {
    it('returns LocalStorageClient when STORAGE_MODE=local', () => {
      process.env.STORAGE_MODE = 'local';
      delete process.env.NEXUS_BUCKET_NAME;
      const client = getStorageClient();
      expect(client).toBeInstanceOf(LocalStorageClient);
      expect(client.name).toBe('local-storage');
    });

    it('returns LocalStorageClient when NEXUS_BUCKET_NAME is unset', () => {
      delete process.env.STORAGE_MODE;
      delete process.env.NEXUS_BUCKET_NAME;
      const client = getStorageClient();
      expect(client).toBeInstanceOf(LocalStorageClient);
    });

    it('returns cached instance on subsequent calls', () => {
      process.env.STORAGE_MODE = 'local';
      delete process.env.NEXUS_BUCKET_NAME;
      const client1 = getStorageClient();
      const client2 = getStorageClient();
      expect(client1).toBe(client2);
    });

    it('returns fresh instance after resetStorageClient', () => {
      process.env.STORAGE_MODE = 'local';
      delete process.env.NEXUS_BUCKET_NAME;
      const client1 = getStorageClient();
      resetStorageClient();
      const client2 = getStorageClient();
      expect(client1).not.toBe(client2);
    });
  });
});
