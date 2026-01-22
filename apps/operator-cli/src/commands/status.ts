/**
 * Status command - show pipeline status
 *
 * @module @nexus-ai/operator-cli/commands/status
 */

import type { Command } from 'commander';
import { createLogger, FirestoreClient } from '@nexus-ai/core';
import { getToday, isValidDate, formatDuration, formatRelativeTime } from '../utils/date.js';
import {
  formatTable,
  formatJson,
  formatError,
  formatSuccess,
  formatStatus,
  formatInfo,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.status');

interface StatusOptions {
  date?: string;
  watch?: boolean;
}

interface PipelineState {
  currentStage: string;
  status: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  provider?: string;
  error?: string;
  qualityContext?: {
    degradedStages?: string[];
    fallbacksUsed?: string[];
    flags?: string[];
  };
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show pipeline status')
    .option('-d, --date <date>', 'Pipeline date (YYYY-MM-DD)', getToday())
    .option('-w, --watch', 'Watch for updates (poll every 5s)', false)
    .action(async (options: StatusOptions) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const date = options.date ?? getToday();

      // Validate date format
      if (!isValidDate(date)) {
        console.error(formatError('Invalid date format. Use YYYY-MM-DD'));
        process.exit(1);
      }

      logger.info({ date, watch: options.watch }, 'Fetching pipeline status');

      const fetchStatus = async (): Promise<PipelineState | null> => {
        try {
          const client = new FirestoreClient();
          const state = await client.getDocument<PipelineState>(
            'pipelines',
            `${date}/state`
          );
          return state;
        } catch (error) {
          // Document not found means pipeline hasn't run yet
          if (
            error instanceof Error &&
            error.message.includes('not found')
          ) {
            return null;
          }
          throw error;
        }
      };

      const displayStatus = (state: PipelineState | null): void => {
        if (!state) {
          if (jsonMode) {
            console.log(formatJson({ found: false, date, message: 'No pipeline run found' }));
          } else {
            console.log(formatInfo(`No pipeline run found for ${date}`));
            console.log(`  Run 'nexus trigger --date ${date}' to start a pipeline`);
          }
          return;
        }

        if (jsonMode) {
          console.log(formatJson({ found: true, date, ...state }));
        } else {
          console.log(`\nPipeline Status: ${date}`);
          console.log('─'.repeat(40));

          const rows: [string, string][] = [
            ['Current Stage', state.currentStage],
            ['Status', formatStatus(state.status)],
          ];

          if (state.startTime) {
            rows.push(['Started', formatRelativeTime(state.startTime)]);
          }
          if (state.durationMs) {
            rows.push(['Duration', formatDuration(state.durationMs)]);
          }
          if (state.provider) {
            rows.push(['Provider', state.provider]);
          }
          if (state.error) {
            rows.push(['Error', state.error]);
          }

          console.log(formatTable(['Field', 'Value'], rows));

          // Quality context
          if (state.qualityContext) {
            const { degradedStages, fallbacksUsed, flags } = state.qualityContext;

            if (degradedStages && degradedStages.length > 0) {
              console.log(`\n  Degraded stages: ${degradedStages.join(', ')}`);
            }
            if (fallbacksUsed && fallbacksUsed.length > 0) {
              console.log(`  Fallbacks used: ${fallbacksUsed.join(', ')}`);
            }
            if (flags && flags.length > 0) {
              console.log(`  Quality flags: ${flags.join(', ')}`);
            }
          }
        }
      };

      try {
        if (options.watch) {
          // Watch mode - poll every 5 seconds
          console.log(formatInfo(`Watching pipeline status for ${date}... (Ctrl+C to stop)`));
          console.log('');

          let lastStatus = '';

          const poll = async (): Promise<void> => {
            const state = await fetchStatus();
            const currentStatus = JSON.stringify(state);

            // Only update display if status changed
            if (currentStatus !== lastStatus) {
              // Clear previous output
              if (lastStatus) {
                process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen
                console.log(formatInfo(`Watching pipeline status for ${date}... (Ctrl+C to stop)`));
                console.log('');
              }
              displayStatus(state);
              lastStatus = currentStatus;
            }

            // Stop watching if pipeline completed or failed
            if (state && (state.status === 'completed' || state.status === 'failed')) {
              console.log('');
              console.log(
                state.status === 'completed'
                  ? formatSuccess('Pipeline completed')
                  : formatError('Pipeline failed')
              );
              process.exit(state.status === 'completed' ? 0 : 1);
            }
          };

          // Initial poll
          await poll();

          // Continue polling
          setInterval(() => {
            poll().catch((err) => {
              logger.error({ error: err.message }, 'Poll failed');
            });
          }, 5000);
        } else {
          // Single status fetch
          const state = await fetchStatus();
          displayStatus(state);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Status fetch failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to get status: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
