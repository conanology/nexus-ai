import { describe, it, expect, vi, beforeAll } from 'vitest';
import { executeNewsSourcing } from './news-sourcing.js';
import { StageInput } from '@nexus-ai/core';
import { NewsSourcingConfig } from './types.js';

beforeAll(() => {
  process.env.NEXUS_PROJECT_ID = 'test-project';
});

describe('executeNewsSourcing', () => {
  const mockInput: StageInput<NewsSourcingConfig> = {
    pipelineId: '2026-01-16',
    previousStage: null,
    data: {
      enabledSources: ['hacker-news', 'reddit'],
      minViralityScore: 0.1,
    },
    config: {
      timeout: 5000,
      retries: 3,
    },
  };

  it('should fetch news from enabled sources', async () => {
    const result = await executeNewsSourcing(mockInput);

    expect(result.success).toBe(true);
    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.sourceCounts['hacker-news']).toBeDefined();
    expect(result.data.sourceCounts['reddit']).toBeDefined();
    
    // Verify sorting (descending virality)
    const items = result.data.items;
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i].viralityScore).toBeGreaterThanOrEqual(items[i+1].viralityScore);
    }
  });

  it('should filter items by minViralityScore', async () => {
    const highViralityInput: StageInput<NewsSourcingConfig> = {
      ...mockInput,
      data: {
        ...mockInput.data,
        minViralityScore: 0.99, // Very high, should filter most/all items
      }
    };

    const result = await executeNewsSourcing(highViralityInput);
    
    expect(result.success).toBe(true);
    // With random scores (0-1), it's possible but unlikely to get many > 0.99
    // But we check that those included actually meet the criteria
    result.data.items.forEach(item => {
      expect(item.viralityScore).toBeGreaterThanOrEqual(0.99);
    });
  });
});
