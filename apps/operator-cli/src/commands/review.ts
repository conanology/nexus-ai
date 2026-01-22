/**
 * Review command - manage human review queue
 *
 * @module @nexus-ai/operator-cli/commands/review
 */

import type { Command } from 'commander';
import {
  createLogger,
  getReviewQueue,
  getReviewItem,
  resolveReviewItem,
  dismissReviewItem,
  skipTopic,
  requeueTopicFromReview,
  type ReviewItem,
  type ReviewItemType,
  type ReviewQueueFilters,
} from '@nexus-ai/core';
import { formatRelativeTime } from '../utils/date.js';
import {
  formatTable,
  formatJson,
  formatError,
  formatSuccess,
  formatInfo,
  formatStatus,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.review');

export function registerReviewCommand(program: Command): void {
  const review = program
    .command('review')
    .description('Manage human review queue');

  // List subcommand
  review
    .command('list')
    .description('List pending review items')
    .option('-t, --type <type>', 'Filter by type (pronunciation|quality|controversial)')
    .option('-l, --limit <n>', 'Limit results', '20')
    .action(async (options: { type?: string; limit?: string }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const limit = parseInt(options.limit ?? '20', 10);

      logger.info({ type: options.type, limit }, 'Listing review items');

      try {
        const filter: ReviewQueueFilters = { status: 'pending' };
        if (options.type) {
          filter.type = options.type as ReviewItemType;
        }

        const allItems = await getReviewQueue(filter);
        const items = allItems.slice(0, limit);

        if (jsonMode) {
          console.log(formatJson({ items, count: items.length }));
          return;
        }

        if (items.length === 0) {
          console.log(formatInfo('No pending review items'));
          return;
        }

        console.log(`\nPending Review Items (${items.length})`);
        console.log('─'.repeat(80));

        const rows = items.map((item: ReviewItem) => [
          item.id.slice(0, 8),
          item.type,
          item.stage,
          item.pipelineId,
          formatRelativeTime(item.createdAt),
        ]);

        console.log(formatTable(['ID', 'Type', 'Stage', 'Pipeline', 'Created'], rows));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review list failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to list items: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Show subcommand
  review
    .command('show <id>')
    .description('Show full details of a review item')
    .action(async (id: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ id }, 'Showing review item');

      try {
        const item = await getReviewItem(id);

        if (!item) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Item not found' }));
          } else {
            console.error(formatError(`Review item with ID '${id}' not found`));
          }
          process.exit(1);
        }

        if (jsonMode) {
          console.log(formatJson(item));
          return;
        }

        console.log('\nReview Item Details');
        console.log('─'.repeat(50));
        console.log(`ID: ${item.id}`);
        console.log(`Type: ${item.type}`);
        console.log(`Stage: ${item.stage}`);
        console.log(`Status: ${formatStatus(item.status)}`);
        console.log(`Pipeline: ${item.pipelineId}`);
        console.log(`Created: ${formatRelativeTime(item.createdAt)}`);
        console.log('');
        console.log('Item:');
        console.log(JSON.stringify(item.item, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

        if (item.context) {
          console.log('');
          console.log('Context:');
          console.log(JSON.stringify(item.context, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review show failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to get item: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Resolve subcommand
  review
    .command('resolve <id>')
    .description('Resolve a review item')
    .option('-n, --note <text>', 'Resolution note')
    .action(async (id: string, options: { note?: string }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ id }, 'Resolving review item');

      try {
        const item = await getReviewItem(id);
        if (!item) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Item not found' }));
          } else {
            console.error(formatError(`Review item with ID '${id}' not found`));
          }
          process.exit(1);
        }

        await resolveReviewItem(id, options.note ?? 'Resolved via CLI', 'cli');

        if (jsonMode) {
          console.log(formatJson({ success: true, id, resolution: 'resolved' }));
        } else {
          console.log(formatSuccess(`Resolved review item ${id.slice(0, 8)}`));
          if (options.note) {
            console.log(`  Note: ${options.note}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review resolve failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to resolve: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Dismiss subcommand
  review
    .command('dismiss <id>')
    .description('Dismiss a review item')
    .requiredOption('-r, --reason <text>', 'Reason for dismissal')
    .action(async (id: string, options: { reason: string }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ id, reason: options.reason }, 'Dismissing review item');

      try {
        const item = await getReviewItem(id);
        if (!item) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Item not found' }));
          } else {
            console.error(formatError(`Review item with ID '${id}' not found`));
          }
          process.exit(1);
        }

        await dismissReviewItem(id, options.reason, 'cli');

        if (jsonMode) {
          console.log(formatJson({ success: true, id, resolution: 'dismissed', reason: options.reason }));
        } else {
          console.log(formatSuccess(`Dismissed review item ${id.slice(0, 8)}`));
          console.log(`  Reason: ${options.reason}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review dismiss failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to dismiss: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Skip subcommand
  review
    .command('skip <id>')
    .description('Skip topic (for controversial/topic review items)')
    .action(async (id: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ id }, 'Skipping topic from review');

      try {
        const item = await getReviewItem(id);
        if (!item) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Item not found' }));
          } else {
            console.error(formatError(`Review item with ID '${id}' not found`));
          }
          process.exit(1);
        }

        if (item.type !== 'controversial' && item.type !== 'topic') {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Skip only works for controversial/topic items' }));
          } else {
            console.error(formatError('Skip command only works for controversial or topic review items'));
          }
          process.exit(1);
        }

        await skipTopic(id, 'cli');

        if (jsonMode) {
          console.log(formatJson({ success: true, id, action: 'skipped' }));
        } else {
          console.log(formatSuccess(`Skipped topic for review item ${id.slice(0, 8)}`));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review skip failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to skip: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Requeue subcommand
  review
    .command('requeue <id>')
    .description('Requeue topic for tomorrow')
    .action(async (id: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ id }, 'Requeuing topic from review');

      try {
        const item = await getReviewItem(id);
        if (!item) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Item not found' }));
          } else {
            console.error(formatError(`Review item with ID '${id}' not found`));
          }
          process.exit(1);
        }

        // Requeue for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0]!;

        await requeueTopicFromReview(id, tomorrowStr, 'cli');

        if (jsonMode) {
          console.log(formatJson({ success: true, id, action: 'requeued' }));
        } else {
          console.log(formatSuccess(`Requeued topic for review item ${id.slice(0, 8)}`));
          console.log('  Topic will be used in a future pipeline run.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Review requeue failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to requeue: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
