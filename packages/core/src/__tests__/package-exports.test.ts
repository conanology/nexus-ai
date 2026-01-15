/**
 * Test that package exports work correctly
 * Validates that types can be imported from @nexus-ai/core
 */

import { describe, it, expect } from 'vitest';

describe('Package Exports', () => {
  it('should export all pipeline types from main entry', async () => {
    const coreModule = await import('../index.js');

    expect(coreModule).toBeDefined();
    expect(coreModule.NEXUS_VERSION).toBe('0.1.0');
  });

  it('should export all types from types entry', async () => {
    const typesModule = await import('../types/index.js');

    expect(typesModule).toBeDefined();
    expect(typesModule.ErrorSeverity).toBeDefined();
    expect(typesModule.ErrorSeverity.RETRYABLE).toBe('RETRYABLE');
  });

  it('should allow type imports', () => {
    // This test validates TypeScript compilation
    // If types aren't properly exported, this won't compile
    type StageInput = import('../types/pipeline.js').StageInput<{ test: string }>;
    type StageOutput = import('../types/pipeline.js').StageOutput<{ result: string }>;
    type QualityMetrics = import('../quality/types.js').QualityMetrics;

    // Type assertions to verify types exist
    const input: StageInput = {
      pipelineId: '2026-01-08',
      previousStage: null,
      data: { test: 'value' },
      config: { timeout: 60000, retries: 3 },
    };

    const output: StageOutput = {
      success: true,
      data: { result: 'success' },
      quality: {
        stage: 'test',
        timestamp: new Date().toISOString(),
        measurements: {},
      },
      cost: {
        stage: 'test',
        totalCost: 0.001,
        breakdown: [],
        timestamp: new Date().toISOString(),
      },
      durationMs: 1000,
      provider: { name: 'test', tier: 'primary', attempts: 1 },
    };

    const metrics: QualityMetrics = {
      stage: 'test',
      timestamp: new Date().toISOString(),
      measurements: {},
    };

    expect(input.pipelineId).toBe('2026-01-08');
    expect(output.success).toBe(true);
    expect(metrics.stage).toBe('test');
  });
});
