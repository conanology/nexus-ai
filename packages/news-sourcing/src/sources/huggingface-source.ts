import { NewsSource, NewsItem } from '../types.js';
import { withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

interface HFAuthor {
  name: string;
}

interface HFPaper {
  id: string;
  title: string;
  summary?: string;
  authors: HFAuthor[];
  publishedAt: string;
  upvotes: number;
  numComments?: number;
}

interface HFResponseItem {
  paper: HFPaper;
}

export class HuggingFacePapersSource implements NewsSource {
  name = 'huggingface-papers';
  authorityWeight = 0.9;
  private readonly endpoint = 'https://huggingface.co/api/daily_papers';

  async fetch(pipelineId: string): Promise<NewsItem[]> {
    const tracker = new CostTracker(pipelineId, 'news-sourcing');

    logger.info({ source: this.name }, 'Fetching from HuggingFace Daily Papers');

    try {
      const { result: response } = await withRetry(
        async () => {
          try {
            const res = await fetch(this.endpoint);
            
            if (!res.ok) {
              if (res.status === 429 || res.status >= 500) {
                 throw NexusError.retryable(
                  'NEXUS_HF_API_ERROR',
                  `HuggingFace API error: ${res.status} ${res.statusText}`,
                  'news-sourcing'
                 );
              }
              // 404 or other 4xx - treat as empty/skip or warning, but usually critical if API endpoint is wrong.
              // Story says "404 Not Found: Log warning, return empty array".
              if (res.status === 404) {
                 logger.warn({ status: 404 }, 'HuggingFace Daily Papers endpoint not found');
                 return [];
              }
               // Other errors
               throw NexusError.retryable( // Default to retryable for network flakes unless strictly 4xx client error
                  'NEXUS_HF_API_ERROR', 
                  `HuggingFace API returned ${res.status}`,
                  'news-sourcing'
               );
            }
            
            // Track "cost" - 0 cost, 1 call
            tracker.recordApiCall('huggingface-api', {}, 0);

            const data = await res.json().catch(err => {
                throw NexusError.critical(
                    'NEXUS_HF_PARSE_ERROR',
                    `Failed to parse HuggingFace response: ${err.message}`,
                    'news-sourcing'
                );
            });
            
            // Check if data is array
            if (!Array.isArray(data)) {
                 throw NexusError.critical(
                    'NEXUS_HF_PARSE_ERROR',
                    'HuggingFace response is not an array',
                    'news-sourcing'
                );
            }

            return data as HFResponseItem[];

          } catch (error) {
             if (error instanceof NexusError) throw error;
             // Network errors usually
             throw NexusError.retryable(
                 'NEXUS_HF_API_ERROR',
                 `Network error fetching HuggingFace papers: ${(error as Error).message}`,
                 'news-sourcing'
             );
          }
        },
        { maxRetries: 3, stage: 'news-sourcing' }
      );

      // Handle 404 case where we returned empty array inside withRetry
      if (Array.isArray(response) && response.length === 0) return [];

      const items = (response as HFResponseItem[])
        .map(item => this.mapToNewsItem(item.paper))
        .filter(item => this.isFresh(item.publishedAt))
        .sort((a, b) => b.viralityScore - a.viralityScore) // Optional: sort by score? Not strictly required but good.
        .slice(0, 10);

      logger.info({ 
          count: items.length, 
          source: this.name 
      }, 'Fetched HuggingFace papers');

      return items;

    } catch (error) {
       // Log and rethrow
       logger.error({ error }, 'Failed to fetch from HuggingFace');
       throw error;
    }
  }

  private mapToNewsItem(paper: HFPaper): NewsItem {
    // Ensure virality score is non-negative
    const viralityScore = Math.max(0, paper.upvotes + ((paper.numComments || 0) * 2));

    // Construct URLs
    const url = `https://huggingface.co/papers/${paper.id}`;

    // Infer arXiv URL if ID matches arXiv format (YYMM.NNNNN or YYMM.NNNNNN)
    // More strict pattern to avoid false positives
    const arxivUrl = /^\d{4}\.\d{4,6}$/.test(paper.id)
        ? `https://arxiv.org/abs/${paper.id}`
        : undefined;

    return {
      title: paper.title,
      url: url,
      source: this.name,
      publishedAt: paper.publishedAt,
      viralityScore: viralityScore,
      metadata: {
        abstract: paper.summary || '',
        authors: (paper.authors || []).map(a => a.name),
        arxivUrl: arxivUrl
      }
    };
  }

  private isFresh(publishedAt: string): boolean {
    const pubDate = new Date(publishedAt).getTime();

    // Validate that the date is valid
    if (isNaN(pubDate)) {
      logger.warn({ publishedAt }, 'Invalid publishedAt date');
      return false;
    }

    const now = Date.now();
    const diffHours = (now - pubDate) / (1000 * 60 * 60);
    // Story says "Filters papers to ensure they are from the last 24-48 hours"
    // Task says "Filter items older than 48 hours"
    return diffHours <= 48 && diffHours >= 0;
  }
}
