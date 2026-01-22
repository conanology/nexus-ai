#!/usr/bin/env node
/**
 * NEXUS-AI Operator CLI - Entry point
 *
 * @module @nexus-ai/operator-cli
 */

import { program } from './cli.js';

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
