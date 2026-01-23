/**
 * Scheduler command - manage Cloud Scheduler for daily pipeline
 *
 * @module @nexus-ai/operator-cli/commands/scheduler
 */

import type { Command } from 'commander';
import { execSync, type ExecSyncOptions } from 'child_process';
import { createLogger } from '@nexus-ai/core';
import { getProjectId } from '../utils/auth.js';
import {
  createSpinner,
  formatSuccess,
  formatError,
  formatJson,
  formatStatus,
  formatInfo,
  formatWarning,
  formatTable,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.scheduler');

const SCHEDULER_JOB_NAME = process.env['NEXUS_SCHEDULER_JOB_NAME'] || 'nexus-daily-pipeline';
const SCHEDULER_LOCATION = process.env['NEXUS_SCHEDULER_LOCATION'] || 'us-central1';

/**
 * Verifies gcloud CLI is available
 */
function verifyGcloudAvailable(): void {
  try {
    execSync('gcloud --version', { stdio: 'pipe' });
  } catch {
    throw new Error(
      'gcloud CLI is not installed or not in PATH.\n' +
      'Install from: https://cloud.google.com/sdk/docs/install'
    );
  }
}

/**
 * Verifies the scheduler job exists before operations
 */
async function verifyJobExists(projectId: string): Promise<boolean> {
  try {
    execGcloud([
      'scheduler',
      'jobs',
      'describe',
      SCHEDULER_JOB_NAME,
      `--location=${SCHEDULER_LOCATION}`,
      `--project=${projectId}`,
      '--format=value(name)',
    ]);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('not found')) {
      return false;
    }
    throw error;
  }
}

interface SchedulerJobStatus {
  name: string;
  state: string;
  schedule: string;
  timeZone: string;
  lastAttemptTime?: string;
  scheduleTime?: string;
  status?: {
    code?: number;
    message?: string;
  };
}

/**
 * Execute gcloud command and return output
 */
function execGcloud(
  args: string[],
  options: ExecSyncOptions = {}
): string {
  const command = `gcloud ${args.join(' ')}`;
  logger.debug({ command }, 'Executing gcloud command');

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
    return typeof output === 'string' ? output.trim() : output.toString().trim();
  } catch (error) {
    const execError = error as { stderr?: Buffer | string; message: string };
    const stderr = execError.stderr
      ? Buffer.isBuffer(execError.stderr)
        ? execError.stderr.toString()
        : String(execError.stderr)
      : '';
    throw new Error(stderr || execError.message);
  }
}

/**
 * Get scheduler job status
 */
async function getSchedulerStatus(): Promise<SchedulerJobStatus | null> {
  const projectId = getProjectId();

  try {
    const output = execGcloud([
      'scheduler',
      'jobs',
      'describe',
      SCHEDULER_JOB_NAME,
      `--location=${SCHEDULER_LOCATION}`,
      `--project=${projectId}`,
      '--format=json',
    ]);

    return JSON.parse(output) as SchedulerJobStatus;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export function registerSchedulerCommand(program: Command): void {
  const scheduler = program
    .command('scheduler')
    .description('Manage Cloud Scheduler for daily pipeline');

  // scheduler status
  scheduler
    .command('status')
    .description('Show scheduler job status')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info('Fetching scheduler status');

      try {
        // Verify gcloud is available
        verifyGcloudAvailable();

        const status = await getSchedulerStatus();

        if (!status) {
          if (jsonMode) {
            console.log(formatJson({ found: false, message: 'Scheduler job not found' }));
          } else {
            console.log(formatError(`Scheduler job '${SCHEDULER_JOB_NAME}' not found`));
            console.log(formatInfo('The scheduler may not be deployed yet.'));
            console.log(formatInfo('Deploy with: cd infrastructure/cloud-scheduler && terraform apply'));
          }
          process.exit(1);
        }

        if (jsonMode) {
          console.log(formatJson({ found: true, ...status }));
        } else {
          console.log('\nCloud Scheduler Status');
          console.log('─'.repeat(40));

          const stateDisplay = status.state === 'ENABLED' ? 'ENABLED' : 'PAUSED';
          const rows: [string, string][] = [
            ['Job Name', SCHEDULER_JOB_NAME],
            ['State', formatStatus(stateDisplay)],
            ['Schedule', status.schedule],
            ['Time Zone', status.timeZone],
          ];

          if (status.scheduleTime) {
            rows.push(['Next Run', new Date(status.scheduleTime).toLocaleString()]);
          }

          if (status.lastAttemptTime) {
            rows.push(['Last Run', new Date(status.lastAttemptTime).toLocaleString()]);
          }

          if (status.status?.code !== undefined) {
            const statusText = status.status.code === 0 ? 'Success' : `Failed (${status.status.code})`;
            rows.push(['Last Status', formatStatus(statusText)]);
          }

          if (status.status?.message) {
            rows.push(['Message', status.status.message]);
          }

          console.log(formatTable(['Field', 'Value'], rows));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Failed to get scheduler status');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to get scheduler status: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // scheduler pause
  scheduler
    .command('pause')
    .description('Pause the daily scheduler (stops automatic triggers)')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const projectId = getProjectId();
      let spinner: ReturnType<typeof createSpinner> | null = null;

      logger.info('Pausing scheduler');

      try {
        // Verify gcloud is available
        verifyGcloudAvailable();

        // Check job exists before attempting pause
        const exists = await verifyJobExists(projectId);
        if (!exists) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Scheduler job not found' }));
          } else {
            console.log(formatError(`Scheduler job '${SCHEDULER_JOB_NAME}' not found`));
            console.log(formatInfo('Deploy the scheduler first: cd infrastructure/cloud-scheduler && terraform apply'));
          }
          process.exit(1);
        }

        spinner = createSpinner('Pausing scheduler...');
        if (!jsonMode) {
          spinner.start();
        }

        execGcloud([
          'scheduler',
          'jobs',
          'pause',
          SCHEDULER_JOB_NAME,
          `--location=${SCHEDULER_LOCATION}`,
          `--project=${projectId}`,
        ]);

        if (!jsonMode && spinner) {
          spinner.stop();
        }

        if (jsonMode) {
          console.log(formatJson({ success: true, action: 'pause', job: SCHEDULER_JOB_NAME }));
        } else {
          console.log(formatSuccess(`Scheduler '${SCHEDULER_JOB_NAME}' paused`));
          console.log(formatWarning('Automatic daily triggers are now disabled'));
          console.log(formatInfo('Manual triggers via \'nexus trigger\' still work'));
          console.log(formatInfo('Resume with: nexus scheduler resume'));
        }
      } catch (error) {
        if (!jsonMode && spinner) {
          spinner.stop();
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Failed to pause scheduler');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to pause scheduler: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // scheduler resume
  scheduler
    .command('resume')
    .description('Resume the daily scheduler (enables automatic triggers)')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const projectId = getProjectId();
      let spinner: ReturnType<typeof createSpinner> | null = null;

      logger.info('Resuming scheduler');

      try {
        // Verify gcloud is available
        verifyGcloudAvailable();

        // Check job exists before attempting resume
        const exists = await verifyJobExists(projectId);
        if (!exists) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Scheduler job not found' }));
          } else {
            console.log(formatError(`Scheduler job '${SCHEDULER_JOB_NAME}' not found`));
            console.log(formatInfo('Deploy the scheduler first: cd infrastructure/cloud-scheduler && terraform apply'));
          }
          process.exit(1);
        }

        spinner = createSpinner('Resuming scheduler...');
        if (!jsonMode) {
          spinner.start();
        }

        execGcloud([
          'scheduler',
          'jobs',
          'resume',
          SCHEDULER_JOB_NAME,
          `--location=${SCHEDULER_LOCATION}`,
          `--project=${projectId}`,
        ]);

        if (!jsonMode && spinner) {
          spinner.stop();
        }

        // Get updated status to show next run time
        const status = await getSchedulerStatus();

        if (jsonMode) {
          console.log(formatJson({
            success: true,
            action: 'resume',
            job: SCHEDULER_JOB_NAME,
            nextRun: status?.scheduleTime,
          }));
        } else {
          console.log(formatSuccess(`Scheduler '${SCHEDULER_JOB_NAME}' resumed`));
          if (status?.scheduleTime) {
            console.log(formatInfo(`Next scheduled run: ${new Date(status.scheduleTime).toLocaleString()}`));
          }
        }
      } catch (error) {
        if (!jsonMode && spinner) {
          spinner.stop();
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Failed to resume scheduler');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to resume scheduler: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // scheduler run
  scheduler
    .command('run')
    .description('Manually trigger the scheduler job (uses scheduler path, not direct HTTP)')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const projectId = getProjectId();
      let spinner: ReturnType<typeof createSpinner> | null = null;

      logger.info('Triggering scheduler job');

      try {
        // Verify gcloud is available
        verifyGcloudAvailable();

        // Check job exists before attempting to run
        const exists = await verifyJobExists(projectId);
        if (!exists) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Scheduler job not found' }));
          } else {
            console.log(formatError(`Scheduler job '${SCHEDULER_JOB_NAME}' not found`));
            console.log(formatInfo('Deploy the scheduler first: cd infrastructure/cloud-scheduler && terraform apply'));
            console.log(formatInfo('Or use direct trigger: nexus trigger'));
          }
          process.exit(1);
        }

        spinner = createSpinner('Triggering scheduler job...');
        if (!jsonMode) {
          spinner.start();
        }

        execGcloud([
          'scheduler',
          'jobs',
          'run',
          SCHEDULER_JOB_NAME,
          `--location=${SCHEDULER_LOCATION}`,
          `--project=${projectId}`,
        ]);

        if (!jsonMode && spinner) {
          spinner.stop();
        }

        if (jsonMode) {
          console.log(formatJson({ success: true, action: 'run', job: SCHEDULER_JOB_NAME }));
        } else {
          console.log(formatSuccess(`Scheduler job '${SCHEDULER_JOB_NAME}' triggered`));
          console.log(formatInfo('Pipeline execution started via scheduler path'));
          console.log(formatInfo('Use \'nexus status\' to monitor progress'));
        }
      } catch (error) {
        if (!jsonMode && spinner) {
          spinner.stop();
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Failed to trigger scheduler job');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to trigger scheduler job: ${errorMessage}`));
          console.log(formatInfo('Try direct trigger with: nexus trigger'));
        }
        process.exit(1);
      }
    });
}
