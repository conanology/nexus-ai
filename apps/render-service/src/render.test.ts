import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderService } from './render.js';

const fsMock = vi.hoisted(() => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/nexus-render-123'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((path: any) => {
    if (path && path.toString().endsWith('timeline.json')) return JSON.stringify({ scenes: [] });
    return Buffer.from('mock-video-content');
  }),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 * 1024 }), // 1MB
}));

const clientSpies = vi.hoisted(() => ({
  downloadFile: vi.fn().mockResolvedValue(Buffer.from('mock-content')),
  uploadFile: vi.fn().mockResolvedValue('gs://bucket/output.mp4'),
  uploadStream: vi.fn().mockResolvedValue('gs://bucket/output.mp4'),
}));

vi.mock('fs/promises', () => ({ default: fsMock }));
vi.mock('node:fs/promises', () => ({ default: fsMock }));
vi.mock('fs', () => ({
  createReadStream: vi.fn().mockReturnValue({
    pipe: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation(function(this: any, event, cb) {
        if (event === 'finish') cb();
        return this;
      })
    })
  })
}));

// Mocks
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>('@nexus-ai/core');
  return {
    ...actual,
    CloudStorageClient: vi.fn().mockImplementation(() => clientSpies),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
  };
});

vi.mock('@remotion/renderer', () => ({
  renderMedia: vi.fn().mockResolvedValue(undefined),
  selectComposition: vi.fn().mockResolvedValue({
    durationInFrames: 300,
    fps: 30
  })
}));

vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/tmp/bundle'),
}));

describe('RenderService', () => {
  let service: RenderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RenderService();
  });

  it('should execute full render workflow', async () => {
    const input = {
      pipelineId: '2024-01-01',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p'
    };

    const result = await service.renderVideo(input);

    expect(result).toEqual({
      videoUrl: 'gs://bucket/output.mp4',
      duration: 10, // 300 / 30
      fileSize: 1024 * 1024,
    });

    // Verify CloudStorage interactions
    expect(clientSpies.downloadFile).toHaveBeenCalledTimes(2); // Timeline + Audio
    expect(clientSpies.uploadStream).toHaveBeenCalledTimes(1); // Video
    
    // Verify Clean up
    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/nexus-render-123', { recursive: true, force: true });
  });
});
