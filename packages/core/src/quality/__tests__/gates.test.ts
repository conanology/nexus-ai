import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityGateRegistry, evaluatePublishReadiness } from '../gates.js';
import { QualityStatus, PublishDecision } from '../types.js';
import { CostTracker } from '../../observability/cost-tracker.js';

// Mock CostTracker
vi.mock('../../observability/cost-tracker.js', () => ({
  CostTracker: {
    getVideoCost: vi.fn(),
  }
}));

describe('QualityGateRegistry', () => {
  let registry: QualityGateRegistry;

  beforeEach(() => {
    registry = new QualityGateRegistry();
  });

  // ... (previous tests) ...
  it('should pass if no gate is defined for stage (default pass)', async () => {
    const result = await registry.check('unknown-stage', {});
    expect(result.status).toBe(QualityStatus.PASS);
  });

  it('should register and execute a gate', async () => {
    const mockGate = vi.fn().mockResolvedValue({
      status: QualityStatus.PASS,
      metrics: {},
      warnings: [],
      stage: 'test-stage'
    });

    registry.registerGate('test-stage', mockGate);
    
    const result = await registry.check('test-stage', { data: 'test' });
    
    expect(mockGate).toHaveBeenCalled();
    expect(result.status).toBe(QualityStatus.PASS);
  });
});

describe('evaluatePublishReadiness', () => {
  it('should return AUTO_PUBLISH when no issues and low cost', async () => {
    // Reset mock
    vi.mocked(CostTracker.getVideoCost).mockReset();
    vi.mocked(CostTracker.getVideoCost).mockResolvedValue(0.10);
    
    const pipelineState: any = {
      pipelineId: '2026-01-08',
      errors: [],
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: [],
        flags: []
      }
    };

    const result = await evaluatePublishReadiness(pipelineState);
    expect(result.decision).toBe(PublishDecision.AUTO_PUBLISH);
  });

  it('should return HUMAN_REVIEW if critical errors exist', async () => {
    vi.mocked(CostTracker.getVideoCost).mockResolvedValue(0.10);
    
    const pipelineState: any = {
      pipelineId: '2026-01-08',
      errors: [
        { severity: 'CRITICAL', message: 'Something broke', stage: 'tts' }
      ],
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: [],
        flags: []
      }
    };

    const result = await evaluatePublishReadiness(pipelineState);
    expect(result.decision).toBe(PublishDecision.HUMAN_REVIEW);
  });

  it('should return HUMAN_REVIEW if cost exceeds limit', async () => {
    vi.mocked(CostTracker.getVideoCost).mockResolvedValue(2.00);
    
    const pipelineState: any = {
      pipelineId: '2026-01-08',
      errors: [],
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: [],
        flags: []
      }
    };

    const result = await evaluatePublishReadiness(pipelineState);
    // Debug info if fails
    if (result.decision !== PublishDecision.HUMAN_REVIEW) {
      console.log('Issues:', JSON.stringify(result.issues, null, 2));
    }
    expect(result.decision).toBe(PublishDecision.HUMAN_REVIEW);
  });

  it('should return AUTO_PUBLISH_WITH_WARNING if minor fallbacks used (non-TTS)', async () => {
    vi.mocked(CostTracker.getVideoCost).mockResolvedValue(0.10);
    
    const pipelineState: any = {
      pipelineId: '2026-01-08',
      errors: [],
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: ['thumbnail:template'], // Non-TTS fallback
        flags: []
      }
    };

    const result = await evaluatePublishReadiness(pipelineState);
    expect(result.decision).toBe(PublishDecision.AUTO_PUBLISH_WITH_WARNING);
  });
});

describe('Default Gates', () => {
  let registry: QualityGateRegistry;

  beforeEach(() => {
    registry = new QualityGateRegistry();
  });

  describe('script-gen', () => {
    it('should PASS if word count is within range (1200-1800)', async () => {
      const result = await registry.check('script-gen', { data: { wordCount: 1500 } });
      expect(result.status).toBe(QualityStatus.PASS);
    });

    it('should FAIL if word count is too low', async () => {
      const result = await registry.check('script-gen', { data: { wordCount: 1000 } });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('outside range');
    });

    it('should FAIL if word count is too high', async () => {
      const result = await registry.check('script-gen', { data: { wordCount: 2000 } });
      expect(result.status).toBe(QualityStatus.FAIL);
    });
  });

  describe('tts', () => {
    it('should PASS if silence < 5% and no clipping', async () => {
      const result = await registry.check('tts', { 
        quality: { measurements: { silencePct: 4, clippingDetected: false } } 
      });
      expect(result.status).toBe(QualityStatus.PASS);
    });

    it('should FAIL if silence >= 5%', async () => {
      const result = await registry.check('tts', { 
        quality: { measurements: { silencePct: 5, clippingDetected: false } } 
      });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('Silence percentage');
    });

    it('should FAIL if clipping detected', async () => {
      const result = await registry.check('tts', { 
        quality: { measurements: { silencePct: 1, clippingDetected: true } } 
      });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('Clipping detected');
    });
  });

  describe('render', () => {
    it('should PASS if no frame drops and sync < 100ms', async () => {
      const result = await registry.check('render', { 
        quality: { measurements: { frameDrops: 0, audioSyncMs: 50 } } 
      });
      expect(result.status).toBe(QualityStatus.PASS);
    });

    it('should FAIL if frame drops > 0', async () => {
      const result = await registry.check('render', { 
        quality: { measurements: { frameDrops: 1, audioSyncMs: 50 } } 
      });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('frame drops');
    });

    it('should FAIL if audio sync >= 100ms', async () => {
      const result = await registry.check('render', { 
        quality: { measurements: { frameDrops: 0, audioSyncMs: 100 } } 
      });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('sync offset');
    });
  });

  describe('thumbnail', () => {
    it('should PASS if 3 variants', async () => {
      const result = await registry.check('thumbnail', { data: { variants: [1, 2, 3] } });
      expect(result.status).toBe(QualityStatus.PASS);
    });

    it('should FAIL if not 3 variants', async () => {
      const result = await registry.check('thumbnail', { data: { variants: [1, 2] } });
      expect(result.status).toBe(QualityStatus.FAIL);
      expect(result.reason).toContain('Expected 3');
    });
  });
});
