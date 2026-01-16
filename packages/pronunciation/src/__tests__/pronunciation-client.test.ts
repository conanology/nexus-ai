/**
 * Tests for PronunciationClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NexusError } from '@nexus-ai/core/errors';

// Mock data
const mockMixtralEntry = {
  term: 'mixtral',
  ipa: 'mɪkˈstrɑːl',
  ssml: '<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">mixtral</phoneme>',
  verified: true,
  source: 'seed',
  usageCount: 5,
  lastUsed: '2026-01-15T10:00:00Z',
  addedDate: '2026-01-01T00:00:00Z',
};

const mockClaudeEntry = {
  term: 'claude',
  ipa: 'klɔːd',
  ssml: '<phoneme alphabet="ipa" ph="klɔːd">claude</phoneme>',
  verified: true,
  source: 'seed',
  usageCount: 10,
  lastUsed: '2026-01-16T12:00:00Z',
  addedDate: '2026-01-01T00:00:00Z',
};

// Mock the FirestoreClient
const mockQueryDocuments = vi.fn();
const mockSetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('@nexus-ai/core/storage', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    queryDocuments: mockQueryDocuments,
    setDocument: mockSetDocument,
    updateDocument: mockUpdateDocument,
    getDocument: mockGetDocument,
  })),
}));

describe('PronunciationClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXUS_PROJECT_ID = 'test-project';
    vi.clearAllMocks();
    mockQueryDocuments.mockResolvedValue([
      { ...mockMixtralEntry },
      { ...mockClaudeEntry }
    ]);
    mockSetDocument.mockResolvedValue(undefined);
    mockUpdateDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDictionary', () => {
    it('should load all terms from Firestore', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      const dictionary = await client.getDictionary();

      expect(dictionary.size).toBe(2);
      expect(dictionary.has('mixtral')).toBe(true);
      expect(dictionary.has('claude')).toBe(true);
      expect(mockQueryDocuments).toHaveBeenCalledWith('pronunciation', []);
    });

    it('should return cached dictionary on subsequent calls', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      // First call
      await client.getDictionary();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.getDictionary();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);
    });

    it('should handle empty dictionary', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      const dictionary = await client.getDictionary();

      expect(dictionary.size).toBe(0);
    });

    it('should wrap Firestore errors in NexusError', async () => {
      mockQueryDocuments.mockRejectedValue(new Error('Firestore query failed'));

      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      try {
        await client.getDictionary();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('lookupTerm', () => {
    it('should find term in dictionary (case-insensitive)', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      const entry = await client.lookupTerm('Mixtral'); // Capital M

      expect(entry).toBeDefined();
      expect(entry?.term).toBe('mixtral');
    });

    it('should return null for non-existent term', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      const entry = await client.lookupTerm('unknown-model');

      expect(entry).toBeNull();
    });

    it('should update usage tracking asynchronously', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      await client.lookupTerm('mixtral');

      // Usage tracking happens async, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'pronunciation',
        'mixtral',
        expect.objectContaining({
          usageCount: 6,
          lastUsed: expect.any(String),
        })
      );
    });
  });

  describe('addTerm', () => {
    it('should add new term to Firestore', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      await client.addTerm({
        term: 'anthropic',
        ipa: 'ænθrəˈpɪk',
      });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'pronunciation',
        'anthropic',
        expect.objectContaining({
          term: 'anthropic',
          ipa: 'ænθrəˈpɪk',
          ssml: '<phoneme alphabet="ipa" ph="ænθrəˈpɪk">anthropic</phoneme>',
        })
      );
    });

    it('should escape XML characters in SSML', async () => {
      const { PronunciationClient } = await import('../pronunciation-client.js');
      const client = new PronunciationClient('test-project');

      await client.addTerm({
        term: 'R&D',
        ipa: 'ɑːr ænd diː',
      });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'pronunciation',
        'r&d',
        expect.objectContaining({
          ssml: '<phoneme alphabet="ipa" ph="ɑːr ænd diː">R&amp;D</phoneme>',
        })
      );
    });
  });
});