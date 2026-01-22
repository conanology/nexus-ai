/**
 * Output formatting utilities for CLI
 *
 * @module @nexus-ai/operator-cli/utils/output
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { type Ora } from 'ora';

/**
 * Format data as a table for terminal output
 */
export function formatTable(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(row.map((cell) => String(cell ?? '')));
  }

  return table.toString();
}

/**
 * Format data as JSON with pretty printing
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Create a spinner with the given text
 */
export function createSpinner(text: string): Ora {
  return ora(text);
}

/**
 * Format a success message with green checkmark
 */
export function formatSuccess(message: string): string {
  return `${chalk.green('✔')} ${message}`;
}

/**
 * Format an error message with red X
 */
export function formatError(message: string): string {
  return `${chalk.red('✖')} ${message}`;
}

/**
 * Format a warning message with yellow warning symbol
 */
export function formatWarning(message: string): string {
  return `${chalk.yellow('⚠')} ${message}`;
}

/**
 * Format an info message with blue info symbol
 */
export function formatInfo(message: string): string {
  return `${chalk.blue('ℹ')} ${message}`;
}

/**
 * Color coding for cost values
 */
export function formatCost(cost: number): string {
  const formatted = `$${cost.toFixed(2)}`;
  if (cost < 0.5) {
    return chalk.green(formatted);
  }
  if (cost < 0.75) {
    return chalk.yellow(formatted);
  }
  return chalk.red(formatted);
}

/**
 * Format status with appropriate color
 */
export function formatStatus(status: string): string {
  const statusLower = status.toLowerCase();
  if (
    statusLower === 'success' ||
    statusLower === 'completed' ||
    statusLower === 'healthy'
  ) {
    return chalk.green(status);
  }
  if (statusLower === 'running' || statusLower === 'in-progress') {
    return chalk.blue(status);
  }
  if (statusLower === 'warning' || statusLower === 'degraded') {
    return chalk.yellow(status);
  }
  if (
    statusLower === 'failed' ||
    statusLower === 'error' ||
    statusLower === 'critical'
  ) {
    return chalk.red(status);
  }
  return status;
}

/**
 * Output function that respects JSON mode
 */
export function output(data: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(formatJson(data));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(formatJson(data));
  }
}
