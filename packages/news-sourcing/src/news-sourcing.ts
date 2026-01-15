import { 
  StageInput, 
  StageOutput, 
  StageConfig,
  executeStage,
  logger
} from '@nexus-ai/core';
import { 
  NewsItem, 
  NewsSourcingConfig, 
  NewsSourcingData,
  NewsSource 
} from './types.js';
import { calculateFreshnessScore } from './scoring.js';
import { MockSource } from './sources/mock-source.js';

/**
 * Main execution logic for the News Sourcing stage
 */
async function newsSourcingLogic(
  data: NewsSourcingConfig,
  _config: StageConfig
): Promise<NewsSourcingData> {
  const { enabledSources, minViralityScore = 0 } = data;
  const items: NewsItem[] = [];
  const sourceCounts: Record<string, number> = {};

  // Initialize sources (in a real scenario, this would use a registry)
  const sources: NewsSource[] = enabledSources.map(name => new MockSource(name));

  for (const source of sources) {
    try {
      logger.info({ source: source.name }, 'Fetching news from source');
      const fetchedItems = await source.fetch();
      
      const filteredItems = fetchedItems.filter(item => {
        const score = calculateFreshnessScore(item, source.authorityWeight);
        return score >= minViralityScore;
      });

      items.push(...filteredItems);
      sourceCounts[source.name] = filteredItems.length;
    } catch (error) {
      logger.error({ source: source.name, error }, 'Failed to fetch from source');
      // Continue with other sources
    }
  }

  // Sort by freshness score descending
  items.sort((a, b) => {
    // We need to find the source weight again or store it in the item for sorting
    // For now, we'll re-calculate or assume default if not easily accessible
    return calculateFreshnessScore(b) - calculateFreshnessScore(a);
  });

  return {
    items,
    sourceCounts
  };
}

/**
 * Stage wrapper for news sourcing
 */
export async function executeNewsSourcing(
  input: StageInput<NewsSourcingConfig>
): Promise<StageOutput<NewsSourcingData>> {
  return executeStage<NewsSourcingConfig, NewsSourcingData>(
    input,
    'news-sourcing',
    newsSourcingLogic
  );
}
