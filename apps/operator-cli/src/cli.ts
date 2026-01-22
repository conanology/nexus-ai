/**
 * NEXUS-AI Operator CLI - Commander program setup
 *
 * @module @nexus-ai/operator-cli/cli
 */

import { Command } from 'commander';
import { verifyAuth } from './utils/auth.js';
import { registerTriggerCommand } from './commands/trigger.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCostsCommand } from './commands/costs.js';
import { registerBufferCommand } from './commands/buffer.js';
import { registerPronunciationCommand } from './commands/pronunciation.js';
import { registerReviewCommand } from './commands/review.js';
import { registerRetryCommand } from './commands/retry.js';

const VERSION = '1.0.0';

export const program = new Command()
  .name('nexus')
  .description('NEXUS-AI pipeline operator CLI')
  .version(VERSION)
  .option('--json', 'Output as JSON for scripting')
  .hook('preAction', async () => {
    // Verify GCP auth before any command
    await verifyAuth();
  });

// Register all commands
registerTriggerCommand(program);
registerStatusCommand(program);
registerCostsCommand(program);
registerBufferCommand(program);
registerPronunciationCommand(program);
registerReviewCommand(program);
registerRetryCommand(program);
