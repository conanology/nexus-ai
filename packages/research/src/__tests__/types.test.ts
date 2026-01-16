/**
 * Tests for research types
 */

import { describe, it, expect } from 'vitest';
import type { ResearchInput, ResearchOutput, ResearchPromptConfig } from '../types.js';

describe('Research Types', () => {
  describe('ResearchInput', () => {
    it('should accept valid research input', () => {
      const input: ResearchInput = {
        topic: {
          url: 'https://github.com/trending',
          title: 'AI Breakthrough',
          description: 'A new AI research paper',
          source: 'github-trending',
          metadata: {
            stars: 1000,
          },
        },
      };

      expect(input.topic.url).toBe('https://github.com/trending');
      expect(input.topic.title).toBe('AI Breakthrough');
      expect(input.topic.description).toBe('A new AI research paper');
      expect(input.topic.source).toBe('github-trending');
      expect(input.topic.metadata).toEqual({ stars: 1000 });
    });

    it('should allow optional fields to be omitted', () => {
      const input: ResearchInput = {
        topic: {
          url: 'https://example.com',
          title: 'Test Topic',
        },
      };

      expect(input.topic.url).toBe('https://example.com');
      expect(input.topic.title).toBe('Test Topic');
      expect(input.topic.description).toBeUndefined();
      expect(input.topic.source).toBeUndefined();
      expect(input.topic.metadata).toBeUndefined();
    });
  });

  describe('ResearchOutput', () => {
    it('should accept valid research output', () => {
      const output: ResearchOutput = {
        brief: '## Research Brief\n\nThis is a comprehensive research brief.',
        wordCount: 2000,
        artifactUrl: 'gs://nexus-ai-artifacts/2026-01-16/research/research.md',
        provider: {
          name: 'gemini-3-pro-preview',
          tier: 'primary',
          attempts: 1,
        },
      };

      expect(output.brief).toContain('Research Brief');
      expect(output.wordCount).toBe(2000);
      expect(output.artifactUrl).toMatch(/^gs:\/\//);
      expect(output.provider.name).toBe('gemini-3-pro-preview');
      expect(output.provider.tier).toBe('primary');
      expect(output.provider.attempts).toBe(1);
    });

    it('should allow fallback tier in provider', () => {
      const output: ResearchOutput = {
        brief: 'Research content',
        wordCount: 1800,
        artifactUrl: 'gs://bucket/path',
        provider: {
          name: 'gemini-2.5-pro',
          tier: 'fallback',
          attempts: 2,
        },
      };

      expect(output.provider.tier).toBe('fallback');
      expect(output.provider.attempts).toBe(2);
    });
  });

  describe('ResearchPromptConfig', () => {
    it('should accept valid prompt config', () => {
      const config: ResearchPromptConfig = {
        url: 'https://example.com',
        title: 'Test Topic',
        description: 'A test description',
        metadata: {
          source: 'test',
        },
      };

      expect(config.url).toBe('https://example.com');
      expect(config.title).toBe('Test Topic');
      expect(config.description).toBe('A test description');
      expect(config.metadata).toEqual({ source: 'test' });
    });

    it('should allow optional fields to be omitted', () => {
      const config: ResearchPromptConfig = {
        url: 'https://example.com',
        title: 'Test Topic',
      };

      expect(config.url).toBe('https://example.com');
      expect(config.title).toBe('Test Topic');
      expect(config.description).toBeUndefined();
      expect(config.metadata).toBeUndefined();
    });
  });
});
