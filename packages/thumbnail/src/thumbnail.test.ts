import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeThumbnail } from './thumbnail.js';
import { StageInput } from '@nexus-ai/core';
import { ThumbnailInput } from './types.js';

// Hoist mocks
const { mockExecute, mockUpload, mockDownload, mockRecordApiCall, mockGetSummary, mockCheck } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
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
        const result = await executor(providers[0]);
        return { 
            result, 
            provider: providers[0].name, 
            tier: 'primary',
            attempts: []
        };
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
            primary: { name: 'mock-image-provider', generate: mockExecute },
            fallbacks: []
        }
    }),
    getAllProviders: (chain: any) => [chain.primary, ...chain.fallbacks],
    getThumbnailPath: (date: string, variant: number) => `${date}/thumbnails/${variant}.png`
  };
});

describe('executeThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ 
        imageUrls: ['gs://bucket/2026-01-18/thumbnails/1.png'], 
        cost: 0.02,
        model: 'mock-model',
        quality: 'primary',
        generatedAt: new Date().toISOString()
    });
    mockUpload.mockResolvedValue('gs://bucket/2026-01-18/thumbnails/1.png');
    mockDownload.mockResolvedValue(Buffer.from('test'));
  });

  it('generates 3 variants and uploads them', async () => {
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

    const output = await executeThumbnail(input);

    expect(output.success).toBe(true);
    expect(output.data.variants).toHaveLength(3);
    expect(mockExecute).toHaveBeenCalledTimes(3); 
    expect(output.artifacts).toHaveLength(3);
  });
});
