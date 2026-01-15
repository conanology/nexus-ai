import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeStage } from '../execute-stage';
import { logger } from '../../observability/logger';
import { CostTracker } from '../../observability/cost-tracker';
import { qualityGate } from '../../quality/gates';
import { StageInput } from '../../types';
import { NexusError } from '../../errors';

// Mock dependencies
vi.mock('../../observability/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../observability/cost-tracker', () => ({
  CostTracker: vi.fn().mockImplementation(() => ({
    recordApiCall: vi.fn(),
    getSummary: vi.fn().mockReturnValue({ totalCost: 0, breakdown: {} }),
  })),
}));

vi.mock('../../quality/gates', () => ({
  qualityGate: {
    check: vi.fn(),
  },
}));

describe('executeStage', () => {
  const mockInput: StageInput<{ value: string }> = {
    pipelineId: '2026-01-08',
    previousStage: null,
    data: { value: 'test' },
    config: {
      timeout: 1000,
      retries: 3,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute the stage function and return generic output', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ processed: true });
    
    const result = await executeStage(
      mockInput,
      'test-stage',
      mockExecute
    );

    expect(mockExecute).toHaveBeenCalledWith(
      mockInput.data, 
      expect.objectContaining({ tracker: expect.any(Object) })
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ processed: true });
    expect(logger.info).toHaveBeenCalledWith(expect.any(Object), 'Stage started');
    expect(logger.info).toHaveBeenCalledWith(expect.any(Object), 'Stage complete');
  });

  it('should wrap errors in NexusError', async () => {
    const error = new Error('Something went wrong');
    const mockExecute = vi.fn().mockRejectedValue(error);

    await expect(executeStage(
      mockInput,
      'test-stage',
      mockExecute
    )).rejects.toThrow(NexusError as any);

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Something went wrong',
        name: 'Error'
      })
    }), 'Stage failed');
  });

  it('should fail if quality gate fails', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ processed: true });
    
    vi.mocked(qualityGate.check).mockResolvedValue({
      status: 'FAIL',
      metrics: {},
      warnings: [],
      stage: 'test-stage',
      reason: 'Quality check failed'
    } as any);

    await expect(executeStage(
      mockInput,
      'test-stage',
      mockExecute,
      { qualityGate: 'test-gate' }
    )).rejects.toThrow('Quality check failed');
  });

  it('should include quality metrics when gate passes', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ processed: true });
    const mockMetrics = { score: 0.98 };

    vi.mocked(qualityGate.check).mockResolvedValue({
      status: 'PASS',
      metrics: mockMetrics,
      warnings: ['test warning'],
      stage: 'test-stage',
    } as any);

    const result = await executeStage(
      mockInput,
      'test-stage',
      mockExecute,
      { qualityGate: 'test-gate' }
    );

    expect(qualityGate.check).toHaveBeenCalledWith('test-stage', { processed: true });
    expect(result.quality.measurements).toEqual(mockMetrics);
    expect(result.warnings).toEqual(['test warning']);
    expect(result.success).toBe(true);
  });
});
