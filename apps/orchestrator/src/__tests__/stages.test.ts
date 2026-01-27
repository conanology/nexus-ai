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
      'timestamp-extraction',
      'visual-gen',
      'render',
      'thumbnail',
      'youtube',
      'twitter',
      'notifications',
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
      'timestamp-extraction',
      'visual-gen',
      'thumbnail',
      'youtube',
      'twitter',
      'notifications',
    ];

    expect(stageOrder).toEqual(expectedOrder);
  });

  it('should place timestamp-extraction after tts and before visual-gen', () => {
    const ttsIndex = stageOrder.indexOf('tts');
    const timestampIndex = stageOrder.indexOf('timestamp-extraction');
    const visualGenIndex = stageOrder.indexOf('visual-gen');

    expect(timestampIndex).toBe(ttsIndex + 1);
    expect(timestampIndex).toBe(visualGenIndex - 1);
  });

  it('should register timestamp-extraction as a function', () => {
    expect(stageRegistry['timestamp-extraction']).toBeDefined();
    expect(typeof stageRegistry['timestamp-extraction']).toBe('function');
  });
});
