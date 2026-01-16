import { NewsItem, NewsSource } from '../types';
import { getSecret, withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

export class GitHubTrendingSource implements NewsSource {
  readonly name = 'github-trending';
  readonly authorityWeight = 0.8;

  async fetch(pipelineId: string): Promise<NewsItem[]> {
    const tracker = new CostTracker(pipelineId, 'github-source');

    logger.info({
      pipelineId,
      source: this.name
    }, 'Fetching trending repos');

    try {
      const token = await getSecret('nexus-github-token');
      
      const languages = ['python', 'typescript', 'rust'];
      const topics = ['machine-learning', 'artificial-intelligence', 'llm', 'deep-learning'];

      const languageQuery = languages.map(l => `language:${l}`).join(' OR ');
      const topicQuery = topics.map(t => `topic:${t}`).join(' OR ');

      // Combine with AND: (langs) AND (topics) AND created...
      const query = `(${languageQuery}) (${topicQuery}) created:>${this.get24HoursAgoISO()}`;

      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.append('q', query);
      url.searchParams.append('sort', 'stars');
      url.searchParams.append('order', 'desc');
      url.searchParams.append('per_page', '10');

      const { result } = await withRetry(async () => {
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        tracker.recordApiCall('github', {}, 0);

        if (!response.ok) {
           // 403 can be rate limit or forbidden. 429 is always rate limit.
           // GitHub uses X-RateLimit-Remaining header, but checking status is a reasonable proxy for now.
           if (response.status === 403 || response.status === 429) {
             throw NexusError.retryable(
               'NEXUS_GITHUB_RATE_LIMIT',
               `GitHub API rate limit exceeded: ${response.status} ${response.statusText}`,
               'news-sourcing'
             );
           }
           throw NexusError.fallback(
             'NEXUS_GITHUB_API_ERROR',
             `GitHub API failed: ${response.status} ${response.statusText}`,
             'news-sourcing'
           );
        }

        const data = await response.json() as any;
        
        return (data.items || [])
          .slice(0, 10)
          .map((repo: any) => this.mapToNewsItem(repo));
      }, {
        maxRetries: 3,
        stage: 'news-sourcing'
      });

      return result;

    } catch (error) {
      logger.error(
        {
          pipelineId,
          source: this.name,
          error
        },
        'Failed to fetch trending repos'
      );
      throw error;
    }
  }

  private get24HoursAgoISO(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  private mapToNewsItem(repo: any): NewsItem {
    const stars = repo.stargazers_count || 0;
    // Since we filter by created: >24h, all stars are effectively "today's stars"
    // for these new repositories.
    const todayStars = stars; 
    const viralityScore = stars + (todayStars * 2);

    return {
      title: repo.full_name,
      url: repo.html_url,
      source: 'github-trending',
      publishedAt: repo.created_at,
      viralityScore,
      metadata: {
        stars,
        language: repo.language,
        topics: repo.topics,
        description: repo.description
      }
    };
  }
}
