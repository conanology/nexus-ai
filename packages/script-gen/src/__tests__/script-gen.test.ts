/**
 * Tests for script generation stage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeScriptGen } from '../script-gen.js';
import type { StageInput } from '@nexus-ai/core';
import type { ScriptGenInput } from '../types.js';

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
          totalCost: 0.12,
          stage: stageName,
          timestamp: new Date().toISOString(),
          breakdown: [],
        })),
      };

      const config = { ...input.config, tracker };
      const result = await executeFn(input.data, config);

      return {
        success: true,
        data: result,
        quality: {
          stage: stageName,
          timestamp: new Date().toISOString(),
          measurements: {},
        },
        cost: tracker.getSummary(),
        durationMs: 250,
        provider: result.providers?.optimizer || { name: 'gemini-3-pro-preview', tier: 'primary', attempts: 1 },
        warnings: [],
      };
    }),
    withFallback: vi.fn(async (providers, fn) => {
      const provider = providers[0];
      const result = await fn(provider);
      return {
        result,
        provider: provider.name,
        tier: 'primary' as const,
        attempts: [{ provider: provider.name, success: true, durationMs: 15 }],
      };
    }),
    CloudStorageClient: vi.fn().mockImplementation(() => ({
      uploadArtifact: vi.fn(async (date, stage, filename) => {
        return `gs://nexus-ai-artifacts/${date}/${stage}/${filename}`;
      }),
    })),
    GeminiLLMProvider: vi.fn().mockImplementation((model) => {
      let callCount = 0;
      return {
        name: model,
        generate: vi.fn(async (prompt) => {
          callCount++;

          // Generate appropriate mock content based on the prompt
          let mockText = '';

          if (prompt.includes('Writer') || prompt.includes('professional YouTube script writer')) {
            // Writer agent
            mockText = generateMockScript(1400, 'writer');
          } else if (prompt.includes('Critic') || prompt.includes('senior YouTube content editor')) {
            // Critic agent
            mockText = `## Critique
The script has good pacing and engagement. Some technical terms need pronunciation hints.

## Revised Script
${generateMockScript(1450, 'critic')}`;
          } else if (prompt.includes('Optimizer') || prompt.includes('professional YouTube script optimizer')) {
            // Optimizer agent
            mockText = generateMockScript(1500, 'optimizer');
          } else if (prompt.includes('word count adjustment')) {
            // Adjustment prompt - ensure it's within range
            mockText = generateMockScript(1400, 'adjusted');
          } else {
            // Default
            mockText = generateMockScript(1500, 'default');
          }

          return {
            text: mockText,
            tokens: {
              input: 800,
              output: 2500,
            },
            cost: 0.03,
            model: model,
            quality: 'primary' as const,
          };
        }),
        estimateCost: vi.fn(() => 0.04),
      };
    }),
    NexusError: actual.NexusError,
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: vi.fn(),
      getSummary: vi.fn(() => ({
        totalCost: 0.12,
        apiCalls: [],
      })),
    })),
  };
});

// Helper function to generate mock scripts with specific word counts
function generateMockScript(targetWords: number, agentType: string): string {
  const intro = `# Advanced AI Research: ${agentType.toUpperCase()} Draft

## Introduction

[VISUAL: Animated title sequence with AI neural network visualization]

Welcome to today's deep dive into cutting-edge artificial intelligence research. We're exploring groundbreaking developments that are reshaping the future of machine learning and neural networks.

[PRONOUNCE: Neural = "noor-al"]

## Main Content

The field of artificial intelligence continues to evolve at a rapid pace. Recent breakthroughs in [PRONOUNCE: Transformer = "trans-for-mer"] architectures have revolutionized natural language processing.

[VISUAL: Diagram showing transformer architecture layers]

Researchers have developed new techniques for training large language models more efficiently. These innovations reduce computational costs while improving model performance across various benchmarks.

[VISUAL: Performance comparison chart showing accuracy improvements]

The implications of these advances extend beyond academic research into practical applications. Industries ranging from healthcare to finance are leveraging these technologies to solve complex problems.

[PRONOUNCE: PyTorch = "pie-torch"]

Deep learning frameworks like PyTorch and TensorFlow continue to democratize access to powerful AI tools. Developers worldwide can now build sophisticated models with relative ease.

[VISUAL: Code snippet showing model training setup]

## Technical Details

The underlying mathematics of neural networks involves complex calculus and linear algebra. However, modern frameworks abstract away much of this complexity, allowing practitioners to focus on architecture design and data preparation.

[VISUAL: Mathematical equations fade into simplified API calls]

Attention mechanisms have become fundamental to state-of-the-art models. By learning to focus on relevant parts of input sequences, these models achieve human-like understanding of context and nuance.

[PRONOUNCE: CUDA = "koo-dah"]

GPU acceleration via CUDA has been instrumental in making large-scale training feasible. Modern hardware continues to push the boundaries of what's computationally possible.

[VISUAL: GPU cluster processing visualization]

## Future Outlook

Looking ahead, the trajectory of AI research points toward even more capable and efficient systems. Multimodal models that process text, images, and audio simultaneously represent the next frontier.

[VISUAL: Timeline showing AI evolution from 2020 to 2030]

Ethical considerations and responsible AI development remain paramount as these technologies become more powerful and widely deployed.

## Conclusion

The future of artificial intelligence is bright, with innovations emerging daily. Stay curious, keep learning, and join us next time for more cutting-edge tech insights.

[VISUAL: Closing animation with subscribe button]
`;

  // Count current words
  const currentWords = intro.trim().split(/\s+/).filter(Boolean).length;

  // Add padding if needed to reach target
  if (currentWords < targetWords) {
    const wordsNeeded = targetWords - currentWords;
    const padding = ' Additional content exploring further technical details and implications.'.repeat(Math.ceil(wordsNeeded / 7));
    return intro + '\n\n' + padding;
  }

  return intro;
}

describe('executeScriptGen', () => {
  const mockResearchBrief = `# Research Brief

## Overview
Comprehensive research on AI advancements and transformer architectures.

## Background
The evolution of neural networks and deep learning frameworks.

## Technical Deep Dive
Detailed analysis of attention mechanisms and model architectures.

## Current State
Recent developments in large language models and their applications.

## Implications
The impact of AI on various industries and society.

## Future Outlook
Predictions for next-generation AI systems and capabilities.
`.repeat(30); // Expand to ~2000 words

  const mockInput: StageInput<ScriptGenInput> = {
    pipelineId: '2026-01-16',
    previousStage: 'research',
    data: {
      researchBrief: mockResearchBrief,
    },
    config: {
      timeout: 120000,
      retries: 3,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully execute multi-agent pipeline', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.success).toBe(true);
    expect(result.data.script).toBeTruthy();
    expect(result.data.wordCount).toBeGreaterThan(0);
    expect(result.data.providers).toBeDefined();
    expect(result.data.providers.writer).toBeDefined();
    expect(result.data.providers.critic).toBeDefined();
    expect(result.data.providers.optimizer).toBeDefined();
  });

  it('should generate script within word count range', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.data.wordCount).toBeGreaterThanOrEqual(1200);
    expect(result.data.wordCount).toBeLessThanOrEqual(1800);
  });

  it('should produce V2 output with clean script field (no brackets)', async () => {
    const result = await executeScriptGen(mockInput);

    // V2: script field should be clean narration for backward compatibility
    // Legacy consumers use getScriptText() which handles both V1 and V2
    expect(result.data.script).not.toContain('[VISUAL:');
    expect(result.data.script).not.toContain('## NARRATION');
    expect(result.data.script).not.toContain('## DIRECTION');
  });

  it('should produce V2 output with scriptText and directionDocument', async () => {
    const result = await executeScriptGen(mockInput);

    // V2-specific fields
    expect((result.data as any).version).toBe('2.0');
    expect((result.data as any).scriptText).toBeDefined();
    expect((result.data as any).scriptUrl).toContain('script.md');
    expect((result.data as any).directionDocument).toBeDefined();
    expect((result.data as any).directionUrl).toContain('direction.json');
  });

  it('should save all drafts to Cloud Storage', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.data.draftUrls).toBeDefined();
    expect(result.data.draftUrls.writer).toContain('gs://nexus-ai-artifacts');
    expect(result.data.draftUrls.writer).toContain('v1-writer.md');
    expect(result.data.draftUrls.critic).toContain('v2-critic.md');
    expect(result.data.draftUrls.optimizer).toContain('v3-optimizer.md');
  });

  it('should save final script to Cloud Storage', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.data.artifactUrl).toContain('gs://nexus-ai-artifacts');
    expect(result.data.artifactUrl).toContain('2026-01-16/script-gen/script.md');
  });

  it('should track regeneration attempts', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.data.regenerationAttempts).toBeDefined();
    expect(result.data.regenerationAttempts).toBeGreaterThanOrEqual(0);
    expect(result.data.regenerationAttempts).toBeLessThanOrEqual(3);
  });

  it('should include provider information for each agent', async () => {
    const result = await executeScriptGen(mockInput);

    const { writer, critic, optimizer } = result.data.providers;

    expect(writer.name).toBeTruthy();
    expect(writer.tier).toMatch(/^(primary|fallback)$/);
    expect(writer.attempts).toBeGreaterThan(0);

    expect(critic.name).toBeTruthy();
    expect(critic.tier).toMatch(/^(primary|fallback)$/);
    expect(critic.attempts).toBeGreaterThan(0);

    expect(optimizer.name).toBeTruthy();
    expect(optimizer.tier).toMatch(/^(primary|fallback)$/);
    expect(optimizer.attempts).toBeGreaterThan(0);
  });

  it('should throw error when research brief is empty', async () => {
    const invalidInput: StageInput<ScriptGenInput> = {
      ...mockInput,
      data: {
        researchBrief: '',
      },
    };

    await expect(executeScriptGen(invalidInput)).rejects.toThrow();
  });

  it('should throw error when research brief is missing', async () => {
    const invalidInput: StageInput<ScriptGenInput> = {
      ...mockInput,
      data: {
        researchBrief: undefined as any,
      },
    };

    await expect(executeScriptGen(invalidInput)).rejects.toThrow();
  });

  it('should handle custom word count targets', async () => {
    const customInput: StageInput<ScriptGenInput> = {
      ...mockInput,
      data: {
        researchBrief: mockResearchBrief,
        targetWordCount: {
          min: 1300,
          max: 1700,
        },
      },
    };

    const result = await executeScriptGen(customInput);

    expect(result.success).toBe(true);
    expect(result.data.wordCount).toBeGreaterThanOrEqual(1300);
    expect(result.data.wordCount).toBeLessThanOrEqual(1700);
  });

  it('should include quality metrics in output', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.quality).toBeDefined();
    expect(result.quality.stage).toBe('script-gen');
  });

  it('should include cost tracking in output', async () => {
    const result = await executeScriptGen(mockInput);

    expect(result.cost).toBeDefined();
    expect(result.cost.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('should track costs for all agent calls', async () => {
    const result = await executeScriptGen(mockInput);

    // Since we execute 3 agents (writer, critic, optimizer), we expect costs to be tracked
    expect(result.cost.totalCost).toBeGreaterThan(0);
  });
});
