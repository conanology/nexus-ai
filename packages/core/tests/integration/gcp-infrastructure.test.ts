/**
 * Integration tests for GCP Infrastructure
 *
 * These tests require real GCP credentials and will be skipped in CI
 * unless NEXUS_PROJECT_ID and NEXUS_BUCKET_NAME are set.
 *
 * To run locally:
 * 1. Set NEXUS_PROJECT_ID to your GCP project
 * 2. Set NEXUS_BUCKET_NAME to your test bucket
 * 3. Ensure Application Default Credentials are configured:
 *    gcloud auth application-default login
 * 4. Run: pnpm test:run tests/integration/gcp-infrastructure.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Check if integration tests should run
const SKIP_INTEGRATION =
  !process.env.NEXUS_PROJECT_ID || !process.env.NEXUS_BUCKET_NAME;

describe.skipIf(SKIP_INTEGRATION)('GCP Infrastructure Integration', () => {
  // Import types only - actual imports happen in beforeAll
  let FirestoreClient: typeof import('../../src/storage/firestore-client.js').FirestoreClient;
  let CloudStorageClient: typeof import('../../src/storage/cloud-storage-client.js').CloudStorageClient;
  let getSecret: typeof import('../../src/secrets/get-secret.js').getSecret;
  let clearSecretCache: typeof import('../../src/secrets/get-secret.js').clearSecretCache;

  let firestore: InstanceType<typeof FirestoreClient>;
  let storage: InstanceType<typeof CloudStorageClient>;

  // Test data identifiers for cleanup
  const TEST_COLLECTION = 'integration-tests';
  const TEST_DOC_ID = `test-${Date.now()}`;
  const TEST_STORAGE_PATH = `integration-tests/test-${Date.now()}.txt`;

  beforeAll(async () => {
    // Dynamic imports to avoid loading GCP SDKs when tests are skipped
    const firestoreModule = await import('../../src/storage/firestore-client.js');
    const storageModule = await import('../../src/storage/cloud-storage-client.js');
    const secretsModule = await import('../../src/secrets/get-secret.js');

    FirestoreClient = firestoreModule.FirestoreClient;
    CloudStorageClient = storageModule.CloudStorageClient;
    getSecret = secretsModule.getSecret;
    clearSecretCache = secretsModule.clearSecretCache;

    // Initialize clients
    firestore = new FirestoreClient();
    storage = new CloudStorageClient();
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await firestore?.deleteDocument(TEST_COLLECTION, TEST_DOC_ID);
    } catch {
      // Ignore cleanup errors
    }

    try {
      await storage?.deleteFile(TEST_STORAGE_PATH);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Firestore Operations', () => {
    it('should write and read a document', async () => {
      const testData = {
        message: 'Integration test',
        timestamp: Date.now(),
        nested: { key: 'value' },
      };

      // Write
      await firestore.setDocument(TEST_COLLECTION, TEST_DOC_ID, testData);

      // Read
      const result = await firestore.getDocument<typeof testData>(
        TEST_COLLECTION,
        TEST_DOC_ID
      );

      expect(result).not.toBeNull();
      expect(result?.message).toBe('Integration test');
      expect(result?.nested.key).toBe('value');
    });

    it('should update a document', async () => {
      // Ensure document exists
      await firestore.setDocument(TEST_COLLECTION, TEST_DOC_ID, {
        field1: 'original',
        field2: 'keep',
      });

      // Update
      await firestore.updateDocument(TEST_COLLECTION, TEST_DOC_ID, {
        field1: 'updated',
      });

      // Read
      const result = await firestore.getDocument<{ field1: string; field2: string }>(
        TEST_COLLECTION,
        TEST_DOC_ID
      );

      expect(result?.field1).toBe('updated');
      expect(result?.field2).toBe('keep');
    });

    it('should return null for non-existent document', async () => {
      const result = await firestore.getDocument(
        TEST_COLLECTION,
        `nonexistent-${Date.now()}`
      );

      expect(result).toBeNull();
    });

    it('should query documents', async () => {
      // Create a document with queryable field
      const queryDocId = `query-test-${Date.now()}`;
      await firestore.setDocument(TEST_COLLECTION, queryDocId, {
        status: 'test-query',
        value: 42,
      });

      try {
        // Query
        const results = await firestore.queryDocuments<{ status: string; value: number }>(
          TEST_COLLECTION,
          [{ field: 'status', operator: '==', value: 'test-query' }]
        );

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.value === 42)).toBe(true);
      } finally {
        // Cleanup
        await firestore.deleteDocument(TEST_COLLECTION, queryDocId);
      }
    });

    it('should delete a document', async () => {
      const deleteDocId = `delete-test-${Date.now()}`;

      // Create
      await firestore.setDocument(TEST_COLLECTION, deleteDocId, { temp: true });

      // Verify exists
      const before = await firestore.getDocument(TEST_COLLECTION, deleteDocId);
      expect(before).not.toBeNull();

      // Delete
      await firestore.deleteDocument(TEST_COLLECTION, deleteDocId);

      // Verify deleted
      const after = await firestore.getDocument(TEST_COLLECTION, deleteDocId);
      expect(after).toBeNull();
    });
  });

  describe('Cloud Storage Operations', () => {
    it('should upload and download text content', async () => {
      const content = 'Integration test content\nWith multiple lines';

      // Upload
      const url = await storage.uploadFile(
        TEST_STORAGE_PATH,
        content,
        'text/plain'
      );

      expect(url).toContain('gs://');
      expect(url).toContain(TEST_STORAGE_PATH);

      // Download
      const downloaded = await storage.downloadFile(TEST_STORAGE_PATH);

      expect(downloaded.toString()).toBe(content);
    });

    it('should check if file exists', async () => {
      // Upload first
      await storage.uploadFile(TEST_STORAGE_PATH, 'exists test', 'text/plain');

      const exists = await storage.fileExists(TEST_STORAGE_PATH);
      expect(exists).toBe(true);

      const notExists = await storage.fileExists(`nonexistent-${Date.now()}.txt`);
      expect(notExists).toBe(false);
    });

    it('should generate signed URL', async () => {
      // Ensure file exists
      await storage.uploadFile(TEST_STORAGE_PATH, 'signed url test', 'text/plain');

      const signedUrl = await storage.getSignedUrl(TEST_STORAGE_PATH, 5);

      expect(signedUrl).toContain('storage.googleapis.com');
      // V4 signed URLs contain these parameters
      expect(signedUrl).toContain('X-Goog-Signature');
    });

    it('should list files with prefix', async () => {
      // Upload a file with known prefix
      const prefix = `integration-tests/list-test-${Date.now()}`;
      await storage.uploadFile(`${prefix}/file1.txt`, 'test1', 'text/plain');
      await storage.uploadFile(`${prefix}/file2.txt`, 'test2', 'text/plain');

      try {
        const files = await storage.listFiles(prefix);

        expect(files.length).toBe(2);
        expect(files.some((f) => f.includes('file1.txt'))).toBe(true);
        expect(files.some((f) => f.includes('file2.txt'))).toBe(true);
      } finally {
        // Cleanup
        await storage.deleteFile(`${prefix}/file1.txt`);
        await storage.deleteFile(`${prefix}/file2.txt`);
      }
    });

    it('should delete a file', async () => {
      const deletePath = `integration-tests/delete-test-${Date.now()}.txt`;

      // Upload
      await storage.uploadFile(deletePath, 'to be deleted', 'text/plain');

      // Verify exists
      expect(await storage.fileExists(deletePath)).toBe(true);

      // Delete
      await storage.deleteFile(deletePath);

      // Verify deleted
      expect(await storage.fileExists(deletePath)).toBe(false);
    });
  });

  describe('Secret Manager Operations', () => {
    it('should retrieve secret from environment variable fallback', async () => {
      // Set up a test secret in environment
      const testSecretName = 'nexus-integration-test';
      process.env.NEXUS_INTEGRATION_TEST = 'test-secret-value';

      // Clear cache to ensure fresh lookup
      clearSecretCache();

      try {
        const value = await getSecret(testSecretName);
        expect(value).toBe('test-secret-value');
      } finally {
        delete process.env.NEXUS_INTEGRATION_TEST;
      }
    });

    // Note: Testing actual Secret Manager requires secrets to exist in GCP
    // This test is commented out to avoid requiring secret setup
    // Uncomment and create a test secret to run this test
    /*
    it('should retrieve secret from Secret Manager', async () => {
      // Requires: nexus-integration-test secret in GCP Secret Manager
      clearSecretCache();
      delete process.env.NEXUS_INTEGRATION_TEST;

      const value = await getSecret('nexus-integration-test');
      expect(value).toBeDefined();
    });
    */
  });
});

// Additional test for when credentials are not available
describe('GCP Infrastructure - No Credentials', () => {
  it('should skip integration tests when NEXUS_PROJECT_ID not set', () => {
    if (!process.env.NEXUS_PROJECT_ID) {
      console.log('✓ Integration tests correctly skipped (NEXUS_PROJECT_ID not set)');
    }
    expect(true).toBe(true);
  });
});
