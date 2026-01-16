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
import { calculateFreshnessScore, sortNewsItems } from './scoring.js';
import { MockSource } from './sources/mock-source.js';

/**
 * Main execution logic for the News Sourcing stage
 */
async function newsSourcingLogic(
  data: NewsSourcingConfig,
  _config: StageConfig,
  pipelineId: string
): Promise<NewsSourcingData> {
  const { enabledSources, minViralityScore = 0 } = data;
  const items: NewsItem[] = [];
  const sourceCounts: Record<string, number> = {};

  // Initialize sources (in a real scenario, this would use a registry)
  const sources: NewsSource[] = enabledSources.map(name => new MockSource(name));

  // Build a map of source names to authority weights for sorting
  const sourceWeights: Record<string, number> = {};
  sources.forEach(source => {
    sourceWeights[source.name] = source.authorityWeight;
  });

  for (const source of sources) {
    try {
      logger.info({ source: source.name }, 'Fetching news from source');
      const fetchedItems = await source.fetch(pipelineId);

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

  // Sort by freshness score descending using the sortNewsItems utility
  const getAuthorityWeight = (item: NewsItem): number => {
    return sourceWeights[item.source] || 0.5; // Default fallback
  };

  const sortedItems = sortNewsItems(items, getAuthorityWeight);

  return {
    items: sortedItems,
    sourceCounts
  };
}

/**
 * Stage wrapper for news sourcing
 */
export async function executeNewsSourcing(
  input: StageInput<NewsSourcingConfig>
): Promise<StageOutput<NewsSourcingData>> {
  const logicWithContext = (data: NewsSourcingConfig, config: StageConfig) => 
    newsSourcingLogic(data, config, input.pipelineId);

  return executeStage<NewsSourcingConfig, NewsSourcingData>(
    input,
    'news-sourcing',
    logicWithContext
  );
}
