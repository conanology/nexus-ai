import { NewsItem, NewsSource } from '../types.js';
import { withRetry, logger, CostTracker } from '@nexus-ai/core';
import { XMLParser } from 'fast-xml-parser';

interface ArxivRSSItem {
  title?: string;
  link?: string;
  description?: string;
  'dc:date'?: string;
  'dc:creator'?: string | string[];
  'dc:subject'?: string | string[];
}

export class ArxivRSSSource implements NewsSource {
  readonly name = 'arxiv-rss';
  readonly authorityWeight = 0.95;
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  async fetch(pipelineId: string): Promise<NewsItem[]> {
    const tracker = new CostTracker(pipelineId, 'arxiv-rss');
    logger.info({ pipelineId, source: this.name }, 'Fetching papers from arXiv RSS feeds');

    const feeds = [
      'http://export.arxiv.org/rss/cs.AI',
      'http://export.arxiv.org/rss/cs.LG'
    ];

    const results = await Promise.allSettled(
      feeds.map(url => this.fetchFeed(url, pipelineId))
    );

    const allItems: NewsItem[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }
    
    // Record API call (0 cost for RSS)
    tracker.recordApiCall('arxiv-rss', {}, 0);

    // Deduplicate by URL (arXiv ID) and Score
    const uniqueItems = new Map<string, NewsItem>();
    
    for (const item of allItems) {
        if (!uniqueItems.has(item.url)) {
            uniqueItems.set(item.url, item);
        } else {
             // Cross-listing Bonus: +0.2 if present in both feeds
             const existing = uniqueItems.get(item.url)!;
             // Use precision-safe addition
             existing.viralityScore = Math.round((existing.viralityScore + 0.2) * 100) / 100;
        }
    }

    // Sort by score (desc) and Limit to 15
    const finalItems = Array.from(uniqueItems.values())
        .sort((a, b) => b.viralityScore - a.viralityScore)
        .slice(0, 15);

    return finalItems;
  }

  private async fetchFeed(url: string, pipelineId: string): Promise<NewsItem[]> {
    try {
      const { result } = await withRetry(async () => {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        
        if (!response.ok) {
           throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        const xml = await response.text();
        
        try {
            const parsed = this.parser.parse(xml);
            // arXiv RSS structure: <rdf:RDF> <item> ... </item> </rdf:RDF>
            const items = parsed?.['rdf:RDF']?.item;
            
            if (!items) return [];

            const itemsArray = Array.isArray(items) ? items : [items];
            
            return itemsArray
                .map((item: ArxivRSSItem) => this.mapToNewsItem(item))
                .filter((item: NewsItem | null): item is NewsItem => item !== null);

        } catch (parseError) {
            logger.error({ pipelineId, source: this.name, url, error: parseError }, 'Failed to parse XML');
            return [];
        }
      }, {
        maxRetries: 3,
        stage: 'news-sourcing'
      });

      return result;
    } catch (error) {
      logger.error({ pipelineId, source: this.name, url, error }, 'Failed to fetch RSS feed');
      return [];
    }
  }

  private mapToNewsItem(raw: ArxivRSSItem): NewsItem | null {
      // Filter by date (< 24 hours)
      // arXiv uses dc:date in ISO format
      const dateStr = raw['dc:date'];
      if (!dateStr) return null;

      const pubDate = new Date(dateStr);
      const now = new Date();
      // Allow some clock drift or slight variation, but generally 24h
      const ageHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);

      // Note: Test mock uses current date, so ageHours is 0.
      if (ageHours > 24) return null;

      // Clean title: remove " (arXiv:xxxx.xxxx [cat.sub])"
      let title = raw.title || '';
      title = title.replace(/\s*\(arXiv:.*?\)/, '');

      // Abstract is in description
      // Sometimes description has HTML? arXiv usually plain text with some newlines.
      let abstract = raw.description || '';
      abstract = abstract.replace(/<[^>]*>/g, '').trim(); // Basic strip HTML

      // Authors
      // dc:creator can be string or array (if multiple tags)
      let authors: string[] = [];
      const creators = raw['dc:creator'];
      if (Array.isArray(creators)) {
          authors = creators.map(String);
      } else if (typeof creators === 'string') {
          authors = [creators];
      }

      // Categories
      // dc:subject usually contains the categories
      let categories: string[] = [];
      const subjects = raw['dc:subject'];
      if (Array.isArray(subjects)) {
          categories = subjects.map(String);
      } else if (typeof subjects === 'string') {
          categories = [subjects];
      }

      const link = raw.link;

      return {
          title,
          url: link || '',
          source: this.name,
          publishedAt: pubDate.toISOString(),
          viralityScore: 0.5, // Base Score
          metadata: {
              abstract,
              authors,
              categories
          }
      };
  }
}
