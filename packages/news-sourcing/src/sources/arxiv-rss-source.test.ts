import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ArxivRSSSource } from './arxiv-rss-source';

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', async () => {
  return {
    withRetry: vi.fn().mockImplementation((fn) => fn()),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
    })),
    NexusError: {
        retryable: vi.fn(),
        fallback: vi.fn(),
    },
    getSecret: vi.fn(),
  };
});

describe('ArxivRSSSource', () => {
  let source: ArxivRSSSource;

  beforeEach(() => {
    source = new ArxivRSSSource();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and authority weight', () => {
    expect(source.name).toBe('arxiv-rss');
    expect(source.authorityWeight).toBe(0.95);
  });

  describe('fetch', () => {
    it('should fetch from both arXiv RSS feeds', async () => {
        const mockResponse = {
            ok: true,
            text: async () => '<rss><channel><item><title>Test Paper</title></item></channel></rss>'
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        await source.fetch('test-pipeline');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('cs.AI'));
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('cs.LG'));
    });

    it('should parse and return news items from XML', async () => {
        const mockXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <item>
            <title>Test Paper (arXiv:1234.5678)</title>
            <link>http://arxiv.org/abs/1234.5678</link>
            <description>Abstract of the paper.</description>
            <dc:creator>Author One, Author Two</dc:creator>
            <dc:date>${new Date().toISOString()}</dc:date>
          </item>
        </rdf:RDF>
        `;
        const mockResponse = {
            ok: true,
            text: async () => mockXml
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        const items = await source.fetch('test-pipeline');

        expect(items.length).toBeGreaterThan(0);
        expect(items[0].title).toBe('Test Paper');
        expect(items[0].source).toBe('arxiv-rss');
    });

    it('should deduplicate items and boost score for cross-listed papers', async () => {
        const mockXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <item>
            <title>Cross Listed Paper</title>
            <link>http://arxiv.org/abs/cross.listed</link>
            <description>Abstract</description>
            <dc:creator>Author</dc:creator>
            <dc:date>${new Date().toISOString()}</dc:date>
          </item>
        </rdf:RDF>
        `;
        const mockResponse = {
            ok: true,
            text: async () => mockXml
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        const items = await source.fetch('test-pipeline');

        expect(items.length).toBe(1);
        expect(items[0].viralityScore).toBe(0.7); // 0.5 + 0.2
    });

    it('should handle malformed XML gracefully', async () => {
        const mockResponse = {
            ok: true,
            text: async () => '<<invalid xml>>'
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        const items = await source.fetch('test-pipeline');

        expect(items.length).toBe(0);
    });
  });
});