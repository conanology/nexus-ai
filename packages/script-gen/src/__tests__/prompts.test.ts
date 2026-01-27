/**
 * Tests for agent prompts
 */

import { describe, it, expect } from 'vitest';
import {
  buildWriterPrompt,
  buildCriticPrompt,
  buildOptimizerPrompt,
  buildWordCountAdjustmentPrompt,
} from '../prompts.js';

describe('Agent Prompts', () => {
  const mockResearchBrief = `# Research Brief
## Overview
Comprehensive research on AI advancements.
## Technical Deep Dive
Detailed analysis of transformer architectures.`;

  const mockWriterDraft = `# AI Script
[VISUAL: Neural network animation]
Content about AI research.
[PRONOUNCE: Transformer = "trans-for-mer"]`;

  const mockCriticDraft = `## Critique
Good flow, needs more visual cues.

## Revised Script
# AI Script - Revised
[VISUAL: Neural network animation]
Enhanced content about AI research with better pacing.
[PRONOUNCE: Transformer = "trans-for-mer"]
[VISUAL: Architecture diagram]`;

  const targetWordCount = { min: 1200, max: 1800 };

  describe('buildWriterPrompt', () => {
    it('should include the research brief', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain(mockResearchBrief);
    });

    it('should specify word count requirements', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain('1200');
      expect(prompt).toContain('1800');
    });

    it('should request visual cues', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain('[VISUAL:');
      expect(prompt).toContain('30-45 seconds');
    });

    it('should request pronunciation hints', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain('[PRONOUNCE:');
    });

    it('should support custom language', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount, 'Spanish');
      expect(prompt).toContain('OUTPUT LANGUAGE: Spanish');
    });

    it('should default to English', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain('OUTPUT LANGUAGE: English');
    });

    it('should include engagement requirements', () => {
      const prompt = buildWriterPrompt(mockResearchBrief, targetWordCount);
      expect(prompt).toContain('engaging');
      expect(prompt.toLowerCase()).toContain('hook');
    });
  });

  describe('buildCriticPrompt', () => {
    it('should include the writer draft', () => {
      const prompt = buildCriticPrompt(mockWriterDraft, targetWordCount);
      expect(prompt).toContain(mockWriterDraft);
    });

    it('should specify review criteria', () => {
      const prompt = buildCriticPrompt(mockWriterDraft, targetWordCount);
      expect(prompt).toContain('Flow and Pacing');
      expect(prompt).toContain('Accuracy');
      expect(prompt).toContain('Engagement');
      expect(prompt).toContain('Visual Cues');
      expect(prompt).toContain('Pronunciation Hints');
    });

    it('should request critique and revised script', () => {
      const prompt = buildCriticPrompt(mockWriterDraft, targetWordCount);
      expect(prompt).toContain('## Critique');
      expect(prompt).toContain('## Revised Script');
    });

    it('should specify word count target', () => {
      const prompt = buildCriticPrompt(mockWriterDraft, targetWordCount);
      expect(prompt).toContain('1200-1800');
    });

    it('should support custom language', () => {
      const prompt = buildCriticPrompt(mockWriterDraft, targetWordCount, 'French');
      expect(prompt).toContain('OUTPUT LANGUAGE: French');
    });
  });

  describe('buildOptimizerPrompt', () => {
    it('should include the critic draft', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain(mockCriticDraft);
    });

    it('should focus on optimization', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain('Polish');
      expect(prompt).toContain('Pacing');
      expect(prompt).toContain('optimize');
    });

    it('should request dual output format with NARRATION and DIRECTION sections', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain('## NARRATION');
      expect(prompt).toContain('## DIRECTION');
      expect(prompt).toContain('TWO PARTS');
    });

    it('should instruct clean narration without brackets', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain('NO [VISUAL:...] tags');
      expect(prompt).toContain('NO [PRONOUNCE:...] tags');
      expect(prompt).toContain('pure narration text');
    });

    it('should include direction document schema structure', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain('"version": "2.0"');
      expect(prompt).toContain('"segments"');
      expect(prompt).toContain('"metadata"');
      expect(prompt).toContain('"globalAudio"');
    });

    it('should include timing calculation instructions', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount);
      expect(prompt).toContain('wordCount / 2.5');
      expect(prompt).toContain('150 words per minute');
    });

    it('should support custom language', () => {
      const prompt = buildOptimizerPrompt(mockCriticDraft, targetWordCount, 'German');
      expect(prompt).toContain('OUTPUT LANGUAGE: German');
    });
  });

  describe('buildWordCountAdjustmentPrompt', () => {
    it('should handle too short scripts', () => {
      const shortScript = 'Short script content.';
      const prompt = buildWordCountAdjustmentPrompt(shortScript, 1000, targetWordCount);

      expect(prompt).toContain('too short');
      expect(prompt).toContain('1000 words');
      expect(prompt).toContain('Add approximately 200 words');
      expect(prompt).toContain('Expand content');
    });

    it('should handle too long scripts', () => {
      const longScript = 'Very long script content.';
      const prompt = buildWordCountAdjustmentPrompt(longScript, 2000, targetWordCount);

      expect(prompt).toContain('too long');
      expect(prompt).toContain('2000 words');
      expect(prompt).toContain('Remove approximately 200 words');
      expect(prompt).toContain('Tighten content');
    });

    it('should preserve tags requirement', () => {
      const script = 'Script content.';
      const prompt = buildWordCountAdjustmentPrompt(script, 1000, targetWordCount);

      expect(prompt).toContain('Maintain all [VISUAL:');
      expect(prompt).toContain('[PRONOUNCE:');
    });

    it('should include target word count', () => {
      const script = 'Script content.';
      const prompt = buildWordCountAdjustmentPrompt(script, 1000, targetWordCount);

      expect(prompt).toContain('1200');
      expect(prompt).toContain('1800');
    });

    it('should support custom language', () => {
      const script = 'Script content.';
      const prompt = buildWordCountAdjustmentPrompt(script, 1000, targetWordCount, 'Italian');

      expect(prompt).toContain('OUTPUT LANGUAGE: Italian');
    });
  });
});
