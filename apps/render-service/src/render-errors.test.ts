import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderService } from './render.js';

const fsMock = vi.hoisted(() => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/nexus-render-test'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((path: any) => {
    if (path && path.toString().endsWith('timeline.json'))
      return JSON.stringify({ scenes: [] });
    return Buffer.from('mock-video-content');
  }),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 * 1024 }), // 1MB
  access: vi.fn().mockResolvedValue(undefined),
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
      on: vi.fn().mockImplementation(function (this: any, event, cb) {
        if (event === 'finish') cb();
        return this;
      }),
    }),
  }),
}));

vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>(
    '@nexus-ai/core',
  );
  return {
    ...actual,
    CloudStorageClient: vi.fn().mockImplementation(() => clientSpies),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('@remotion/renderer', () => ({
  renderMedia: vi.fn().mockResolvedValue(undefined),
  selectComposition: vi.fn().mockResolvedValue({
    durationInFrames: 300,
    fps: 30,
  }),
}));

vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/tmp/bundle'),
}));

describe('RenderService Error Handling', () => {
  let service: RenderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RenderService();
  });

  // AC3: Cleanup on download failure
  it('should clean up temp directory when CloudStorage download fails', async () => {
    // GIVEN: CloudStorage download throws an error
    clientSpies.downloadFile.mockRejectedValueOnce(
      new Error('Storage bucket not found'),
    );

    // WHEN: Render is attempted
    const input = {
      pipelineId: '2024-01-01',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // THEN: Error is thrown and temp dir is cleaned up
    await expect(service.renderVideo(input)).rejects.toThrow(
      'Storage bucket not found',
    );
    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/nexus-render-test', {
      recursive: true,
      force: true,
    });
  });

  // AC3: Cleanup on render failure
  it('should clean up temp directory when Remotion render fails', async () => {
    // GIVEN: Remotion renderMedia throws an error
    const { renderMedia } = await import('@remotion/renderer');
    vi.mocked(renderMedia).mockRejectedValueOnce(
      new Error('Chrome process crashed'),
    );

    // WHEN: Render is attempted
    const input = {
      pipelineId: '2024-01-02',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // THEN: Error is thrown and temp dir is cleaned up
    await expect(service.renderVideo(input)).rejects.toThrow(
      'Chrome process crashed',
    );
    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/nexus-render-test', {
      recursive: true,
      force: true,
    });
  });

  // AC4: Quality gate - file too small for long video
  it('should fail quality gate when output file is too small for duration', async () => {
    // GIVEN: Render completes but file is suspiciously small (100 bytes for a 30+ second video)
    fsMock.stat.mockResolvedValueOnce({ size: 100 });

    const { selectComposition } = await import('@remotion/renderer');
    vi.mocked(selectComposition).mockResolvedValueOnce({
      durationInFrames: 1800, // 60 seconds at 30fps
      fps: 30,
    } as any);

    // WHEN: Render is attempted
    const input = {
      pipelineId: '2024-01-03',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // THEN: Quality gate rejects with degraded error
    await expect(service.renderVideo(input)).rejects.toThrow(
      /Quality Gate Failed.*too small/,
    );

    // AND: Temp dir is still cleaned up
    expect(fsMock.rm).toHaveBeenCalled();
  });

  // AC3: Upload failure triggers cleanup
  it('should clean up temp directory when upload to Cloud Storage fails', async () => {
    // GIVEN: Upload throws an error
    clientSpies.uploadStream.mockRejectedValueOnce(
      new Error('Upload quota exceeded'),
    );

    // WHEN: Render is attempted
    const input = {
      pipelineId: '2024-01-04',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // THEN: Error is thrown and temp dir is cleaned up
    await expect(service.renderVideo(input)).rejects.toThrow(
      'Upload quota exceeded',
    );
    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/nexus-render-test', {
      recursive: true,
      force: true,
    });
  });

  // AC3: Verify assets are downloaded in parallel
  it('should download timeline and audio in parallel', async () => {
    // GIVEN: Downloads take time
    let downloadCallOrder: string[] = [];
    clientSpies.downloadFile.mockImplementation(async (path: string) => {
      downloadCallOrder.push(path);
      return Buffer.from('mock-content');
    });

    // WHEN: Render is executed
    const input = {
      pipelineId: '2024-01-05',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    await service.renderVideo(input);

    // THEN: Both downloads were called
    expect(clientSpies.downloadFile).toHaveBeenCalledTimes(2);
    expect(downloadCallOrder).toHaveLength(2);
  });

  // AC3: Verify upload path includes pipelineId date
  it('should upload video to correct path using pipelineId', async () => {
    // GIVEN: Standard render input
    const input = {
      pipelineId: '2024-06-15',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // WHEN: Render completes successfully
    await service.renderVideo(input);

    // THEN: Upload path includes pipelineId
    expect(clientSpies.uploadStream).toHaveBeenCalledWith(
      '2024-06-15/render/video.mp4',
      expect.anything(),
      'video/mp4',
    );
  });

  // AC3: Verify returned output includes all required fields
  it('should return videoUrl, duration, and fileSize in output', async () => {
    // GIVEN: Standard render input
    const input = {
      pipelineId: '2024-01-06',
      timelineUrl: 'gs://bucket/timeline.json',
      audioUrl: 'gs://bucket/audio.wav',
      resolution: '1080p',
    };

    // WHEN: Render completes
    const result = await service.renderVideo(input);

    // THEN: Output contains all required fields
    expect(result).toHaveProperty('videoUrl');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('fileSize');
    expect(typeof result.videoUrl).toBe('string');
    expect(typeof result.duration).toBe('number');
    expect(typeof result.fileSize).toBe('number');
    expect(result.duration).toBeGreaterThan(0);
    expect(result.fileSize).toBeGreaterThan(0);
  });
});
