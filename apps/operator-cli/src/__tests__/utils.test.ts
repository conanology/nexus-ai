/**
 * Utility functions tests
 *
 * @module @nexus-ai/operator-cli/__tests__/utils
 */

import { describe, it, expect } from 'vitest';
import {
  getToday,
  isValidDate,
  formatRelativeTime,
  formatDuration,
} from '../utils/date.js';
import {
  formatTable,
  formatJson,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  formatCost,
  formatStatus,
} from '../utils/output.js';

describe('Date Utilities', () => {
  describe('getToday', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = getToday();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid YYYY-MM-DD format', () => {
      expect(isValidDate('2026-01-22')).toBe(true);
      expect(isValidDate('2025-12-31')).toBe(true);
      expect(isValidDate('2024-01-01')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(isValidDate('2026/01/22')).toBe(false);
      expect(isValidDate('01-22-2026')).toBe(false);
      expect(isValidDate('2026-1-22')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent time as "just now"', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinAgo)).toBe('5 mins ago');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('should handle string dates', () => {
      const recent = new Date().toISOString();
      expect(formatRelativeTime(recent)).toBe('just now');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(30000)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3660000)).toBe('1h 1m');
      expect(formatDuration(7200000)).toBe('2h 0m');
    });
  });
});

describe('Output Utilities', () => {
  describe('formatTable', () => {
    it('should format data as a table', () => {
      const result = formatTable(['Name', 'Value'], [['foo', '1'], ['bar', '2']]);
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle empty rows', () => {
      const result = formatTable(['A', 'B'], []);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('formatJson', () => {
    it('should format data as pretty JSON', () => {
      const data = { foo: 'bar', num: 42 };
      const result = formatJson(data);
      expect(JSON.parse(result)).toEqual(data);
      expect(result).toContain('\n'); // Pretty printed
    });
  });

  describe('formatSuccess', () => {
    it('should include green checkmark', () => {
      const result = formatSuccess('Done');
      expect(result).toContain('✔');
      expect(result).toContain('Done');
    });
  });

  describe('formatError', () => {
    it('should include red X', () => {
      const result = formatError('Failed');
      expect(result).toContain('✖');
      expect(result).toContain('Failed');
    });
  });

  describe('formatWarning', () => {
    it('should include warning symbol', () => {
      const result = formatWarning('Caution');
      expect(result).toContain('⚠');
      expect(result).toContain('Caution');
    });
  });

  describe('formatInfo', () => {
    it('should include info symbol', () => {
      const result = formatInfo('Info');
      expect(result).toContain('ℹ');
      expect(result).toContain('Info');
    });
  });

  describe('formatCost', () => {
    it('should format low costs in green', () => {
      const result = formatCost(0.25);
      expect(result).toContain('$0.25');
    });

    it('should format medium costs in yellow', () => {
      const result = formatCost(0.60);
      expect(result).toContain('$0.60');
    });

    it('should format high costs in red', () => {
      const result = formatCost(1.00);
      expect(result).toContain('$1.00');
    });
  });

  describe('formatStatus', () => {
    it('should format success statuses in green', () => {
      expect(formatStatus('success')).toContain('success');
      expect(formatStatus('completed')).toContain('completed');
    });

    it('should format running statuses in blue', () => {
      expect(formatStatus('running')).toContain('running');
      expect(formatStatus('in-progress')).toContain('in-progress');
    });

    it('should format failed statuses in red', () => {
      expect(formatStatus('failed')).toContain('failed');
      expect(formatStatus('error')).toContain('error');
    });
  });
});
