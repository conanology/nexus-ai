/**
 * Date utility functions for CLI
 *
 * @module @nexus-ai/operator-cli/utils/date
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Validate a date string is in YYYY-MM-DD format
 */
export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Format a relative time string (e.g., "5 min ago", "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
