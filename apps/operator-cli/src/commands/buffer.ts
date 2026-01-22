/**
 * Buffer command - manage buffer videos
 *
 * @module @nexus-ai/operator-cli/commands/buffer
 */

import type { Command } from 'commander';
import {
  createLogger,
  listAvailableBuffers,
  deployBuffer,
  createBufferVideo,
  getBufferHealthStatus,
  BUFFER_THRESHOLDS,
  type BufferVideo,
} from '@nexus-ai/core';
import { formatRelativeTime, getToday } from '../utils/date.js';
import {
  formatTable,
  formatJson,
  formatError,
  formatSuccess,
  formatInfo,
  formatStatus,
  formatWarning,
  createSpinner,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.buffer');

export function registerBufferCommand(program: Command): void {
  const buffer = program
    .command('buffer')
    .description('Manage buffer videos');

  // List subcommand
  buffer
    .command('list')
    .description('List available buffer videos')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info('Listing buffer videos');

      try {
        const buffers = await listAvailableBuffers();

        if (jsonMode) {
          console.log(formatJson({ buffers, count: buffers.length }));
          return;
        }

        if (buffers.length === 0) {
          console.log(formatInfo('No buffer videos available'));
          console.log('  Use \'nexus buffer create "Topic"\' to create one');
          return;
        }

        console.log(`\nBuffer Videos (${buffers.length} available)`);
        console.log('─'.repeat(60));

        const rows = buffers.map((b: BufferVideo) => [
          b.id.slice(0, 8),
          b.topic.slice(0, 30) + (b.topic.length > 30 ? '...' : ''),
          formatRelativeTime(b.createdDate),
          b.status,
        ]);

        console.log(formatTable(['ID', 'Topic', 'Created', 'Status'], rows));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Buffer list failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to list buffers: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Deploy subcommand
  buffer
    .command('deploy')
    .description('Deploy a buffer video for today')
    .option('-i, --id <id>', 'Specific buffer ID to deploy')
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(async (options: { id?: string; yes?: boolean }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ bufferId: options.id }, 'Deploying buffer video');

      try {
        // Get available buffers
        const buffers = await listAvailableBuffers();

        if (buffers.length === 0) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'No buffers available' }));
          } else {
            console.error(formatError('No buffer videos available to deploy'));
          }
          process.exit(1);
        }

        // Select buffer
        let selectedBuffer: BufferVideo;
        if (options.id) {
          const found = buffers.find((b: BufferVideo) => b.id.startsWith(options.id!));
          if (!found) {
            if (jsonMode) {
              console.log(formatJson({ success: false, error: 'Buffer not found' }));
            } else {
              console.error(formatError(`Buffer with ID starting with '${options.id}' not found`));
            }
            process.exit(1);
          }
          selectedBuffer = found;
        } else {
          // Use first available buffer
          selectedBuffer = buffers[0]!;
        }

        if (!options.yes && !jsonMode) {
          console.log(formatWarning('About to deploy buffer video:'));
          console.log(`  ID: ${selectedBuffer.id}`);
          console.log(`  Topic: ${selectedBuffer.topic}`);
          console.log(`  Title: ${selectedBuffer.title}`);
          console.log('');
          console.log('  This action cannot be undone.');
          console.log('  Use --yes flag to skip this confirmation.');
          // In a real implementation, we'd use readline to prompt
          // For now, we require --yes flag
          process.exit(0);
        }

        const spinner = createSpinner('Deploying buffer video...');
        if (!jsonMode) {
          spinner.start();
        }

        const result = await deployBuffer(selectedBuffer.id, getToday());

        if (!jsonMode) {
          spinner.stop();
        }

        if (jsonMode) {
          console.log(formatJson({ ...result }));
        } else {
          if (result.success) {
            console.log(formatSuccess('Buffer video deployed successfully'));
            console.log(`  Video ID: ${result.videoId}`);
            console.log(`  Scheduled for: ${result.scheduledTime}`);
          } else {
            console.error(formatError(`Deployment failed: ${result.error}`));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Buffer deploy failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to deploy buffer: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Create subcommand
  buffer
    .command('create <topic>')
    .description('Create a new buffer video')
    .option('-v, --video-id <id>', 'YouTube video ID')
    .option('-t, --title <title>', 'Video title')
    .action(async (topic: string, options: { videoId?: string; title?: string }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      // For now, video ID and title are required
      if (!options.videoId || !options.title) {
        if (jsonMode) {
          console.log(formatJson({
            success: false,
            error: 'Both --video-id and --title are required',
          }));
        } else {
          console.error(formatError('Both --video-id and --title are required'));
          console.log('  Usage: nexus buffer create "Topic" --video-id <id> --title "Title"');
        }
        process.exit(1);
      }

      logger.info({ topic, videoId: options.videoId }, 'Creating buffer video');

      try {
        const spinner = createSpinner('Creating buffer video...');
        if (!jsonMode) {
          spinner.start();
        }

        const buffer = await createBufferVideo({
          videoId: options.videoId,
          topic,
          title: options.title,
          durationSec: 0, // Will be fetched from YouTube
          source: 'manual',
        });

        if (!jsonMode) {
          spinner.stop();
        }

        if (jsonMode) {
          console.log(formatJson({ success: true, buffer }));
        } else {
          console.log(formatSuccess('Buffer video created'));
          console.log(`  ID: ${buffer.id}`);
          console.log(`  Topic: ${buffer.topic}`);
          console.log(`  Video ID: ${buffer.videoId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Buffer create failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to create buffer: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Health subcommand
  buffer
    .command('health')
    .description('Show buffer system health status')
    .action(async () => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info('Checking buffer health');

      try {
        const health = await getBufferHealthStatus();

        if (jsonMode) {
          console.log(formatJson(health));
          return;
        }

        console.log('\nBuffer System Health');
        console.log('─'.repeat(40));

        const statusText = formatStatus(health.status);
        console.log(`Status: ${statusText}`);
        console.log(`Total: ${health.totalCount}`);
        console.log(`Available: ${health.availableCount}`);
        console.log(`Deployed: ${health.deployedCount}`);
        console.log(`Minimum required: ${BUFFER_THRESHOLDS.MINIMUM_COUNT}`);

        if (health.belowMinimumThreshold) {
          console.log('');
          console.log(formatWarning('Buffer system is critically low!'));
          console.log('  Create buffer videos to ensure channel reliability.');
        } else if (health.belowWarningThreshold) {
          console.log('');
          console.log(formatWarning('Buffer system is below optimal levels.'));
          console.log('  Consider creating additional buffer videos.');
        }

        console.log('');
        console.log(`Last checked: ${formatRelativeTime(health.lastChecked)}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Buffer health check failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to check buffer health: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
