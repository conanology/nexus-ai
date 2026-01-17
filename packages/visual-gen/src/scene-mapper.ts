/**
 * Scene mapper implementation
 * Maps visual cues to Remotion components
 */

import type { VisualCue, SceneMapping } from './types.js';
import { GeminiLLMProvider, withRetry } from '@nexus-ai/core';

/**
 * Keyword to component mapping
 * First match wins, so order is important
 */
const KEYWORD_MAP: Record<string, string> = {
  // Neural network keywords
  'neural': 'NeuralNetworkAnimation',
  'network': 'NeuralNetworkAnimation',
  'nn': 'NeuralNetworkAnimation',
  'transformer': 'NeuralNetworkAnimation',

  // Data flow keywords
  'data': 'DataFlowDiagram',
  'flow': 'DataFlowDiagram',
  'pipeline': 'DataFlowDiagram',
  'process': 'DataFlowDiagram',

  // Comparison keywords
  'comparison': 'ComparisonChart',
  'compare': 'ComparisonChart',
  'vs': 'ComparisonChart',
  'versus': 'ComparisonChart',
  'side': 'ComparisonChart',

  // Metrics keywords
  'metrics': 'MetricsCounter',
  'stats': 'MetricsCounter',
  'statistics': 'MetricsCounter',
  'numbers': 'MetricsCounter',
  'counter': 'MetricsCounter',

  // Product mockup keywords
  'product': 'ProductMockup',
  'mockup': 'ProductMockup',
  'interface': 'ProductMockup',
  'ui': 'ProductMockup',

  // Code highlight keywords
  'code': 'CodeHighlight',
  'snippet': 'CodeHighlight',
  'syntax': 'CodeHighlight',

  // Transition keywords
  'transition': 'BrandedTransition',
  'wipe': 'BrandedTransition',
  'fade': 'BrandedTransition',
};

const DEFAULT_SCENE_DURATION = 30;

/**
 * Maps visual cues to Remotion component names
 */
export class SceneMapper {
  private fallbackUsage = 0;
  private totalCost = 0;
  private llmProvider: GeminiLLMProvider;

  constructor() {
    this.llmProvider = new GeminiLLMProvider('gemini-3-pro-preview');
  }

  /**
   * Map a visual cue to a scene component
   * Returns null if no keyword match found (for LLM fallback)
   */
  async mapCue(cue: VisualCue): Promise<SceneMapping | null> {
    // Tokenize description: lowercase and split on spaces
    const tokens = cue.description.toLowerCase().split(/\s+/);

    // Check each token against keyword map
    let component: string | null = null;
    for (const token of tokens) {
      if (KEYWORD_MAP[token]) {
        component = KEYWORD_MAP[token];
        break; // First match wins
      }
    }

    // Return null if no match (signals need for LLM fallback)
    if (!component) {
      return null;
    }

    // Extract props from cue
    const props = this.extractProps(cue);

    // Return scene mapping with default timing
    return {
      component,
      props,
      duration: DEFAULT_SCENE_DURATION,
      startTime: 0,
      endTime: DEFAULT_SCENE_DURATION,
    };
  }

  /**
   * Map cue with LLM fallback
   * Tries keyword matching first, then LLM if no match
   */
  async mapCueWithLLMFallback(cue: VisualCue): Promise<SceneMapping | null> {
    // Try keyword matching first
    const keywordResult = await this.mapCue(cue);
    if (keywordResult) {
      return keywordResult;
    }

    // Keyword matching failed, use LLM fallback
    return await this.mapCueWithLLM(cue);
  }

  /**
   * Map cue using LLM
   */
  private async mapCueWithLLM(cue: VisualCue): Promise<SceneMapping | null> {
    const prompt = this.buildLLMPrompt(cue.description);

    const retryResult = await withRetry(
      async () => await this.llmProvider.generate(prompt),
      { maxRetries: 3, stage: 'visual-gen' }
    );

    const llmResult = retryResult.result;

    // Track fallback usage and cost
    this.fallbackUsage++;
    this.totalCost += llmResult.cost;

    // Parse component name from response
    const component = llmResult.text.trim();

    // Extract props from cue
    const props = this.extractProps(cue);

    return {
      component,
      props,
      duration: DEFAULT_SCENE_DURATION,
      startTime: 0,
      endTime: DEFAULT_SCENE_DURATION,
    };
  }

  /**
   * Build LLM prompt for component mapping
   */
  private buildLLMPrompt(description: string): string {
    return `You are a visual component mapper for video generation. Map this visual cue to ONE of these components:
- NeuralNetworkAnimation (for neural networks, AI models, deep learning)
- DataFlowDiagram (for pipelines, data flows, processes)
- ComparisonChart (for comparisons, versus, A vs B)
- MetricsCounter (for stats, numbers, metrics)
- ProductMockup (for product demos, UI, interfaces)
- CodeHighlight (for code snippets, syntax)
- BrandedTransition (for transitions, wipes, fades)

Visual cue: "${description}"

Respond with ONLY the component name.`;
  }

  /**
   * Extract props from cue
   */
  private extractProps(cue: VisualCue): Record<string, any> {
    // Basic extraction - in future could parse key-value pairs from context
    return {
      title: cue.description,
      originalContext: cue.context // Include context for potential debugging/overlay
    };
  }

  /**
   * Get fallback usage count
   */
  getFallbackUsage(): number {
    return this.fallbackUsage;
  }

  /**
   * Get total cost of LLM calls
   */
  getTotalCost(): number {
    return this.totalCost;
  }
}
