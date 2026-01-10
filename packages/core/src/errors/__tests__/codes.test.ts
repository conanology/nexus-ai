import { describe, it, expect } from 'vitest';
import * as errorCodes from '../codes.js';

describe('Error Codes', () => {
  // Get all exported constants
  const codes = Object.entries(errorCodes);

  describe('Naming Convention', () => {
    it.each(codes)('%s follows NEXUS_{DOMAIN}_{TYPE} format', (_name, value) => {
      // Value should match the pattern
      expect(value).toMatch(/^NEXUS_[A-Z]+_[A-Z_]+$/);
    });

    it.each(codes)('%s has matching constant name and value', (name, value) => {
      // Constant name should equal its value
      expect(name).toBe(value);
    });
  });

  describe('Domain Coverage', () => {
    const domains = [
      'LLM',
      'TTS',
      'IMAGE',
      'STORAGE',
      'QUALITY',
      'PIPELINE',
      'NEWS',
      'SCRIPT',
      'PRONUNCIATION',
      'RENDER',
      'YOUTUBE',
      'TWITTER',
      'THUMBNAIL',
      'NOTIFICATION',
    ];

    it.each(domains)('has at least one %s domain error code', (domain) => {
      const domainCodes = codes.filter(([_, value]) =>
        (value as string).includes(`_${domain}_`)
      );
      expect(domainCodes.length).toBeGreaterThan(0);
    });
  });

  describe('Specific Error Codes', () => {
    it('exports NEXUS_UNKNOWN_ERROR for generic errors', () => {
      expect(errorCodes.NEXUS_UNKNOWN_ERROR).toBe('NEXUS_UNKNOWN_ERROR');
    });

    it('exports NEXUS_VALIDATION_ERROR for validation errors', () => {
      expect(errorCodes.NEXUS_VALIDATION_ERROR).toBe('NEXUS_VALIDATION_ERROR');
    });

    it('exports NEXUS_CONFIG_ERROR for configuration errors', () => {
      expect(errorCodes.NEXUS_CONFIG_ERROR).toBe('NEXUS_CONFIG_ERROR');
    });
  });

  describe('Required Error Codes (from Story AC)', () => {
    it('has LLM timeout and rate limit codes', () => {
      expect(errorCodes.NEXUS_LLM_TIMEOUT).toBeDefined();
      expect(errorCodes.NEXUS_LLM_RATE_LIMIT).toBeDefined();
      expect(errorCodes.NEXUS_LLM_INVALID_RESPONSE).toBeDefined();
    });

    it('has TTS timeout and synthesis codes', () => {
      expect(errorCodes.NEXUS_TTS_TIMEOUT).toBeDefined();
      expect(errorCodes.NEXUS_TTS_RATE_LIMIT).toBeDefined();
      expect(errorCodes.NEXUS_TTS_SYNTHESIS_FAILED).toBeDefined();
    });

    it('has Storage read/write codes', () => {
      expect(errorCodes.NEXUS_STORAGE_READ_FAILED).toBeDefined();
      expect(errorCodes.NEXUS_STORAGE_WRITE_FAILED).toBeDefined();
    });

    it('has Quality gate codes', () => {
      expect(errorCodes.NEXUS_QUALITY_GATE_FAIL).toBeDefined();
      expect(errorCodes.NEXUS_QUALITY_DEGRADED).toBeDefined();
    });
  });

  describe('Total Code Count', () => {
    it('has at least 30 error codes defined', () => {
      expect(codes.length).toBeGreaterThanOrEqual(30);
    });
  });
});
