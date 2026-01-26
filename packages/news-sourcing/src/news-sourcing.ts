import {
  StageInput,
  StageOutput,
  StageConfig,
  executeStage,
  logger,
  FirestoreClient
} from '@nexus-ai/core';
import {
  NewsItem,
  NewsSourcingConfig,
  NewsSource,
  TopicSelectionResult
} from './types.js';
import { calculateFreshnessScore, sortNewsItems } from './scoring.js';
import { GitHubTrendingSource } from './sources/github-trending-source.js';
import { HuggingFacePapersSource } from './sources/huggingface-source.js';
import { HackerNewsSource } from './sources/hacker-news-source.js';
import { RedditSource } from './sources/reddit-source.js';
import { ArxivRSSSource } from './sources/arxiv-rss-source.js';

/**
 * Minimum number of viable candidates required for selection
 */
const MIN_VIABLE_CANDIDATES = 3;

/**
 * Age threshold in hours for deep dive topics
 */
const DEEP_DIVE_AGE_HOURS = 48;

/**
 * Maximum number of candidate topics to include in selection result
 */
const MAX_CANDIDATES = 10;

/**
 * Source registry mapping source names to implementations
 */
const SOURCE_REGISTRY: Record<string, NewsSource> = {
  'github-trending': new GitHubTrendingSource(),
  'huggingface': new HuggingFacePapersSource(),
  'hacker-news': new HackerNewsSource(),
  'reddit': new RedditSource(),
  'arxiv': new ArxivRSSSource(),
};

/**
 * Main execution logic for the News Sourcing stage
 * Orchestrates fetching, scoring, selection, and persistence
 */
/**
 * Default enabled sources when none are provided
 */
const DEFAULT_ENABLED_SOURCES = ['github-trending', 'hacker-news', 'reddit'];

async function newsSourcingLogic(
  data: NewsSourcingConfig,
  _config: StageConfig,
  pipelineId: string
): Promise<TopicSelectionResult> {
  const { enabledSources = DEFAULT_ENABLED_SOURCES, minViralityScore = 0 } = data || {};
  const items: NewsItem[] = [];
  const sourceCounts: Record<string, number> = {};

  logger.info(
    {
      pipelineId,
      stage: 'news-sourcing',
      enabledSources,
    },
    'Starting news sourcing orchestration'
  );

  // Initialize sources from registry
  const sources: NewsSource[] = enabledSources
    .map(name => SOURCE_REGISTRY[name])
    .filter(source => source !== undefined);

  if (sources.length === 0) {
    logger.warn({ pipelineId, enabledSources }, 'No valid sources configured');
  }

  // Build a map of source names to authority weights for sorting
  const sourceWeights: Record<string, number> = {};
  sources.forEach(source => {
    sourceWeights[source.name] = source.authorityWeight;
  });

  // Fetch from all sources in parallel
  const fetchPromises = sources.map(async source => {
    try {
      logger.info(
        { pipelineId, source: source.name },
        'Fetching news from source'
      );
      const fetchedItems = await source.fetch(pipelineId);

      const filteredItems = fetchedItems.filter(item => {
        const score = calculateFreshnessScore(item, source.authorityWeight);
        return score >= minViralityScore;
      });

      return { source: source.name, items: filteredItems };
    } catch (error) {
      logger.error(
        { pipelineId, source: source.name, error },
        'Failed to fetch from source'
      );
      // Return empty result instead of failing entire stage
      return { source: source.name, items: [] };
    }
  });

  const results = await Promise.all(fetchPromises);

  // Aggregate results
  results.forEach(result => {
    items.push(...result.items);
    sourceCounts[result.source] = result.items.length;
  });

  logger.info(
    {
      pipelineId,
      totalItems: items.length,
      sourceCounts,
    },
    'Fetched news items from all sources'
  );

  // Sort by freshness score descending using the sortNewsItems utility
  const getAuthorityWeight = (item: NewsItem): number => {
    return sourceWeights[item.source] || 0.5; // Default fallback
  };

  const sortedItems = sortNewsItems(items, getAuthorityWeight);

  // Select topic (AC1, AC2, AC3)
  const selectionResult = selectTopic(sortedItems, getAuthorityWeight);

  logger.info(
    {
      pipelineId,
      selected: selectionResult.selected?.title,
      fallback: selectionResult.fallback,
      candidateCount: selectionResult.candidates.length,
    },
    'Topic selection complete'
  );

  // AC4: Persist to Firestore at topics/{YYYY-MM-DD}
  try {
    const firestore = new FirestoreClient();
    await firestore.setDocument('topics', pipelineId, {
      selected: selectionResult.selected,
      candidates: selectionResult.candidates.slice(0, 10), // Top 10
      selectionTime: selectionResult.selectionTime,
      fallback: selectionResult.fallback,
      ...(selectionResult.deepDiveCandidates && { deepDiveCandidates: selectionResult.deepDiveCandidates }),
      sourceCounts,
    });

    logger.info(
      { pipelineId, path: `topics/${pipelineId}` },
      'Persisted topic selection to Firestore'
    );
  } catch (error) {
    logger.error(
      { pipelineId, error },
      'Failed to persist topic selection to Firestore'
    );
    // Don't fail the stage if persistence fails
  }

  return selectionResult;
}

/**
 * Select the best topic from a list of news items
 * 
 * Implements AC1, AC2, AC3:
 * - Selects single highest-scored item
 * - Validates ≥3 viable candidates exist (fresh items < 48h old)
 * - Triggers fallback if insufficient fresh candidates
 * 
 * @param items - List of news items (should be pre-sorted by freshness score)
 * @param getAuthorityWeight - Function to get authority weight for an item (required for score re-validation)
 * @param executionTime - Execution timestamp for freshness calculation (defaults to Date.now())
 * @returns Topic selection result with selected topic and metadata
 */
export function selectTopic(
  items: NewsItem[],
  getAuthorityWeight: (item: NewsItem) => number,
  executionTime?: number
): TopicSelectionResult {
  const now = executionTime !== undefined ? executionTime : Date.now();
  const selectionTime = new Date(now).toISOString();

  // Filter items to get viable fresh candidates (<48h old, non-zero virality, valid timestamp)
  const freshItems = items.filter(item => {
    if (item.viralityScore === 0 || !item.publishedAt || item.publishedAt === "") {
      return false;
    }

    const publishedDate = new Date(item.publishedAt);
    const ageInHours = (now - publishedDate.getTime()) / (1000 * 60 * 60);

    // Fresh items are less than 48 hours old
    return ageInHours < DEEP_DIVE_AGE_HOURS;
  });

  // AC2: Validate minimum viable candidates (≥3 fresh items)
  if (freshItems.length < MIN_VIABLE_CANDIDATES) {
    // AC3: Trigger fallback logic - identify deep dive candidates
    const deepDiveCandidates = items.filter(item => {
      if (!item.publishedAt || item.publishedAt === "" || item.viralityScore === 0) {
        return false;
      }

      const publishedDate = new Date(item.publishedAt);
      const ageInHours = (now - publishedDate.getTime()) / (1000 * 60 * 60);

      return ageInHours >= DEEP_DIVE_AGE_HOURS;
    });

    return {
      selected: null,
      topic: null,
      candidates: freshItems,
      selectionTime,
      fallback: true,
      deepDiveCandidates: deepDiveCandidates.length > 0 ? deepDiveCandidates : undefined,
    };
  }

  // Sort fresh items by freshness score (descending) to ensure correctness
  const sortedItems = sortNewsItems(freshItems, getAuthorityWeight, now);

  // AC1: Select the single highest-scored item
  const selected = sortedItems[0];

  // Get top 10 candidates
  const candidates = sortedItems.slice(0, Math.min(MAX_CANDIDATES, sortedItems.length));

  return {
    selected,
    topic: selected,
    candidates,
    selectionTime,
    fallback: false,
  };
}

/**
 * Stage wrapper for news sourcing
 * AC5: Orchestrates fetching, scoring, and selection
 * AC6: Uses executeStage wrapper with CostTracker and structured logging
 * AC7: Uses StageInput<T> and StageOutput<T> contracts
 */
export async function executeNewsSourcing(
  input: StageInput<NewsSourcingConfig>
): Promise<StageOutput<TopicSelectionResult>> {
  const logicWithContext = (data: NewsSourcingConfig, config: StageConfig) =>
    newsSourcingLogic(data, config, input.pipelineId);

  return executeStage<NewsSourcingConfig, TopicSelectionResult>(
    input,
    'news-sourcing',
    logicWithContext,
    { qualityGate: 'news-sourcing' } // AC6: Quality gate
  );
}
