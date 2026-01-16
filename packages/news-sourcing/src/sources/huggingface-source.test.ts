import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HuggingFacePapersSource } from './huggingface-source.js';
import { NewsSource } from '../types.js';
import { withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

// Mock dependencies
vi.mock('@nexus-ai/core', () => {
  class MockNexusError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NexusError';
    }
    static retryable = vi.fn((code, msg) => new Error(`RETRYABLE: ${code} - ${msg}`));
    static critical = vi.fn((code, msg) => new Error(`CRITICAL: ${code} - ${msg}`));
  }

  return {
    withRetry: vi.fn((fn) => fn()),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    CostTracker: vi.fn(() => ({
      recordApiCall: vi.fn(),
    })),
    NexusError: MockNexusError
  };
});

describe('HuggingFacePapersSource', () => {
  let source: HuggingFacePapersSource;

  beforeEach(() => {
    source = new HuggingFacePapersSource();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00Z')); // Set current time for freshness tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should implement NewsSource interface', () => {
    const s = source as unknown as NewsSource;
    expect(s.name).toBe('huggingface-papers');
    expect(s.authorityWeight).toBe(0.9);
  });

  it('should fetch papers and map correctly', async () => {
    const mockPapers = [
      {
        paper: {
          id: '2601.12345',
          title: 'Recent Paper',
          summary: 'This is a summary',
          authors: [{ name: 'Alice' }, { name: 'Bob' }],
          publishedAt: '2026-01-16T10:00:00Z', // 2 hours ago
          upvotes: 50,
          numComments: 5 
        }
      },
      {
        paper: {
          id: '2601.67890',
          title: 'Older Paper',
          summary: 'Old summary',
          authors: [],
          publishedAt: '2026-01-15T12:00:00Z', 
          upvotes: 10
        }
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPapers,
    } as Response);

    const items = await source.fetch();

    expect(items).toHaveLength(2);
    
    // Check first item mapping
    const item = items[0];
    expect(item.title).toBe('Recent Paper');
    expect(item.url).toBe('https://huggingface.co/papers/2601.12345');
    expect(item.source).toBe('huggingface-papers');
    expect(item.publishedAt).toBe('2026-01-16T10:00:00Z');
    
    // Virality: 50 + (5 * 2) = 60
    expect(item.viralityScore).toBe(60);

    // Metadata
    expect(item.metadata).toEqual({
      abstract: 'This is a summary',
      authors: ['Alice', 'Bob'],
      arxivUrl: 'https://arxiv.org/abs/2601.12345'
    });
    
    // Check cost tracking
    expect(CostTracker).toHaveBeenCalled();
  });

  it('should filter out papers older than 48 hours', async () => {
     const mockPapers = [
      {
        paper: {
          id: '1',
          title: 'Fresh Paper',
          publishedAt: '2026-01-15T13:00:00Z', // < 24h
          upvotes: 10,
          authors: []
        }
      },
      {
        paper: {
          id: '2',
          title: 'Old Paper',
          publishedAt: '2026-01-14T11:00:00Z', // > 48h
          upvotes: 10,
          authors: []
        }
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPapers,
    } as Response);

    const items = await source.fetch();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Fresh Paper');
  });

  it('should limit to 10 items', async () => {
    const mockPaper = {
        paper: {
          id: '1',
          title: 'Paper',
          publishedAt: '2026-01-16T10:00:00Z',
          upvotes: 10,
          authors: []
        }
    };
    const mockPapers = Array(15).fill(mockPaper);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPapers,
    } as Response);

    const items = await source.fetch();
    expect(items).toHaveLength(10);
  });

  it('should handle API errors retryably', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    } as Response);

    await expect(source.fetch()).rejects.toThrow('RETRYABLE: NEXUS_HF_API_ERROR');
  });

  it('should handle Network errors retryably', async () => {
     vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error'));
     await expect(source.fetch()).rejects.toThrow('RETRYABLE: NEXUS_HF_API_ERROR');
  });

  it('should handle Parse errors critically', async () => {
     vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('Invalid JSON') }
    } as Response);

    await expect(source.fetch()).rejects.toThrow('CRITICAL: NEXUS_HF_PARSE_ERROR');
  });

  it('should handle 404 errors gracefully and return empty array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response);

    const items = await source.fetch();
    expect(items).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('HuggingFace Daily Papers endpoint not found', { status: 404 });
  });

  it('should handle 500 server errors retryably', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    await expect(source.fetch()).rejects.toThrow('RETRYABLE: NEXUS_HF_API_ERROR');
  });

  it('should handle papers without arXiv IDs correctly', async () => {
    const mockPapers = [
      {
        paper: {
          id: 'non-arxiv-paper-id',
          title: 'Non-ArXiv Paper',
          summary: 'Summary',
          authors: [],
          publishedAt: '2026-01-16T10:00:00Z',
          upvotes: 10
        }
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPapers,
    } as Response);

    const items = await source.fetch();
    expect(items[0].metadata.arxivUrl).toBeUndefined();
  });

  it('should handle papers with missing summary field', async () => {
    const mockPapers = [
      {
        paper: {
          id: '2601.12345',
          title: 'Paper Without Summary',
          authors: [],
          publishedAt: '2026-01-16T10:00:00Z',
          upvotes: 10
          // summary field intentionally omitted
        }
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPapers,
    } as Response);

    const items = await source.fetch();
    expect(items[0].metadata.abstract).toBe('');
  });
});