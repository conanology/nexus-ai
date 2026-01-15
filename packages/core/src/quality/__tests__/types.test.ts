import { describe, it, expect } from 'vitest';
import { QualityStatus, PublishDecision } from '../types.js';

describe('Quality Types', () => {
  it('should have QualityStatus enum defined', () => {
    expect(QualityStatus.PASS).toBe('PASS');
    expect(QualityStatus.WARN).toBe('WARN');
    expect(QualityStatus.FAIL).toBe('FAIL');
  });

  it('should have PublishDecision enum defined', () => {
    expect(PublishDecision.AUTO_PUBLISH).toBe('AUTO_PUBLISH');
    expect(PublishDecision.AUTO_PUBLISH_WITH_WARNING).toBe('AUTO_PUBLISH_WITH_WARNING');
    expect(PublishDecision.HUMAN_REVIEW).toBe('HUMAN_REVIEW');
  });
});
