import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubTrendingSource } from './github-trending-source';
import { NewsSource } from '../types';
import { getSecret, withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

// Mock dependencies
vi.mock('@nexus-ai/core', () => ({
  getSecret: vi.fn(),
  withRetry: vi.fn((fn) => fn()),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  CostTracker: vi.fn(() => ({
    recordApiCall: vi.fn(),
  })),
  NexusError: {
      retryable: vi.fn((code, msg) => new Error(`RETRYABLE: ${code} - ${msg}`)),
      fallback: vi.fn((code, msg) => new Error(`FALLBACK: ${code} - ${msg}`))
  }
}));

describe('GitHubTrendingSource', () => {
  let source: GitHubTrendingSource;

  beforeEach(() => {
    source = new GitHubTrendingSource();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should implement NewsSource interface', () => {
    const s = source as unknown as NewsSource;
    expect(s.name).toBe('github-trending');
    expect(s.authorityWeight).toBe(0.8);
    expect(typeof s.fetch).toBe('function');
  });

  it('should fetch trending repos with correct query', async () => {
    vi.mocked(getSecret).mockResolvedValue('mock-token');
    
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Headers(),
    } as Response);

    await source.fetch();

    expect(getSecret).toHaveBeenCalledWith('nexus-github-token');
    expect(CostTracker).toHaveBeenCalled();

    const expectedUrl = 'https://api.github.com/search/repositories';
    expect(mockFetch).toHaveBeenCalled();
    const call = mockFetch.mock.calls[0];
    
    const urlString = call[0] as string;
    const url = new URL(urlString);
    
    expect(url.origin + url.pathname).toBe(expectedUrl);
    const q = url.searchParams.get('q') || '';
    expect(q).toContain('language:python OR language:typescript');
    expect(q).toContain('topic:machine-learning OR topic:artificial-intelligence');
    expect(q).toContain('created:>');
    
    const options = call[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer mock-token');
  });

  it('should map response to NewsItems correctly and limit to 10', async () => {
    vi.mocked(getSecret).mockResolvedValue('token');
    const mockRepo = {
      full_name: 'owner/repo',
      html_url: 'https://github.com/owner/repo',
      created_at: '2026-01-16T12:00:00Z',
      stargazers_count: 100,
      language: 'TypeScript',
      topics: ['ai', 'ml'],
      description: 'Test repo'
    };
    // Create 15 items
    const mockItems = Array(15).fill(mockRepo);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as Response);

    const items = await source.fetch();

    expect(items).toHaveLength(10);
    const item = items[0];
    expect(item.title).toBe('owner/repo');
    expect(item.url).toBe('https://github.com/owner/repo');
    expect(item.source).toBe('github-trending');
    expect(item.viralityScore).toBe(300); // 100 + (100 * 2)
    expect(item.metadata).toEqual({
      stars: 100,
      language: 'TypeScript',
      topics: ['ai', 'ml'],
      description: 'Test repo'
    });
  });

  it('should throw retryable error on rate limit', async () => {
    vi.mocked(getSecret).mockResolvedValue('token');
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    } as Response);

    await expect(source.fetch()).rejects.toThrow('RETRYABLE: NEXUS_GITHUB_RATE_LIMIT');
  });

  it('should throw fallback error on other api errors', async () => {
    vi.mocked(getSecret).mockResolvedValue('token');
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    await expect(source.fetch()).rejects.toThrow('FALLBACK: NEXUS_GITHUB_API_ERROR');
  });
});
