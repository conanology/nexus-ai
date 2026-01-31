/**
 * Tests for SceneMapper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneMapper } from '../scene-mapper.js';
import type { VisualCue } from '../types.js';

describe('SceneMapper', () => {
  let mapper: SceneMapper;

  beforeEach(() => {
    mapper = new SceneMapper();
  });

  describe('keyword matching', () => {
    it('should map neural network keywords to NeuralNetworkAnimation', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'neural network animation',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('NeuralNetworkAnimation');
    });

    it('should map NN abbreviation to NeuralNetworkAnimation', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'NN diagram',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('NeuralNetworkAnimation');
    });

    it('should map transformer to NeuralNetworkAnimation', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'transformer architecture',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('NeuralNetworkAnimation');
    });

    it('should map data flow keywords to DataFlowDiagram', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'data flow through the pipeline',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('DataFlowDiagram');
    });

    it('should map pipeline to DataFlowDiagram', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'pipeline visualization',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('DataFlowDiagram');
    });

    it('should map process to DataFlowDiagram', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'process diagram',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('DataFlowDiagram');
    });

    it('should map comparison keywords to ComparisonChart', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'comparison of methods',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('ComparisonChart');
    });

    it('should map vs to ComparisonChart', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'method A vs method B',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('ComparisonChart');
    });

    it('should map side by side to ComparisonChart', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'side by side comparison',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('ComparisonChart');
    });

    it('should map metrics keywords to MetricsCounter', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'show metrics',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('MetricsCounter');
    });

    it('should map stats to MetricsCounter', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'stats display',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('MetricsCounter');
    });

    it('should map numbers to MetricsCounter', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'numbers counter',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('MetricsCounter');
    });

    it('should map product keywords to ProductMockup', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'product interface',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('ProductMockup');
    });

    it('should map mockup to ProductMockup', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'UI mockup',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('ProductMockup');
    });

    it('should map code keywords to CodeHighlight', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'code example',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('CodeHighlight');
    });

    it('should map snippet to CodeHighlight', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'code snippet',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('CodeHighlight');
    });

    it('should map transition keywords to BrandedTransition', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'transition effect',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('BrandedTransition');
    });

    it('should map wipe to BrandedTransition', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'wipe effect',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('BrandedTransition');
    });
  });

  describe('props extraction', () => {
    it('should extract title from description', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'neural network for image classification',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.props.title).toBeDefined();
    });

    it('should include empty props object when no specific props needed', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'transition',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.props).toBeDefined();
    });
  });

  describe('scene mapping structure', () => {
    it('should return SceneMapping with component and props', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'neural network',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;

      expect(mapping).toHaveProperty('component');
      expect(mapping).toHaveProperty('props');
      expect(mapping).toHaveProperty('duration');
      expect(mapping).toHaveProperty('startTime');
      expect(mapping).toHaveProperty('endTime');
    });

    it('should set default duration and timing', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'metrics',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;

      expect(mapping.duration).toBe(30);
      expect(mapping.startTime).toBe(0);
      expect(mapping.endTime).toBe(30);
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase keywords', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'NEURAL NETWORK',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('NeuralNetworkAnimation');
    });

    it('should handle mixed case keywords', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'Data Flow Diagram',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;
      expect(mapping.component).toBe('DataFlowDiagram');
    });
  });

  describe('fallback behavior', () => {
    it('should return null when no keyword matches (for LLM fallback)', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'some unknown visualization type',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCue(cue);
      expect(mapping).toBeNull();
    });

    it('should map to LowerThird fallback when no keyword match found', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'some unknown visual cue for fallback',
        context: 'test context',
        position: 0
      };

      // Use the fallback method instead of regular mapCue
      const mapping = await mapper.mapCueWithFallback(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;

      expect(mapping.component).toBe('LowerThird');
      expect(mapping.props.text).toBe('some unknown visual cue for fallback');
    });

    it('should pass cue text as text prop to LowerThird', async () => {
      const cue: VisualCue = {
        index: 0,
        description: 'special message for display',
        context: 'test',
        position: 0
      };

      const mapping = await mapper.mapCueWithFallback(cue);
      expect(mapping).not.toBeNull();
      if (!mapping) return;

      expect(mapping.component).toBe('LowerThird');
      expect(mapping.props.text).toBe('special message for display');
    });
  });
});
