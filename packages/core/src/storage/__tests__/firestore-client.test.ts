/**
 * Tests for FirestoreClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NexusError } from '../../errors/index.js';

// Mock data
const mockDoc = {
  exists: true,
  data: () => ({ stage: 'research', status: 'running' }),
  id: 'test-doc',
};

const mockEmptyDoc = {
  exists: false,
  data: () => undefined,
  id: 'missing-doc',
};

const mockQuerySnapshot = {
  empty: false,
  docs: [
    { data: () => ({ id: '1', status: 'pending' }), id: '1' },
    { data: () => ({ id: '2', status: 'pending' }), id: '2' },
  ],
};

const mockEmptyQuerySnapshot = {
  empty: true,
  docs: [],
};

// Mock functions
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockWhere = vi.fn();
const mockQueryGet = vi.fn();

// Create mock chain
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
};

const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: mockWhere,
  get: mockQueryGet,
};

mockWhere.mockReturnThis();

// Mock the Firestore SDK
vi.mock('@google-cloud/firestore', () => ({
  Firestore: vi.fn().mockImplementation(() => ({
    collection: vi.fn(() => mockCollectionRef),
  })),
}));

describe('FirestoreClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXUS_PROJECT_ID = 'test-project';
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockDoc);
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockQueryGet.mockResolvedValue(mockQuerySnapshot);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should enter local mode when no project ID available', async () => {
      delete process.env.NEXUS_PROJECT_ID;

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient();
      expect((client as any).localMode).toBe(true);
      expect((client as any).projectId).toBe('local');
    });

    it('should return no-op results in local mode', async () => {
      delete process.env.NEXUS_PROJECT_ID;

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient();
      const result = await client.getDocument('test', 'test');
      expect(result).toBeNull();
    });

    it('should accept explicit project ID', async () => {
      delete process.env.NEXUS_PROJECT_ID;

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('explicit-project');
      expect(client.name).toBe('firestore');
    });

    it('should have name property for debugging', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');
      expect(client.name).toBe('firestore');
    });
  });

  describe('getDocument', () => {
    it('should return document data when exists', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      const result = await client.getDocument<{ stage: string; status: string }>(
        'pipelines',
        '2026-01-08'
      );

      expect(result).toEqual({ stage: 'research', status: 'running' });
    });

    it('should return null for non-existent document', async () => {
      mockGet.mockResolvedValue(mockEmptyDoc);

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      const result = await client.getDocument('pipelines', 'missing');

      expect(result).toBeNull();
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockGet.mockRejectedValue(new Error('Firestore error'));

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      try {
        await client.getDocument('pipelines', 'fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('setDocument', () => {
    it('should set document successfully', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.setDocument('pipelines', '2026-01-08', {
        stage: 'tts',
        status: 'complete',
      });

      expect(mockSet).toHaveBeenCalledWith({
        stage: 'tts',
        status: 'complete',
      });
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockSet.mockRejectedValue(new Error('Set failed'));

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      try {
        await client.setDocument('pipelines', 'fail', { data: true });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('updateDocument', () => {
    it('should update document successfully using set with merge', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.updateDocument('pipelines', '2026-01-08', {
        status: 'complete',
      });

      expect(mockSet).toHaveBeenCalledWith({ status: 'complete' }, { merge: true });
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockSet.mockRejectedValue(new Error('Update failed'));

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      try {
        await client.updateDocument('pipelines', 'fail', { status: 'error' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }

      // Restore mockSet for other tests
      mockSet.mockResolvedValue(undefined);
    });
  });

  describe('queryDocuments', () => {
    it('should return matching documents', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      const results = await client.queryDocuments<{ id: string; status: string }>(
        'review-queue',
        [{ field: 'status', operator: '==', value: 'pending' }]
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: '1', status: 'pending' });
    });

    it('should return empty array when no matches', async () => {
      mockQueryGet.mockResolvedValue(mockEmptyQuerySnapshot);

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      const results = await client.queryDocuments('review-queue', [
        { field: 'status', operator: '==', value: 'nonexistent' },
      ]);

      expect(results).toEqual([]);
    });

    it('should support multiple filters', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.queryDocuments('review-queue', [
        { field: 'status', operator: '==', value: 'pending' },
        { field: 'type', operator: '==', value: 'pronunciation' },
      ]);

      expect(mockWhere).toHaveBeenCalledTimes(2);
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockQueryGet.mockRejectedValue(new Error('Query failed'));

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      try {
        await client.queryDocuments('fail', [{ field: 'status', operator: '==', value: 'test' }]);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.deleteDocument('test-collection', 'test-doc');

      expect(mockDelete).toHaveBeenCalled();
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      try {
        await client.deleteDocument('fail', 'fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('Pipeline Convenience Methods', () => {
    it('should get pipeline state using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.getPipelineState('2026-01-08');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2026-01-08_state');
    });

    it('should set pipeline state using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.setPipelineState('2026-01-08', { stage: 'research', status: 'running' });

      expect(mockSet).toHaveBeenCalledWith({ stage: 'research', status: 'running' });
    });

    it('should update pipeline state using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.updatePipelineState('2026-01-08', { status: 'complete' });

      expect(mockSet).toHaveBeenCalledWith({ status: 'complete' }, { merge: true });
    });

    it('should get pipeline artifacts using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.getPipelineArtifacts('2026-01-08');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2026-01-08_artifacts');
    });

    it('should get pipeline costs using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.getPipelineCosts('2026-01-08');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2026-01-08_costs');
    });

    it('should get pipeline quality using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.getPipelineQuality('2026-01-08');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2026-01-08_quality');
    });

    it('should get pipeline youtube using path helpers', async () => {
      const module = await import('../firestore-client.js');
      const client = new module.FirestoreClient('test-project');

      await client.getPipelineYouTube('2026-01-08');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2026-01-08_youtube');
    });
  });
});
