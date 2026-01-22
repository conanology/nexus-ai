/**
 * Pipeline execution logic for NEXUS-AI orchestrator
 * Implements sequential stage execution with retry, fallback, and error recovery
 */

import {
  NexusError,
  ErrorSeverity,
  createLogger,
  withRetry,
  type StageInput,
  type StageOutput,
  type QualityContext,
  updateBudgetSpent,
  checkCostThresholds,
  logIncident,
  mapSeverity,
  inferRootCause,
  type Incident,
  queueFailedTopic,
  checkTodayQueuedTopic,
  clearQueuedTopic,
  incrementRetryCount,
  type QueuedTopic,
  QUEUE_MAX_RETRIES,
} from '@nexus-ai/core';
import {
  sendDiscordAlert,
  type DiscordAlertConfig,
} from '@nexus-ai/notifications';
import { stageRegistry, stageOrder } from './stages.js';
import { PipelineStateManager } from './state.js';

const logger = createLogger('orchestrator.pipeline');

// =============================================================================
// Types
// =============================================================================

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Whether pipeline completed successfully */
  success: boolean;
  /** Pipeline ID (YYYY-MM-DD) */
  pipelineId: string;
  /** Final pipeline status */
  status: 'completed' | 'failed' | 'skipped';
  /** All stage outputs keyed by stage name */
  stageOutputs: Record<string, StageOutput<unknown>>;
  /** Stages that completed successfully */
  completedStages: string[];
  /** Stages that were skipped due to recoverable errors */
  skippedStages: string[];
  /** Final quality context */
  qualityContext: QualityContext;
  /** Total execution duration in ms */
  totalDurationMs: number;
  /** Total cost across all stages */
  totalCost: number;
  /** Error details if pipeline failed */
  error?: {
    code: string;
    message: string;
    stage: string;
    severity: string;
  };
  /** Skip details if pipeline was skipped (graceful shutdown) */
  skipInfo?: {
    reason: string;
    stage: string;
    topicQueued: boolean;
    queuedForDate?: string;
    incidentId?: string;
  };
}

/**
 * Retry configuration per stage
 */
interface StageRetryConfig {
  maxRetries: number;
  baseDelay: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Retry configuration per stage (from architecture decision)
 */
const STAGE_RETRY_CONFIG: Record<string, StageRetryConfig> = {
  'news-sourcing': { maxRetries: 3, baseDelay: 2000 },
  'research': { maxRetries: 3, baseDelay: 2000 },
  'script-gen': { maxRetries: 3, baseDelay: 2000 },
  'pronunciation': { maxRetries: 2, baseDelay: 1000 },
  'tts': { maxRetries: 5, baseDelay: 3000 },
  'visual-gen': { maxRetries: 3, baseDelay: 2000 },
  'render': { maxRetries: 3, baseDelay: 5000 },
  'thumbnail': { maxRetries: 3, baseDelay: 2000 },
  'youtube': { maxRetries: 5, baseDelay: 3000 },
  'twitter': { maxRetries: 2, baseDelay: 1000 },
  'notifications': { maxRetries: 3, baseDelay: 1000 },
};

/**
 * Stage criticality map - determines abort vs continue behavior
 */
const STAGE_CRITICALITY: Record<string, 'CRITICAL' | 'DEGRADED' | 'RECOVERABLE'> = {
  'news-sourcing': 'CRITICAL',
  'research': 'CRITICAL',
  'script-gen': 'CRITICAL',
  'pronunciation': 'DEGRADED',
  'tts': 'CRITICAL',
  'visual-gen': 'DEGRADED',
  'render': 'CRITICAL',
  'thumbnail': 'DEGRADED',
  'youtube': 'CRITICAL',
  'twitter': 'RECOVERABLE',
  'notifications': 'RECOVERABLE',
};

/**
 * Default stage configuration
 */
const DEFAULT_STAGE_CONFIG = {
  timeout: 300000, // 5 minutes default
  retries: 3,
};

/**
 * Maximum concurrent pipeline lock duration (4 hours)
 */
const MAX_PIPELINE_DURATION_MS = 4 * 60 * 60 * 1000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build stage input from previous stage output
 */
function buildStageInput<T>(
  pipelineId: string,
  stageName: string,
  previousStage: string | null,
  previousData: T,
  qualityContext: QualityContext
): StageInput<T> {
  const retryConfig = STAGE_RETRY_CONFIG[stageName] || { maxRetries: 3, baseDelay: 2000 };

  return {
    pipelineId,
    previousStage,
    data: previousData,
    config: {
      ...DEFAULT_STAGE_CONFIG,
      retries: retryConfig.maxRetries,
    },
    qualityContext,
  };
}

/**
 * Update quality context based on stage output
 */
function updateQualityContext(
  currentContext: QualityContext,
  stageName: string,
  output: StageOutput<unknown>
): QualityContext {
  const updated = { ...currentContext };

  // Track fallback usage
  if (output.provider.tier === 'fallback') {
    updated.fallbacksUsed = [
      ...updated.fallbacksUsed,
      `${stageName}:${output.provider.name}`,
    ];
  }

  // Track warnings as flags
  if (output.warnings && output.warnings.length > 0) {
    updated.flags = [...updated.flags, ...output.warnings];
  }

  return updated;
}

/**
 * Mark a stage as degraded in quality context
 */
function markStageDegraded(
  context: QualityContext,
  stageName: string
): QualityContext {
  return {
    ...context,
    degradedStages: [...context.degradedStages, stageName],
  };
}

/**
 * Skip decision result
 */
interface SkipDecision {
  skip: boolean;
  reason: string;
  stage: string;
}

/**
 * Determine if the day should be skipped based on error and stage
 *
 * A skip (vs fail) occurs when:
 * - A CRITICAL stage fails after all retries are exhausted
 * - All fallback providers have been tried
 * - The failure is not due to misconfiguration (which would be a hard fail)
 *
 * @param error - The error that caused the failure
 * @param stageName - The stage that failed
 * @param retryAttempts - Number of retry attempts made
 * @returns Skip decision with reason
 */
function shouldSkipDay(
  error: NexusError,
  stageName: string,
  retryAttempts: number
): SkipDecision {
  const stageCriticality = STAGE_CRITICALITY[stageName] || 'CRITICAL';

  // Only CRITICAL stages can trigger a skip
  if (stageCriticality !== 'CRITICAL') {
    return { skip: false, reason: '', stage: stageName };
  }

  // Check if this is after retry exhaustion (withRetry escalates to CRITICAL)
  const originalSeverity = (error.context?.originalSeverity as ErrorSeverity)
    || error.severity;

  // Skip conditions:
  // 1. Retries exhausted (error was retryable but exhausted)
  // 2. Fallbacks exhausted (NEXUS_FALLBACK_EXHAUSTED)
  // 3. Provider failures that we can't recover from
  const isRetryExhausted = retryAttempts > 0 &&
    (error.code === 'NEXUS_RETRY_EXHAUSTED' ||
     originalSeverity === ErrorSeverity.RETRYABLE ||
     originalSeverity === ErrorSeverity.FALLBACK);

  const isFallbackExhausted = error.code === 'NEXUS_FALLBACK_EXHAUSTED';

  const isProviderFailure = error.code?.includes('_TIMEOUT') ||
    error.code?.includes('_RATE_LIMIT') ||
    error.code?.includes('_SYNTHESIS_FAILED') ||
    error.code?.includes('_GENERATION_FAILED') ||
    error.code?.includes('_UNAVAILABLE');

  if (isRetryExhausted || isFallbackExhausted || isProviderFailure) {
    const reason = isFallbackExhausted
      ? `All fallback providers exhausted for ${stageName}`
      : isRetryExhausted
        ? `${stageName} failed after ${retryAttempts} retries: ${error.message}`
        : `${stageName} provider failure: ${error.code}`;

    return {
      skip: true,
      reason,
      stage: stageName,
    };
  }

  // Hard fail for configuration errors, validation errors, etc.
  return { skip: false, reason: '', stage: stageName };
}

/**
 * Check if another pipeline is already running for this ID
 */
async function checkPipelineLock(
  pipelineId: string,
  stateManager: PipelineStateManager
): Promise<boolean> {
  try {
    const existingState = await stateManager.getState(pipelineId);
    
    // Check if pipeline is currently running
    if (existingState.status === 'running') {
      // Check if it's stale (started more than 4 hours ago)
      const startTime = new Date(existingState.startTime).getTime();
      const now = Date.now();
      const elapsed = now - startTime;
      
      if (elapsed < MAX_PIPELINE_DURATION_MS) {
        // Pipeline is actively running
        logger.warn(
          { pipelineId, existingStatus: existingState.status, elapsedMs: elapsed },
          'Pipeline already running'
        );
        return true;
      } else {
        // Pipeline is stale - allow override
        logger.warn(
          { pipelineId, elapsedMs: elapsed },
          'Found stale pipeline, allowing override'
        );
        return false;
      }
    }
    
    // Pipeline exists but not running - allow restart
    return false;
  } catch (error) {
    // Pipeline doesn't exist - no lock
    return false;
  }
}

// =============================================================================
// Core Stage Execution Logic (DRY refactored)
// =============================================================================

/**
 * Skip info for pipeline result
 */
interface SkipInfo {
  reason: string;
  stage: string;
  topicQueued: boolean;
  queuedForDate?: string;
  incidentId?: string;
}

/**
 * Execute stages from a given index with shared logic
 */
async function executeStagesFrom(
  startIndex: number,
  pipelineId: string,
  stateManager: PipelineStateManager,
  initialData: unknown,
  initialPreviousStage: string | null,
  initialQualityContext: QualityContext,
  initialCompletedStages: string[] = [],
  selectedTopic?: string
): Promise<{
  stageOutputs: Record<string, StageOutput<unknown>>;
  completedStages: string[];
  skippedStages: string[];
  qualityContext: QualityContext;
  totalCost: number;
  pipelineAborted: boolean;
  abortError?: NexusError;
  pipelineSkipped: boolean;
  skipInfo?: SkipInfo;
}> {
  const stageOutputs: Record<string, StageOutput<unknown>> = {};
  const completedStages: string[] = [...initialCompletedStages];
  const skippedStages: string[] = [];
  let qualityContext = initialQualityContext;
  let totalCost = 0;
  let pipelineAborted = false;
  let abortError: NexusError | undefined;
  let pipelineSkipped = false;
  let skipInfo: SkipInfo | undefined;

  // Track topic for queuing if failure occurs
  let currentTopic: string | undefined = selectedTopic;

  // Track previous stage output data for chaining
  let previousStageData: unknown = initialData;
  let previousStageName: string | null = initialPreviousStage;

  // Execute stages sequentially from startIndex
  // NOTE: 'notifications' stage is handled specially by executePipeline (always runs, even on abort)
  for (let i = startIndex; i < stageOrder.length; i++) {
    if (pipelineAborted || pipelineSkipped) {
      break;
    }

    const stageName = stageOrder[i];

    // Skip notifications here - it's handled specially in executePipeline
    // to ensure it ALWAYS runs even when pipeline aborts (FR45, NFR4)
    if (stageName === 'notifications') {
      continue;
    }

    const stageExecutor = stageRegistry[stageName];
    
    if (!stageExecutor) {
      logger.warn({ pipelineId, stage: stageName }, 'Stage not found in registry, skipping');
      skippedStages.push(stageName);
      continue;
    }

    const retryConfig = STAGE_RETRY_CONFIG[stageName] || { maxRetries: 3, baseDelay: 2000 };
    let retryAttempts = 0;

    logger.info(
      { pipelineId, stage: stageName, previousStage: previousStageName },
      'Stage started'
    );

    // Update state to running
    try {
      await stateManager.updateStageStatus(pipelineId, stageName, {
        status: 'running',
        startTime: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ pipelineId, stage: stageName, error }, 'Failed to update stage state');
    }

    try {
      // Build stage input
      const stageInput = buildStageInput(
        pipelineId,
        stageName,
        previousStageName,
        previousStageData,
        qualityContext
      );

      // Execute stage with retry and timeout
      
      const { result: stageOutput } = await withRetry(
          () => stageExecutor(stageInput),
          {
            maxRetries: retryConfig.maxRetries,
            baseDelay: retryConfig.baseDelay,
            maxDelay: 30000,
            stage: stageName,
            onRetry: (attempt, delay, error) => {
              retryAttempts = attempt;
              logger.warn(
                {
                  pipelineId,
                  stage: stageName,
                  attemptNumber: attempt,
                  delayMs: delay,
                  error: error.code,
                },
                'Stage retry'
              );
            },
          }
        );

      // Record successful completion
      stageOutputs[stageName] = stageOutput;
      completedStages.push(stageName);
      totalCost += stageOutput.cost?.totalCost || 0;

      // Update quality context
      qualityContext = updateQualityContext(qualityContext, stageName, stageOutput);

      // Log fallback warning if applicable
      if (stageOutput.provider.tier === 'fallback') {
        logger.warn(
          {
            pipelineId,
            stage: stageName,
            provider: stageOutput.provider.name,
            tier: 'fallback',
            attempts: stageOutput.provider.attempts,
          },
          'Stage completed with fallback provider'
        );
      }

      logger.info(
        {
          pipelineId,
          stage: stageName,
          durationMs: stageOutput.durationMs,
          provider: stageOutput.provider.name,
          tier: stageOutput.provider.tier,
          cost: stageOutput.cost?.totalCost || 0,
        },
        'Stage completed'
      );

      // Update state to completed with retry count
      try {
        await stateManager.updateStageStatus(pipelineId, stageName, {
          status: 'completed',
          endTime: new Date().toISOString(),
          durationMs: stageOutput.durationMs,
          provider: stageOutput.provider,
          cost: stageOutput.cost,
        });
        
        // Update retry attempts separately if > 0
        if (retryAttempts > 0) {
          await stateManager.updateRetryAttempts(pipelineId, stageName, retryAttempts);
        }
        
        // Persist stage output data for resume capability
        await stateManager.persistStageOutput(pipelineId, stageName, stageOutput.data);
        
        // Persist quality context after each stage
        await stateManager.updateQualityContext(pipelineId, qualityContext);
      } catch (error) {
        logger.error({ pipelineId, stage: stageName, error }, 'Failed to update stage state');
      }

      // Chain output to next stage
      previousStageData = stageOutput.data;
      previousStageName = stageName;
    } catch (error) {
      const nexusError = NexusError.fromError(error, stageName);

      // Extract original severity - withRetry may escalate to CRITICAL
      // after exhausting retries, but preserves original in context
      const originalSeverity = (nexusError.context?.originalSeverity as ErrorSeverity)
        || nexusError.severity;

      logger.error(
        {
          pipelineId,
          stage: stageName,
          error: nexusError.code,
          message: nexusError.message,
          severity: originalSeverity,
          retryAttempts,
        },
        'Stage failed'
      );

      // Log incident BEFORE sending alerts (AC #7)
      let incidentId: string | undefined;
      try {
        const incident: Incident = {
          date: pipelineId,
          pipelineId,
          stage: stageName,
          error: {
            code: nexusError.code,
            message: nexusError.message,
            stack: nexusError.stack,
          },
          severity: mapSeverity(originalSeverity),
          startTime: nexusError.timestamp,
          rootCause: inferRootCause(nexusError.code),
          context: {
            provider: nexusError.context?.provider as string | undefined,
            attempt: retryAttempts,
            fallbacksUsed: qualityContext.fallbacksUsed,
            qualityContext: {
              degradedStages: qualityContext.degradedStages,
              fallbacksUsed: qualityContext.fallbacksUsed,
              flags: qualityContext.flags,
            },
            ...nexusError.context,
          },
        };

        incidentId = await logIncident(incident);
        logger.info({ pipelineId, incidentId, stage: stageName }, 'Incident logged');

        // Send Discord alert for CRITICAL incidents (AC #4)
        if (incident.severity === 'CRITICAL') {
          try {
            const discordConfig: DiscordAlertConfig = {
              severity: 'CRITICAL',
              title: `Pipeline Incident: ${incidentId}`,
              description: `Stage "${stageName}" failed: ${nexusError.message}`,
              fields: [
                { name: 'Incident ID', value: incidentId, inline: true },
                { name: 'Error Code', value: nexusError.code, inline: true },
                { name: 'Root Cause', value: incident.rootCause, inline: true },
                { name: 'Pipeline', value: pipelineId, inline: true },
              ],
              timestamp: new Date().toISOString(),
            };

            const alertResult = await sendDiscordAlert(discordConfig);
            if (alertResult.success) {
              logger.info({ pipelineId, incidentId }, 'CRITICAL incident Discord alert sent');
            } else {
              logger.warn(
                { pipelineId, incidentId, error: alertResult.error },
                'Failed to send CRITICAL incident Discord alert'
              );
            }
          } catch (alertError) {
            logger.warn(
              { pipelineId, incidentId, error: alertError },
              'Failed to send CRITICAL incident Discord alert'
            );
          }
        }
      } catch (incidentError) {
        // Log but don't fail - stage failure handling must continue
        logger.error(
          { pipelineId, stage: stageName, error: incidentError },
          'Failed to log incident'
        );
      }

      // Update state to failed
      try {
        await stateManager.updateStageStatus(pipelineId, stageName, {
          status: 'failed',
          endTime: new Date().toISOString(),
          error: {
            code: nexusError.code,
            message: nexusError.message,
            severity: originalSeverity,
            incidentId, // Include incident ID for traceability
          },
        });
        
        // Update retry attempts
        if (retryAttempts > 0) {
          await stateManager.updateRetryAttempts(pipelineId, stageName, retryAttempts);
        }
      } catch (stateError) {
        logger.error(
          { pipelineId, stage: stageName, error: stateError },
          'Failed to update stage error state'
        );
      }

      // Handle error based on original severity and stage criticality
      const stageCriticality = STAGE_CRITICALITY[stageName] || 'CRITICAL';

      // Determine if we should abort based on error severity AND stage criticality
      if (
        originalSeverity === ErrorSeverity.CRITICAL ||
        (originalSeverity !== ErrorSeverity.RECOVERABLE &&
          originalSeverity !== ErrorSeverity.DEGRADED &&
          stageCriticality === 'CRITICAL')
      ) {
        // Check if this should be a SKIP (graceful) vs FAIL (hard error)
        const skipDecision = shouldSkipDay(nexusError, stageName, retryAttempts);

        if (skipDecision.skip) {
          // Graceful skip - queue topic for retry and mark as skipped
          logger.warn(
            { pipelineId, stage: stageName, reason: skipDecision.reason },
            'Critical stage failure after recovery attempts - skipping day'
          );

          pipelineSkipped = true;
          abortError = nexusError;

          // Queue the failed topic for retry tomorrow
          let queuedForDate: string | undefined;
          if (currentTopic) {
            try {
              queuedForDate = await queueFailedTopic(
                currentTopic,
                nexusError.code,
                stageName,
                pipelineId
              );
              logger.info(
                { pipelineId, topic: currentTopic, queuedForDate },
                'Failed topic queued for retry'
              );
            } catch (queueError) {
              logger.error(
                { pipelineId, topic: currentTopic, error: queueError },
                'Failed to queue topic for retry'
              );
            }
          }

          skipInfo = {
            reason: skipDecision.reason,
            stage: stageName,
            topicQueued: queuedForDate !== undefined,
            queuedForDate,
            incidentId,
          };
        } else {
          // Hard fail - unexpected error, not recoverable
          logger.error(
            { pipelineId, stage: stageName, error: nexusError.code },
            'Critical stage failure - aborting pipeline'
          );
          pipelineAborted = true;
          abortError = nexusError;
        }
      } else if (
        originalSeverity === ErrorSeverity.RECOVERABLE ||
        stageCriticality === 'RECOVERABLE'
      ) {
        // Recoverable - skip stage and continue
        logger.warn(
          { pipelineId, stage: stageName },
          'Stage failed with recoverable error, continuing pipeline'
        );
        skippedStages.push(stageName);
      } else if (
        originalSeverity === ErrorSeverity.DEGRADED ||
        stageCriticality === 'DEGRADED'
      ) {
        // Degraded - continue but mark quality issue
        logger.warn(
          { pipelineId, stage: stageName },
          'Stage failed with degraded error, continuing with quality flag'
        );
        qualityContext = markStageDegraded(qualityContext, stageName);
        skippedStages.push(stageName);
      }
    }
  }

  return {
    stageOutputs,
    completedStages,
    skippedStages,
    qualityContext,
    totalCost,
    pipelineAborted,
    abortError,
    pipelineSkipped,
    skipInfo,
  };
}

// =============================================================================
// Main Pipeline Execution
// =============================================================================

/**
 * Execute the full pipeline for a given date
 *
 * @param pipelineId - Pipeline ID in YYYY-MM-DD format
 * @returns Pipeline result with all stage outputs
 *
 * @example
 * ```typescript
 * const result = await executePipeline('2026-01-19');
 * if (result.success) {
 *   console.log('Pipeline completed:', result.completedStages);
 * } else {
 *   console.error('Pipeline failed:', result.error);
 * }
 * ```
 */
export async function executePipeline(pipelineId: string): Promise<PipelineResult> {
  const startTime = Date.now();
  const stateManager = new PipelineStateManager();

  // Check for concurrent execution
  const isLocked = await checkPipelineLock(pipelineId, stateManager);
  if (isLocked) {
    throw NexusError.critical(
      'NEXUS_PIPELINE_ALREADY_RUNNING',
      `Pipeline ${pipelineId} is already running`,
      'orchestrator'
    );
  }

  logger.info({ pipelineId, stageCount: stageOrder.length }, 'Pipeline started');

  // Check for queued topic from previous day's failure (AC: 4, 5)
  // Note: pipelineId is always today's date (YYYY-MM-DD format)
  // Queued topics are stored at queued-topics/{targetDate} where targetDate = today
  const todayDate = pipelineId; // pipelineId IS today's date in YYYY-MM-DD format
  let queuedTopic: QueuedTopic | null = null;
  let usingQueuedTopic = false;

  try {
    queuedTopic = await checkTodayQueuedTopic();

    if (queuedTopic) {
      if (queuedTopic.retryCount < QUEUE_MAX_RETRIES) {
        // Use queued topic instead of fresh sourcing
        logger.info(
          {
            pipelineId,
            topic: queuedTopic.topic,
            retryCount: queuedTopic.retryCount,
            maxRetries: queuedTopic.maxRetries,
            originalDate: queuedTopic.originalDate,
          },
          'Using queued topic from previous failure'
        );

        // Increment retry count before processing
        // Uses todayDate since queued topics are stored at queued-topics/{targetDate}
        const updated = await incrementRetryCount(todayDate);

        if (updated === null) {
          // Max retries reached - topic was abandoned
          logger.warn(
            { pipelineId, topic: queuedTopic.topic },
            'Queued topic abandoned (max retries reached), proceeding with fresh sourcing'
          );
          queuedTopic = null;
        } else {
          queuedTopic = updated;
          usingQueuedTopic = true;
        }
      } else {
        // Already at max retries - clear and proceed with fresh sourcing
        logger.info(
          { pipelineId, topic: queuedTopic.topic },
          'Queued topic at max retries, clearing and proceeding with fresh sourcing'
        );
        await clearQueuedTopic(todayDate);
        queuedTopic = null;
      }
    }
  } catch (error) {
    logger.warn(
      { pipelineId, error },
      'Failed to check queued topics, proceeding with fresh sourcing'
    );
    queuedTopic = null;
  }

  // Initialize pipeline state in Firestore with retry
  let initAttempts = 0;
  const maxInitRetries = 3;
  while (initAttempts < maxInitRetries) {
    try {
      await stateManager.initializePipeline(pipelineId);
      break;
    } catch (error) {
      initAttempts++;
      logger.error(
        { pipelineId, error, attempt: initAttempts },
        'Failed to initialize pipeline state'
      );
      
      if (initAttempts >= maxInitRetries) {
        throw NexusError.critical(
          'NEXUS_STATE_INIT_FAILED',
          'Failed to initialize pipeline state after 3 attempts',
          'orchestrator'
        );
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * initAttempts));
    }
  }

  // Prepare initial data - use queued topic if available
  const initialData = usingQueuedTopic && queuedTopic
    ? { queuedTopic: queuedTopic.topic, fromQueue: true }
    : {};

  // Execute all stages from beginning
  const {
    stageOutputs,
    completedStages,
    skippedStages,
    qualityContext,
    totalCost,
    pipelineAborted,
    abortError,
    pipelineSkipped,
    skipInfo,
  } = await executeStagesFrom(
    0,
    pipelineId,
    stateManager,
    initialData,
    null,
    {
      degradedStages: [],
      fallbacksUsed: [],
      flags: [],
    },
    [],
    queuedTopic?.topic
  );

  // Clear queued topic on successful completion
  // Uses todayDate since queued topics are stored at queued-topics/{targetDate}
  if (usingQueuedTopic && !pipelineAborted && !pipelineSkipped) {
    try {
      await clearQueuedTopic(todayDate);
      logger.info(
        { pipelineId, topic: queuedTopic?.topic },
        'Queued topic cleared after successful processing'
      );
    } catch (error) {
      logger.warn(
        { pipelineId, error },
        'Failed to clear queued topic after success'
      );
    }
  }

  // ALWAYS execute notifications stage (FR45, NFR4)
  // Even if pipeline aborted or skipped, notifications must run
  const notificationsExecutor = stageRegistry['notifications'];
  if (notificationsExecutor) {
    try {
      logger.info(
        { pipelineId, pipelineAborted, pipelineSkipped },
        'Executing notifications stage (always runs)'
      );

      const notificationInput = buildStageInput(
        pipelineId,
        'notifications',
        completedStages[completedStages.length - 1] || null,
        {
          pipelineAborted,
          pipelineSkipped,
          abortReason: abortError?.message,
          skipInfo,
          completedStages,
          skippedStages,
          totalCost,
        },
        qualityContext
      );

      const { result: notificationOutput } = await withRetry(
        () => notificationsExecutor(notificationInput),
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 30000,
          stage: 'notifications',
        }
      );

      stageOutputs['notifications'] = notificationOutput;
      if (!pipelineAborted && !pipelineSkipped) {
        completedStages.push('notifications');
      }

      await stateManager.updateStageStatus(pipelineId, 'notifications', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: notificationOutput.durationMs,
        provider: notificationOutput.provider,
        cost: notificationOutput.cost,
      });

      logger.info({ pipelineId }, 'Notifications stage completed');
    } catch (notifyError) {
      logger.error(
        { pipelineId, error: notifyError },
        'Notification stage failed (non-fatal)'
      );
      // Notification failure shouldn't affect pipeline status
    }
  }

  const totalDurationMs = Date.now() - startTime;

  // Persist total cost to Firestore
  try {
    await stateManager.updateTotalCost(pipelineId, totalCost);
  } catch (error) {
    logger.error({ pipelineId, error }, 'Failed to persist total cost');
  }

  // Update budget and check cost thresholds (Story 5.5)
  try {
    // Update budget spent
    await updateBudgetSpent(totalCost, pipelineId);

    // Get cost breakdown from stage outputs for alerts
    // Categories: gemini (LLM + image), tts (audio synthesis), render (video + other)
    const costBreakdown = {
      gemini: 0,
      tts: 0,
      render: 0,
    };

    // Aggregate costs by category from completed stages
    for (const stageName of completedStages) {
      const output = stageOutputs[stageName];
      if (output?.cost?.breakdown) {
        for (const service of output.cost.breakdown) {
          const serviceLower = service.service.toLowerCase();
          if (serviceLower.startsWith('gemini-')) {
            // Gemini LLM and image generation
            costBreakdown.gemini += service.cost;
          } else if (
            serviceLower.startsWith('chirp') ||
            serviceLower.startsWith('wavenet') ||
            serviceLower.includes('-tts')
          ) {
            // TTS services
            costBreakdown.tts += service.cost;
          } else if (
            serviceLower.startsWith('render') ||
            serviceLower.includes('video-render')
          ) {
            // Video rendering
            costBreakdown.render += service.cost;
          } else {
            // Other services (YouTube API, Twitter API, etc.) go to render category
            // as they're operational costs similar to rendering/publishing
            costBreakdown.render += service.cost;
          }
        }
      }
    }

    // Check cost thresholds and send alerts if needed
    const alertResult = await checkCostThresholds(totalCost, pipelineId, costBreakdown);

    if (alertResult.triggered) {
      logger.warn(
        {
          pipelineId,
          totalCost,
          alertSeverity: alertResult.severity,
          alertSent: alertResult.sent,
        },
        'Cost alert triggered'
      );
    }
  } catch (error) {
    // Non-fatal - don't fail pipeline for cost tracking errors
    logger.error({ pipelineId, totalCost, error }, 'Failed to update budget or check cost thresholds');
  }

  // Build final result
  if (pipelineSkipped) {
    // Mark pipeline as skipped (graceful shutdown)
    try {
      await stateManager.markSkipped(
        pipelineId,
        skipInfo?.reason || 'Unknown skip reason',
        skipInfo?.stage || 'unknown'
      );
    } catch (error) {
      logger.error({ pipelineId, error }, 'Failed to mark pipeline as skipped');
    }

    logger.warn(
      {
        pipelineId,
        status: 'skipped',
        totalDurationMs,
        completedStages: completedStages.length,
        skipReason: skipInfo?.reason,
        skipStage: skipInfo?.stage,
        topicQueued: skipInfo?.topicQueued,
      },
      'Pipeline skipped (graceful shutdown)'
    );

    return {
      success: false,
      pipelineId,
      status: 'skipped',
      stageOutputs,
      completedStages,
      skippedStages,
      qualityContext,
      totalDurationMs,
      totalCost,
      error: abortError
        ? {
            code: abortError.code,
            message: abortError.message,
            stage: abortError.stage || 'unknown',
            severity: abortError.severity,
          }
        : undefined,
      skipInfo,
    };
  }

  if (pipelineAborted) {
    // Mark pipeline as failed (hard error)
    try {
      await stateManager.markFailed(pipelineId, abortError!);
    } catch (error) {
      logger.error({ pipelineId, error }, 'Failed to mark pipeline as failed');
    }

    logger.error(
      {
        pipelineId,
        status: 'failed',
        totalDurationMs,
        completedStages: completedStages.length,
        error: abortError?.code,
      },
      'Pipeline failed'
    );

    return {
      success: false,
      pipelineId,
      status: 'failed',
      stageOutputs,
      completedStages,
      skippedStages,
      qualityContext,
      totalDurationMs,
      totalCost,
      error: abortError
        ? {
            code: abortError.code,
            message: abortError.message,
            stage: abortError.stage || 'unknown',
            severity: abortError.severity,
          }
        : undefined,
    };
  }

  // Mark pipeline as complete
  try {
    await stateManager.markComplete(pipelineId);
  } catch (error) {
    logger.error({ pipelineId, error }, 'Failed to mark pipeline as complete');
  }

  logger.info(
    {
      pipelineId,
      status: 'completed',
      totalDurationMs,
      totalCost,
      completedStages: completedStages.length,
      skippedStages: skippedStages.length,
      degradedStages: qualityContext.degradedStages.length,
      fallbacksUsed: qualityContext.fallbacksUsed.length,
    },
    'Pipeline completed'
  );

  return {
    success: true,
    pipelineId,
    status: 'completed',
    stageOutputs,
    completedStages,
    skippedStages,
    qualityContext,
    totalDurationMs,
    totalCost,
  };
}

// =============================================================================
// Pipeline Resume
// =============================================================================

/**
 * Resume a pipeline from a specific stage or last successful stage
 *
 * @param pipelineId - Pipeline ID to resume
 * @param fromStage - Optional explicit stage to resume from
 * @returns Pipeline result
 *
 * @example
 * ```typescript
 * // Resume from last successful stage
 * const result = await resumePipeline('2026-01-19');
 *
 * // Resume from specific stage
 * const result = await resumePipeline('2026-01-19', 'script-gen');
 * ```
 */
export async function resumePipeline(
  pipelineId: string,
  fromStage?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stateManager = new PipelineStateManager();

  // Load existing state
  const existingState = await stateManager.getState(pipelineId);

  // Validate pipeline is in resumable state (AC: 6)
  const resumableStatuses = ['failed', 'skipped', 'paused'];
  if (!resumableStatuses.includes(existingState.status)) {
    if (existingState.status === 'running') {
      throw NexusError.critical(
        'NEXUS_PIPELINE_ALREADY_RUNNING',
        `Pipeline ${pipelineId} is currently running`,
        'orchestrator'
      );
    }
    if (existingState.status === 'completed') {
      throw NexusError.critical(
        'NEXUS_PIPELINE_COMPLETED',
        `Pipeline ${pipelineId} has already completed successfully`,
        'orchestrator'
      );
    }
    throw NexusError.critical(
      'NEXUS_PIPELINE_INVALID_STATE',
      `Pipeline ${pipelineId} is in non-resumable state: ${existingState.status}`,
      'orchestrator'
    );
  }

  // Update state to running before resuming
  try {
    await stateManager.initializePipeline(pipelineId);
    logger.info(
      { pipelineId, previousStatus: existingState.status },
      'Pipeline state updated to running for resume'
    );
  } catch (error) {
    logger.warn(
      { pipelineId, error },
      'Failed to update pipeline state for resume, continuing anyway'
    );
  }

  // Determine resume point
  let resumeStageIndex: number;
  if (fromStage) {
    resumeStageIndex = stageOrder.indexOf(fromStage);
    if (resumeStageIndex === -1) {
      throw NexusError.critical(
        'NEXUS_INVALID_STAGE',
        `Invalid stage name: ${fromStage}`,
        'orchestrator'
      );
    }
  } else {
    // Find last completed stage
    let lastCompletedIndex = -1;
    for (let i = stageOrder.length - 1; i >= 0; i--) {
      const stageName = stageOrder[i];
      const stageState = existingState.stages[stageName];
      if (stageState?.status === 'completed') {
        lastCompletedIndex = i;
        break;
      }
    }
    resumeStageIndex = lastCompletedIndex + 1;
  }

  const resumeStage = stageOrder[resumeStageIndex];

  // Load previous stage output data for chaining
  let previousStageData: unknown = {};
  let previousStageName: string | null = null;
  const completedStages: string[] = [];

  if (resumeStageIndex > 0) {
    const lastStageName = stageOrder[resumeStageIndex - 1];
    try {
      previousStageData = await stateManager.loadStageOutput(pipelineId, lastStageName);
      previousStageName = lastStageName;
    } catch (error) {
      logger.warn(
        { pipelineId, stage: lastStageName, error },
        'Failed to load previous stage output, using empty data'
      );
    }
  }

  // Mark completed stages
  for (let i = 0; i < resumeStageIndex; i++) {
    const stageName = stageOrder[i];
    const stageState = existingState.stages[stageName];
    if (stageState?.status === 'completed') {
      completedStages.push(stageName);
    }
  }

  // Log resume info
  logger.info(
    {
      pipelineId,
      fromStage: resumeStage,
      completedStages,
    },
    'Resuming pipeline'
  );

  // Execute remaining stages
  const {
    stageOutputs,
    completedStages: newlyCompletedStages,
    skippedStages,
    qualityContext,
    totalCost,
    pipelineAborted,
    abortError,
    pipelineSkipped,
    skipInfo,
  } = await executeStagesFrom(
    resumeStageIndex,
    pipelineId,
    stateManager,
    previousStageData,
    previousStageName,
    existingState.qualityContext || {
      degradedStages: [],
      fallbacksUsed: [],
      flags: [],
    },
    completedStages
  );

  const totalDurationMs = Date.now() - startTime;

  // Persist total cost
  try {
    await stateManager.updateTotalCost(pipelineId, totalCost);
  } catch (error) {
    logger.error({ pipelineId, error }, 'Failed to persist total cost');
  }

  // Handle skipped pipeline (graceful shutdown)
  if (pipelineSkipped) {
    try {
      await stateManager.markSkipped(
        pipelineId,
        skipInfo?.reason || 'Unknown skip reason',
        skipInfo?.stage || 'unknown'
      );
    } catch (error) {
      logger.error({ pipelineId, error }, 'Failed to mark resumed pipeline as skipped');
    }

    logger.warn(
      {
        pipelineId,
        status: 'skipped',
        totalDurationMs,
        completedStages: newlyCompletedStages.length,
        skipReason: skipInfo?.reason,
      },
      'Pipeline skipped (resumed)'
    );

    return {
      success: false,
      pipelineId,
      status: 'skipped',
      stageOutputs,
      completedStages: newlyCompletedStages,
      skippedStages,
      qualityContext,
      totalDurationMs,
      totalCost,
      error: abortError
        ? {
            code: abortError.code,
            message: abortError.message,
            stage: abortError.stage || 'unknown',
            severity: abortError.severity,
          }
        : undefined,
      skipInfo,
    };
  }

  if (pipelineAborted) {
    try {
      await stateManager.markFailed(pipelineId, abortError!);
    } catch (error) {
      logger.error({ pipelineId, error }, 'Failed to mark pipeline as failed');
    }

    logger.error(
      {
        pipelineId,
        status: 'failed',
        totalDurationMs,
        completedStages: newlyCompletedStages.length,
        error: abortError?.code,
      },
      'Pipeline failed (resumed)'
    );

    return {
      success: false,
      pipelineId,
      status: 'failed',
      stageOutputs,
      completedStages: newlyCompletedStages,
      skippedStages,
      qualityContext,
      totalDurationMs,
      totalCost,
      error: abortError
        ? {
            code: abortError.code,
            message: abortError.message,
            stage: abortError.stage || 'unknown',
            severity: abortError.severity,
          }
        : undefined,
    };
  }

  try {
    await stateManager.markComplete(pipelineId);
  } catch (error) {
    logger.error({ pipelineId, error }, 'Failed to mark pipeline as complete');
  }

  logger.info(
    {
      pipelineId,
      status: 'completed',
      totalDurationMs,
      totalCost,
      completedStages: newlyCompletedStages.length,
      skippedStages: skippedStages.length,
    },
    'Pipeline completed (resumed)'
  );

  return {
    success: true,
    pipelineId,
    status: 'completed',
    stageOutputs,
    completedStages: newlyCompletedStages,
    skippedStages,
    qualityContext,
    totalDurationMs,
    totalCost,
  };
}
