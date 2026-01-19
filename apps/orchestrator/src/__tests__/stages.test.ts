import { describe, it, expect } from 'vitest';
import { stageRegistry, stageOrder } from '../stages.js';

describe('Stage Registry', () => {
  it('should export stage registry with all stages', () => {
    expect(stageRegistry).toBeDefined();
    expect(typeof stageRegistry).toBe('object');
  });

  it('should have correct stage keys', () => {
    const expectedStages = [
      'news-sourcing',
      'research',
      'script-gen',
      'pronunciation',
      'tts',
      'visual-gen',
      'thumbnail',
      'youtube',
      'twitter',
    ];

    expectedStages.forEach((stage) => {
      expect(stageRegistry[stage]).toBeDefined();
      expect(typeof stageRegistry[stage]).toBe('function');
    });
  });

  it('should export stage execution order', () => {
    expect(stageOrder).toBeDefined();
    expect(Array.isArray(stageOrder)).toBe(true);
    expect(stageOrder.length).toBeGreaterThan(0);
  });

  it('should have stage order matching registry keys', () => {
    stageOrder.forEach((stage) => {
      expect(stageRegistry[stage]).toBeDefined();
    });
  });

  it('should have stages in correct order', () => {
    const expectedOrder = [
      'news-sourcing',
      'research',
      'script-gen',
      'pronunciation',
      'tts',
      'visual-gen',
      'thumbnail',
      'youtube',
      'twitter',
    ];

    expect(stageOrder).toEqual(expectedOrder);
  });
});
