/**
 * Tests for SceneMapper LLM fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneMapper } from '../scene-mapper.js';
import type { VisualCue } from '../types.js';

// Mock the entire @nexus-ai/core module
vi.mock('@nexus-ai/core', () => ({
  GeminiLLMProvider: vi.fn().mockImplementation(() => ({
    name: 'gemini-3-pro-preview',
    generate: vi.fn().mockResolvedValue({
      text: 'DataFlowDiagram',
      tokens: 10,
      cost: 0.0001
    }),
  })),
  withRetry: vi.fn(async (fn) => {
    const result = await fn();
    return { result, attempts: 1, totalDelayMs: 0 };
  }),
  getSecret: vi.fn().mockResolvedValue('mock-api-key'),
}));

describe('SceneMapper LLM Fallback', () => {
  let mapper: SceneMapper;
  let mockGenerate: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mapper = new SceneMapper();

    // Access the mock generate function
    const { GeminiLLMProvider } = await import('@nexus-ai/core');
    const MockProvider = GeminiLLMProvider as any;
    mockGenerate = new MockProvider().generate;
  });

  describe('LLM fallback activation', () => {
    it('should use LLM fallback when keyword matching fails', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: 'DataFlowDiagram',
        tokens: 10,
        cost: 0.0001
      });

      // Create new mapper with mocked provider
      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'some complex unknown visualization',
        context: 'test',
        position: 0
      };

      const mapping = await testMapper.mapCueWithLLMFallback(cue);

      expect(mapping).not.toBeNull();
      expect(mapping?.component).toBe('DataFlowDiagram');
      expect(mockInstance.generate).toHaveBeenCalled();
    });

    it('should track fallback usage count', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: 'NeuralNetworkAnimation',
        tokens: 10,
        cost: 0.0001
      });

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'unknown viz',
        context: 'test',
        position: 0
      };

      await testMapper.mapCueWithLLMFallback(cue);

      // Check fallback usage increased
      expect(testMapper.getFallbackUsage()).toBe(1);
    });

    it('should not use LLM when keyword matching succeeds', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'neural network',
        context: 'test',
        position: 0
      };

      const mapping = await testMapper.mapCueWithLLMFallback(cue);

      expect(mapping?.component).toBe('NeuralNetworkAnimation');

      // LLM should not have been called
      expect(mockInstance.generate).not.toHaveBeenCalled();

      // Fallback usage should still be 0
      expect(testMapper.getFallbackUsage()).toBe(0);
    });
  });

  describe('LLM prompt construction', () => {
    it('should construct proper prompt for LLM', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: 'DataFlowDiagram',
        tokens: 10,
        cost: 0.0001
      });

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'abstract visualization',
        context: 'test',
        position: 0
      };

      await testMapper.mapCueWithLLMFallback(cue);

      // Verify prompt includes available components
      expect(mockInstance.generate).toHaveBeenCalled();
      const prompt = mockInstance.generate.mock.calls[0][0];

      expect(prompt).toContain('NeuralNetworkAnimation');
      expect(prompt).toContain('DataFlowDiagram');
      expect(prompt).toContain('abstract visualization');
    });
  });

  describe('cost tracking', () => {
    it('should estimate and track cost for LLM calls', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: 'MetricsCounter',
        tokens: 100,
        cost: 0.001
      });

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'unknown',
        context: 'test',
        position: 0
      };

      const mapping = await testMapper.mapCueWithLLMFallback(cue);

      expect(mapping).not.toBeNull();
      expect(mapping?.component).toBe('MetricsCounter');

      // Cost should be tracked
      const cost = testMapper.getTotalCost();
      expect(cost).toBe(0.001);
    });
  });

  describe('LLM response parsing', () => {
    it('should extract component name from LLM response', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: 'ComparisonChart',
        tokens: 10,
        cost: 0.0001
      });

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'unknown',
        context: 'test',
        position: 0
      };

      const mapping = await testMapper.mapCueWithLLMFallback(cue);

      expect(mapping?.component).toBe('ComparisonChart');
    });

    it('should handle LLM returning component with whitespace', async () => {
      const { GeminiLLMProvider } = await import('@nexus-ai/core');
      const MockProvider = GeminiLLMProvider as any;
      const mockInstance = new MockProvider();

      mockInstance.generate.mockResolvedValueOnce({
        text: '  ProductMockup  ',
        tokens: 10,
        cost: 0.0001
      });

      const testMapper = new SceneMapper();
      (testMapper as any).llmProvider = mockInstance;

      const cue: VisualCue = {
        index: 0,
        description: 'unknown',
        context: 'test',
        position: 0
      };

      const mapping = await testMapper.mapCueWithLLMFallback(cue);

      expect(mapping?.component).toBe('ProductMockup');
    });
  });
});
