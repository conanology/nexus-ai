import { StageInput, StageOutput, StageConfig } from '../types';
import { logger } from '../observability';
import { CostTracker } from '../observability';
import { NexusError } from '../errors';
import { qualityGate, QualityGateName } from '../quality';

export async function executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: { qualityGate?: QualityGateName }
): Promise<StageOutput<TOut>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, stageName);

  logger.info({
    pipelineId: input.pipelineId,
    stage: stageName,
  }, 'Stage started');

  try {
    // Inject tracker into config
    const configWithTracker = { ...input.config, tracker };

    // Execute stage logic
    const result = await execute(input.data, configWithTracker);

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Determine provider info (try to extract from result if available)
    const resultAny = result as any;
    const providerInfo = resultAny.provider || {
      name: 'unknown',
      tier: 'primary',
      attempts: 1,
    };

    // Quality gate check
    let qualityMetrics = {
      stage: stageName,
      timestamp: new Date().toISOString(),
      measurements: {} as Record<string, unknown>
    };
    let warnings: string[] = [];

    if (options?.qualityGate) {
      const gateResult = await qualityGate.check(stageName, result);
      
      qualityMetrics = {
          stage: gateResult.stage,
          timestamp: new Date().toISOString(),
          measurements: gateResult.metrics as Record<string, unknown>
      };
      warnings = gateResult.warnings;

      if (gateResult.status === 'FAIL') {
        throw NexusError.degraded(
          'NEXUS_QUALITY_GATE_FAIL',
          gateResult.reason || 'Quality gate failed',
          stageName
        );
      }
    }

    const output: StageOutput<TOut> = {
      success: true,
      data: result,
      artifacts: resultAny.artifacts,
      quality: qualityMetrics,
      cost: tracker.getSummary(),
      durationMs,
      provider: providerInfo,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    logger.info({
      pipelineId: input.pipelineId,
      stage: stageName,
      durationMs: output.durationMs,
      provider: output.provider,
      cost: output.cost.totalCost
    }, 'Stage complete');

    return output;

  } catch (error: any) {
    // Create a safe error object for logging to avoid leaking secrets (e.g. headers in axios errors)
    const safeError = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      context: (error as any).context,
    } : error;

    logger.error({
      pipelineId: input.pipelineId,
      stage: stageName,
      error: safeError,
    }, 'Stage failed');

    throw NexusError.fromError(error, stageName);
  }
}
