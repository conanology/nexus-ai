import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeThumbnail } from './thumbnail.js';
import { StageInput } from '@nexus-ai/core';
import { ThumbnailInput } from './types.js';

// Hoist mocks
const { mockExecutePrimary, mockExecuteFallback, mockUpload, mockDownload, mockRecordApiCall, mockGetSummary, mockCheck } = vi.hoisted(() => ({
  mockExecutePrimary: vi.fn(),
  mockExecuteFallback: vi.fn(),
  mockUpload: vi.fn(),
  mockDownload: vi.fn(),
  mockRecordApiCall: vi.fn(),
  mockGetSummary: vi.fn().mockReturnValue({ totalCost: 0, breakdown: [] }),
  mockCheck: vi.fn().mockResolvedValue({ 
      status: 'PASS', 
      metrics: { variantsGenerated: 3 }, 
      warnings: [],
      stage: 'thumbnail'
  })
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<any>('@nexus-ai/core');
  return {
    ...actual,
    withRetry: async (fn: any) => {
        const result = await fn();
        return { result, attempts: 1, totalDelayMs: 0 };
    },
    withFallback: async (providers: any[], executor: any) => {
        const errors = [];
        for (const provider of providers) {
            try {
                const result = await executor(provider);
                return { 
                    result, 
                    provider: provider.name, 
                    tier: provider === providers[0] ? 'primary' : 'fallback',
                    attempts: []
                };
            } catch (e) {
                errors.push(e);
            }
        }
        throw errors[errors.length - 1];
    },
    CostTracker: vi.fn().mockImplementation(() => ({
      recordApiCall: mockRecordApiCall,
      getSummary: mockGetSummary,
    })),
    qualityGate: {
      check: mockCheck,
    },
    CloudStorageClient: vi.fn().mockImplementation(() => ({
        uploadFile: mockUpload,
        downloadFile: mockDownload,
        uploadArtifact: mockUpload,
        getPublicUrl: (path: string) => `https://storage.googleapis.com/${path}`,
        getGsUri: (path: string) => `gs://bucket/${path}`,
        parseStoragePath: (path: string) => ({ 
            date: '2026-01-18', 
            stage: 'thumbnails', 
            filename: path.split('/').pop() 
        })
    })),
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
    createProviderRegistry: () => ({
        image: {
            primary: { name: 'primary-provider', generate: mockExecutePrimary },
            fallbacks: [{ name: 'fallback-provider', generate: mockExecuteFallback }]
        }
    }),
    getAllProviders: (chain: any) => [chain.primary, ...chain.fallbacks],
    getThumbnailPath: (date: string, variant: number) => `${date}/thumbnails/${variant}.png`,
    NexusError: actual.NexusError
  };
});

describe('executeThumbnail', () => {
  const input: StageInput<ThumbnailInput> = {
    pipelineId: '2026-01-18',
    previousStage: 'script-gen',
    data: {
      topic: 'Test Video',
      visualConcept: 'A robot learning to code'
    },
    config: {
      timeout: 30000,
      retries: 3
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default success behavior
    mockExecutePrimary.mockResolvedValue({ 
        imageUrls: ['gs://bucket/2026-01-18/thumbnails/1.png'], 
        cost: 0.02,
        model: 'primary-model',
        quality: 'primary',
        generatedAt: new Date().toISOString()
    });

    mockExecuteFallback.mockResolvedValue({ 
        imageUrls: ['gs://bucket/2026-01-18/thumbnails/fallback.png'], 
        cost: 0,
        model: 'fallback-model',
        quality: 'fallback',
        generatedAt: new Date().toISOString()
    });

    mockUpload.mockResolvedValue('gs://bucket/2026-01-18/thumbnails/1.png');
    mockDownload.mockResolvedValue(Buffer.from('test'));
  });

  it('generates 3 variants using primary provider', async () => {
    const output = await executeThumbnail(input);

    expect(output.success).toBe(true);
    expect(output.data.variants).toHaveLength(3);
    expect(mockExecutePrimary).toHaveBeenCalledTimes(3); 
    expect(mockExecuteFallback).not.toHaveBeenCalled();
    expect(output.provider.tier).toBe('primary');
  });

  it('uses fallback when primary provider fails', async () => {
    // Fail the primary provider
    mockExecutePrimary.mockRejectedValue(new Error('API Error'));

    const output = await executeThumbnail(input);

    expect(output.success).toBe(true);
    expect(output.data.variants).toHaveLength(3);
    // Primary called 3 times (once per variant, failed each time)
    expect(mockExecutePrimary).toHaveBeenCalledTimes(3);
    // Fallback called 3 times
    expect(mockExecuteFallback).toHaveBeenCalledTimes(3);
    // Tier should be fallback
    expect(output.provider.tier).toBe('fallback');
  });
});
