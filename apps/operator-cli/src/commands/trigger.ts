/**
 * Trigger command - manually trigger pipeline execution
 *
 * @module @nexus-ai/operator-cli/commands/trigger
 */

import type { Command } from 'commander';
import { createLogger } from '@nexus-ai/core';
import { getOrchestratorUrl } from '../utils/auth.js';
import { getToday, isValidDate, formatDuration } from '../utils/date.js';
import {
  createSpinner,
  formatSuccess,
  formatError,
  formatJson,
  formatStatus,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.trigger');

interface TriggerOptions {
  date?: string;
  wait?: boolean;
  skipHealthCheck?: boolean;
}

interface TriggerResponse {
  message: string;
  pipelineId: string;
  status: string;
  completedStages?: string[];
  skippedStages?: string[];
  totalDurationMs?: number;
  totalCost?: number;
  qualityContext?: Record<string, unknown>;
  error?: string;
}

export function registerTriggerCommand(program: Command): void {
  program
    .command('trigger')
    .description('Manually trigger pipeline execution')
    .option('-d, --date <date>', 'Pipeline date (YYYY-MM-DD)', getToday())
    .option('-w, --wait', 'Wait for pipeline completion', false)
    .option('--skip-health-check', 'Skip pre-execution health check', false)
    .action(async (options: TriggerOptions) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const date = options.date ?? getToday();

      // Validate date format
      if (!isValidDate(date)) {
        console.error(formatError('Invalid date format. Use YYYY-MM-DD'));
        process.exit(1);
      }

      const orchestratorUrl = getOrchestratorUrl();
      const spinner = createSpinner(`Triggering pipeline for ${date}...`);

      if (!jsonMode) {
        spinner.start();
      }

      logger.info({ date, wait: options.wait }, 'Triggering pipeline');

      try {
        const response = await fetch(`${orchestratorUrl}/trigger/manual`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date,
            wait: options.wait,
            skipHealthCheck: options.skipHealthCheck,
          }),
        });

        const data = (await response.json()) as TriggerResponse;

        if (!jsonMode) {
          spinner.stop();
        }

        if (!response.ok) {
          if (jsonMode) {
            console.log(formatJson({ success: false, ...data }));
          } else {
            console.error(formatError(`Pipeline trigger failed: ${data.error || data.message}`));
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
            console.log(formatSuccess(`Pipeline ${date} completed`));
            console.log(`  Status: ${formatStatus(data.status)}`);
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
            console.log(formatSuccess(`Pipeline ${date} triggered`));
            console.log(`  Status: ${data.status || 'accepted'}`);
            console.log(`  Use 'nexus status --date ${date}' to monitor progress`);
          }
        }
      } catch (error) {
        if (!jsonMode) {
          spinner.stop();
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Trigger request failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to trigger pipeline: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
