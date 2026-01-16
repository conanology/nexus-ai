/**
 * Tests for pronunciation types
 */

import { describe, it, expect } from 'vitest';
import type { PronunciationEntry, AddTermInput } from '../types.js';

describe('Pronunciation Types', () => {
  describe('PronunciationEntry', () => {
    it('should accept valid entry', () => {
      const entry: PronunciationEntry = {
        term: 'mixtral',
        ipa: 'mɪkˈstrɑːl',
        ssml: '<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">mixtral</phoneme>',
        verified: true,
        source: 'seed',
        usageCount: 0,
        lastUsed: null,
        addedDate: '2026-01-01T00:00:00Z',
      };

      expect(entry.term).toBe('mixtral');
      expect(entry.source).toBe('seed');
    });

    it('should allow all source types', () => {
      const sources: Array<'seed' | 'auto' | 'manual'> = ['seed', 'auto', 'manual'];

      sources.forEach(source => {
        const entry: PronunciationEntry = {
          term: 'test',
          ipa: 'test',
          ssml: 'test',
          verified: false,
          source,
          usageCount: 0,
          lastUsed: null,
          addedDate: '2026-01-01T00:00:00Z',
        };

        expect(entry.source).toBe(source);
      });
    });

    it('should allow null lastUsed for new entries', () => {
      const entry: PronunciationEntry = {
        term: 'new',
        ipa: 'njuː',
        ssml: 'test',
        verified: false,
        source: 'manual',
        usageCount: 0,
        lastUsed: null,
        addedDate: '2026-01-01T00:00:00Z',
      };

      expect(entry.lastUsed).toBeNull();
    });

    it('should allow ISO 8601 date string for lastUsed', () => {
      const entry: PronunciationEntry = {
        term: 'used',
        ipa: 'juːzd',
        ssml: 'test',
        verified: false,
        source: 'manual',
        usageCount: 5,
        lastUsed: '2026-01-15T10:00:00Z',
        addedDate: '2026-01-01T00:00:00Z',
      };

      expect(entry.lastUsed).toBe('2026-01-15T10:00:00Z');
    });
  });

  describe('AddTermInput', () => {
    it('should accept minimal input', () => {
      const input: AddTermInput = {
        term: 'llama',
        ipa: 'ˈjɑːmə',
      };

      expect(input.term).toBe('llama');
      expect(input.ipa).toBe('ˈjɑːmə');
    });

    it('should accept optional SSML', () => {
      const input: AddTermInput = {
        term: 'claude',
        ipa: 'klɔːd',
        ssml: '<phoneme alphabet="ipa" ph="klɔːd">Claude</phoneme>',
      };

      expect(input.ssml).toBeDefined();
    });

    it('should accept optional source', () => {
      const input: AddTermInput = {
        term: 'gpt',
        ipa: 'dʒiː piː tiː',
        source: 'seed',
      };

      expect(input.source).toBe('seed');
    });

    it('should accept optional verified flag', () => {
      const input: AddTermInput = {
        term: 'bert',
        ipa: 'bɜːrt',
        verified: true,
      };

      expect(input.verified).toBe(true);
    });

    it('should accept all optional fields', () => {
      const input: AddTermInput = {
        term: 'anthropic',
        ipa: 'ænθrəˈpɪk',
        ssml: '<phoneme alphabet="ipa" ph="ænθrəˈpɪk">Anthropic</phoneme>',
        source: 'manual',
        verified: true,
      };

      expect(input).toBeDefined();
      expect(input.term).toBe('anthropic');
    });
  });
});
