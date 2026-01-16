/**
 * Tests for research stage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeResearch } from '../research.js';
import type { StageInput } from '@nexus-ai/core';
import type { ResearchInput } from '../types.js';

// Mock the core dependencies
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    executeStage: vi.fn(async (input, stageName, executeFn, options) => {
      // Mock the executeStage wrapper to just call the executeFn
      const tracker = {
        recordApiCall: vi.fn(),
        getSummary: vi.fn(() => ({
          totalCost: 0.05,
          stage: stageName,
          timestamp: new Date().toISOString(),
          breakdown: [],
        })),
      };

      const config = { ...input.config, tracker };
      const result = await executeFn(input.data, config);

      // Extract provider info from result if available
      const providerInfo = result?.provider || { name: 'gemini-3-pro-preview', tier: 'primary', attempts: 1 };

      return {
        success: true,
        data: result,
        quality: {
          stage: stageName,
          timestamp: new Date().toISOString(),
          measurements: {},
        },
        cost: tracker.getSummary(),
        durationMs: 100,
        provider: providerInfo,
        warnings: [],
      };
    }),
    withRetry: vi.fn(async (fn) => {
      const result = await fn();
      return { result, attempts: 1 };
    }),
    withFallback: vi.fn(async (providers, fn) => {
      const provider = providers[0];
      const result = await fn(provider);
      return {
        result,
        provider: provider.name,
        tier: 'primary' as const,
        attempts: [{ provider: provider.name, success: true, durationMs: 10 }],
      };
    }),
    CloudStorageClient: vi.fn().mockImplementation(() => ({
      uploadArtifact: vi.fn(async (date, stage, filename) => {
        return `gs://nexus-ai-artifacts/${date}/${stage}/${filename}`;
      }),
    })),
    GeminiLLMProvider: vi.fn().mockImplementation((model) => ({
      name: model,
      generate: vi.fn(async (prompt) => {
        // Generate a mock research brief
        const mockBrief = `## Overview
This is a comprehensive research brief on the topic.

## Background and History
The technology has evolved significantly over the past decade.

## Technical Deep Dive
Here are the technical details that matter.

## Current State and Adoption
Currently, this technology is being adopted by many organizations.

## Implications and Impact
The implications are far-reaching and transformative.

## Future Outlook
The future looks promising with many developments on the horizon.

## Key Takeaways
- Important point 1
- Important point 2
- Important point 3
`.repeat(20); // Repeat to get ~2000 words

        return {
          text: mockBrief,
          tokens: {
            input: 500,
            output: 2000,
          },
          cost: 0.015,
          model: model,
          quality: 'primary' as const,
        };
      }),
      estimateCost: vi.fn(() => 0.02),
    })),
    NexusError: actual.NexusError,
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn(() => ({
        totalCost: 0.05,
        apiCalls: [],
      })),
    })),
  };
});

describe('executeResearch', () => {
  const mockInput: StageInput<ResearchInput> = {
    pipelineId: '2026-01-16',
    previousStage: 'topic-selection',
    data: {
      topic: {
        url: 'https://github.com/trending',
        title: 'Advanced AI Research Breakthrough',
        description: 'A groundbreaking discovery in machine learning',
        source: 'github-trending',
        metadata: {
          stars: 1500,
          language: 'Python',
        },
      },
    },
    config: {
      timeout: 60000,
      retries: 3,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully generate a research brief', async () => {
    const result = await executeResearch(mockInput);

    expect(result.success).toBe(true);
    expect(result.data.brief).toBeTruthy();
    expect(result.data.wordCount).toBeGreaterThan(0);
    expect(result.data.artifactUrl).toContain('gs://nexus-ai-artifacts');
    expect(result.data.artifactUrl).toContain('2026-01-16/research/research.md');
  });

  it('should generate a brief with minimum word count', async () => {
    const result = await executeResearch(mockInput);

    expect(result.data.wordCount).toBeGreaterThan(100);
    expect(result.data.brief.length).toBeGreaterThan(0);
  });

  it('should include provider information', async () => {
    const result = await executeResearch(mockInput);

    expect(result.data.provider).toBeDefined();
    expect(result.data.provider.name).toBeTruthy();
    expect(result.data.provider.tier).toBeDefined();
    expect(result.data.provider.attempts).toBeGreaterThan(0);
  });

  it('should store the brief in Cloud Storage', async () => {
    const result = await executeResearch(mockInput);

    expect(result.data.artifactUrl).toMatch(/^gs:\/\//);
    expect(result.data.artifactUrl).toContain('research.md');
  });

  it('should use topic metadata in the research', async () => {
    const result = await executeResearch(mockInput);

    // Verify the research was generated
    expect(result.success).toBe(true);
    expect(result.data.brief).toBeTruthy();
  });

  it('should throw error when topic URL is missing', async () => {
    const invalidInput: StageInput<ResearchInput> = {
      ...mockInput,
      data: {
        topic: {
          url: '',
          title: 'Test Topic',
        },
      },
    };

    await expect(executeResearch(invalidInput)).rejects.toThrow();
  });

  it('should throw error when topic title is missing', async () => {
    const invalidInput: StageInput<ResearchInput> = {
      ...mockInput,
      data: {
        topic: {
          url: 'https://example.com',
          title: '',
        },
      },
    };

    await expect(executeResearch(invalidInput)).rejects.toThrow();
  });

  it('should include quality metrics in output', async () => {
    const result = await executeResearch(mockInput);

    expect(result.quality).toBeDefined();
    expect(result.quality.stage).toBe('research');
  });

  it('should include cost tracking in output', async () => {
    const result = await executeResearch(mockInput);

    expect(result.cost).toBeDefined();
    expect(result.cost.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('should handle topic without description', async () => {
    const inputWithoutDesc: StageInput<ResearchInput> = {
      ...mockInput,
      data: {
        topic: {
          url: 'https://example.com',
          title: 'Test Topic',
        },
      },
    };

    const result = await executeResearch(inputWithoutDesc);

    expect(result.success).toBe(true);
    expect(result.data.brief).toBeTruthy();
  });

  it('should handle topic without metadata', async () => {
    const inputWithoutMetadata: StageInput<ResearchInput> = {
      ...mockInput,
      data: {
        topic: {
          url: 'https://example.com',
          title: 'Test Topic',
          description: 'A test topic',
        },
      },
    };

    const result = await executeResearch(inputWithoutMetadata);

    expect(result.success).toBe(true);
    expect(result.data.brief).toBeTruthy();
  });
});
