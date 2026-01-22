/**
 * Retry command - retry failed pipelines
 *
 * @module @nexus-ai/operator-cli/commands/retry
 */

import type { Command } from 'commander';
import { createLogger, FirestoreClient } from '@nexus-ai/core';
import { getOrchestratorUrl } from '../utils/auth.js';
import { isValidDate, formatDuration } from '../utils/date.js';
import {
  createSpinner,
  formatSuccess,
  formatError,
  formatJson,
  formatStatus,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.retry');

interface RetryOptions {
  from?: string;
  wait?: boolean;
}

interface PipelineState {
  status: string;
  currentStage: string;
  error?: string;
}

interface RetryResponse {
  message: string;
  pipelineId: string;
  status: string;
  fromStage?: string;
  completedStages?: string[];
  skippedStages?: string[];
  totalDurationMs?: number;
  totalCost?: number;
  error?: string;
}

export function registerRetryCommand(program: Command): void {
  program
    .command('retry <pipelineId>')
    .description('Retry a failed pipeline')
    .option('-f, --from <stage>', 'Retry from specific stage')
    .option('-w, --wait', 'Wait for completion', false)
    .action(async (pipelineId: string, options: RetryOptions) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      // Validate pipeline ID format (YYYY-MM-DD)
      if (!isValidDate(pipelineId)) {
        console.error(formatError('Invalid pipeline ID format. Use YYYY-MM-DD'));
        process.exit(1);
      }

      logger.info({ pipelineId, from: options.from, wait: options.wait }, 'Retrying pipeline');

      try {
        // First check if pipeline exists and is in failed state
        const client = new FirestoreClient();
        let state: PipelineState | null = null;

        try {
          state = await client.getDocument<PipelineState>('pipelines', `${pipelineId}/state`);
        } catch (error) {
          // Document not found
          state = null;
        }

        if (!state) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Pipeline not found' }));
          } else {
            console.error(formatError(`Pipeline ${pipelineId} not found`));
          }
          process.exit(1);
        }

        if (state.status !== 'failed' && state.status !== 'error') {
          if (jsonMode) {
            console.log(formatJson({
              success: false,
              error: 'Pipeline is not in failed state',
              currentStatus: state.status,
            }));
          } else {
            console.error(formatError(`Pipeline ${pipelineId} is not in failed state`));
            console.error(`  Current status: ${formatStatus(state.status)}`);
            console.error('  Retry is only available for failed pipelines.');
          }
          process.exit(1);
        }

        const orchestratorUrl = getOrchestratorUrl();
        const spinner = createSpinner(`Retrying pipeline ${pipelineId}...`);

        if (!jsonMode) {
          spinner.start();
        }

        const response = await fetch(`${orchestratorUrl}/retry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pipelineId,
            fromStage: options.from,
            wait: options.wait,
          }),
        });

        const data = (await response.json()) as RetryResponse;

        if (!jsonMode) {
          spinner.stop();
        }

        if (!response.ok) {
          if (jsonMode) {
            console.log(formatJson({ success: false, ...data }));
          } else {
            console.error(formatError(`Pipeline retry failed: ${data.error || data.message}`));
            if (data.status) {
              console.error(`  Status: ${data.status}`);
            }
          }
          process.exit(1);
        }

        if (jsonMode) {
          console.log(formatJson({ success: true, ...data }));
        } else {
          if (options.wait && data.completedStages) {
            console.log(formatSuccess(`Pipeline ${pipelineId} retry completed`));
            console.log(`  Status: ${formatStatus(data.status)}`);
            console.log(`  From stage: ${data.fromStage || 'auto-detected'}`);
            console.log(`  Completed stages: ${data.completedStages.join(' → ')}`);
            if (data.skippedStages && data.skippedStages.length > 0) {
              console.log(`  Skipped stages: ${data.skippedStages.join(', ')}`);
            }
            if (data.totalDurationMs) {
              console.log(`  Duration: ${formatDuration(data.totalDurationMs)}`);
            }
            if (data.totalCost !== undefined) {
              console.log(`  Cost: $${data.totalCost.toFixed(2)}`);
            }
          } else {
            console.log(formatSuccess(`Pipeline ${pipelineId} retry started`));
            console.log(`  From stage: ${data.fromStage || 'auto-detected'}`);
            console.log(`  Status: ${data.status || 'accepted'}`);
            console.log(`  Use 'nexus status --date ${pipelineId}' to monitor progress`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Retry request failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to retry pipeline: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
