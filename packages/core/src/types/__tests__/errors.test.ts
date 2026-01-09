/**
 * Type validation tests for error types
 */

import { describe, it, expect } from 'vitest';
import { ErrorSeverity } from '../errors.js';

describe('Error Types', () => {
  describe('ErrorSeverity', () => {
    it('should define all severity levels', () => {
      expect(ErrorSeverity.RETRYABLE).toBe('RETRYABLE');
      expect(ErrorSeverity.FALLBACK).toBe('FALLBACK');
      expect(ErrorSeverity.DEGRADED).toBe('DEGRADED');
      expect(ErrorSeverity.RECOVERABLE).toBe('RECOVERABLE');
      expect(ErrorSeverity.CRITICAL).toBe('CRITICAL');
    });

    it('should use enum values correctly', () => {
      const retryableError = {
        code: 'NEXUS_TTS_TIMEOUT',
        message: 'TTS request timed out',
        severity: ErrorSeverity.RETRYABLE,
      };

      expect(retryableError.severity).toBe(ErrorSeverity.RETRYABLE);
    });

    it('should distinguish between severity levels', () => {
      const severities = [
        ErrorSeverity.RETRYABLE,
        ErrorSeverity.FALLBACK,
        ErrorSeverity.DEGRADED,
        ErrorSeverity.RECOVERABLE,
        ErrorSeverity.CRITICAL,
      ];

      expect(severities).toHaveLength(5);
      expect(new Set(severities).size).toBe(5);
    });
  });
});
