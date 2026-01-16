import { NewsItem, NewsSource } from '../types.js';

/**
 * A mock news source for testing purposes
 */
export class MockSource implements NewsSource {
  constructor(
    public name: string,
    public authorityWeight: number = 0.5
  ) {}

  async fetch(_pipelineId: string): Promise<NewsItem[]> {
    return [
      {
        title: `Mock News from ${this.name} 1`,
        url: `https://example.com/${this.name}/1`,
        source: this.name,
        publishedAt: new Date().toISOString(),
        viralityScore: Math.random(),
      },
      {
        title: `Mock News from ${this.name} 2`,
        url: `https://example.com/${this.name}/2`,
        source: this.name,
        publishedAt: new Date().toISOString(),
        viralityScore: Math.random(),
      },
    ];
  }
}
