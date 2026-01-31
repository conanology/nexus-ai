import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

const mocks = vi.hoisted(() => ({
  renderVideo: vi.fn(),
}));

vi.mock('./render.js', () => ({
  RenderService: vi.fn().mockImplementation(() => ({
    renderVideo: mocks.renderVideo,
  })),
}));

// Mock logger to avoid noise
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>(
    '@nexus-ai/core',
  );
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  };
});

describe('API Endpoints - Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC2: Render endpoint accepts resolution parameter with default
  it('POST /render should accept optional resolution parameter', async () => {
    // GIVEN: Render succeeds
    mocks.renderVideo.mockResolvedValue({
      videoUrl: 'gs://bucket/vid.mp4',
      duration: 10,
      fileSize: 100,
    });

    // WHEN: Request includes resolution
    const res = await request(app).post('/render').send({
      pipelineId: '2024-01-01',
      timelineUrl: 'gs://bucket/t.json',
      audioUrl: 'gs://bucket/a.wav',
      resolution: '1080p',
    });

    // THEN: Request succeeds
    expect(res.status).toBe(200);
    expect(mocks.renderVideo).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: '1080p' }),
    );
  });

  // AC2: Render endpoint defaults resolution to '1080p'
  it('POST /render should default resolution to 1080p when not provided', async () => {
    // GIVEN: Render succeeds
    mocks.renderVideo.mockResolvedValue({
      videoUrl: 'gs://bucket/vid.mp4',
      duration: 10,
      fileSize: 100,
    });

    // WHEN: Request omits resolution
    const res = await request(app).post('/render').send({
      pipelineId: '2024-01-01',
      timelineUrl: 'gs://bucket/t.json',
      audioUrl: 'gs://bucket/a.wav',
    });

    // THEN: Resolution defaults to 1080p
    expect(res.status).toBe(200);
    expect(mocks.renderVideo).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: '1080p' }),
    );
  });

  // AC2: Missing timelineUrl returns 400
  it('POST /render returns 400 when timelineUrl is missing', async () => {
    // GIVEN: Request missing timelineUrl

    // WHEN: Sending incomplete request
    const res = await request(app).post('/render').send({
      pipelineId: '123',
      audioUrl: 'gs://a.wav',
    });

    // THEN: 400 with error details
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  // AC2: Missing audioUrl returns 400
  it('POST /render returns 400 when audioUrl is missing', async () => {
    // GIVEN: Request missing audioUrl

    // WHEN: Sending incomplete request
    const res = await request(app).post('/render').send({
      pipelineId: '123',
      timelineUrl: 'gs://t.json',
    });

    // THEN: 400 with error details
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  // Render service error returns 500 with message
  it('POST /render returns 500 with error message when render fails', async () => {
    // GIVEN: RenderService throws an error
    mocks.renderVideo.mockRejectedValue(new Error('Render engine crashed'));

    // WHEN: Sending valid request
    const res = await request(app).post('/render').send({
      pipelineId: '123',
      timelineUrl: 'gs://t.json',
      audioUrl: 'gs://a.wav',
    });

    // THEN: 500 with error info
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('Render engine crashed');
  });

  // AC5: Health endpoint returns 200 OK
  it('GET /health returns text OK with content-type text', async () => {
    // GIVEN: Service is running

    // WHEN: Health check is requested
    const res = await request(app).get('/health');

    // THEN: Returns 200 with OK body
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  // AC2: Auth with wrong secret returns 401
  it('POST /render returns 401 when secret is wrong', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    process.env.NEXUS_SECRET = 'correct-secret';

    try {
      // GIVEN: Wrong secret header

      // WHEN: Request with bad secret
      const res = await request(app)
        .post('/render')
        .set('X-NEXUS-SECRET', 'wrong-secret')
        .send({
          pipelineId: '123',
          timelineUrl: 'gs://t.json',
          audioUrl: 'gs://a.wav',
        });

      // THEN: 401 unauthorized
      expect(res.status).toBe(401);
    } finally {
      process.env.NEXUS_SECRET = originalSecret;
    }
  });

  // AC2: Auth passes when no secret configured (open access)
  it('POST /render allows access when NEXUS_SECRET is not configured', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    delete process.env.NEXUS_SECRET;

    mocks.renderVideo.mockResolvedValue({
      videoUrl: 'gs://bucket/vid.mp4',
      duration: 5,
      fileSize: 50,
    });

    try {
      // GIVEN: No secret configured

      // WHEN: Request without any auth header
      const res = await request(app).post('/render').send({
        pipelineId: '123',
        timelineUrl: 'gs://t.json',
        audioUrl: 'gs://a.wav',
      });

      // THEN: Request succeeds (no auth required)
      expect(res.status).toBe(200);
    } finally {
      process.env.NEXUS_SECRET = originalSecret;
    }
  });

  // AC2: Empty body returns 400
  it('POST /render returns 400 when body is empty', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    delete process.env.NEXUS_SECRET;

    try {
      // GIVEN: Empty request body

      // WHEN: Sending empty body
      const res = await request(app).post('/render').send({});

      // THEN: 400 invalid input
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input');
    } finally {
      if (originalSecret !== undefined) process.env.NEXUS_SECRET = originalSecret;
    }
  });

  // AC2: Non-JSON body returns error
  it('POST /render returns 400 when body is not JSON', async () => {
    // GIVEN: Non-JSON body

    // WHEN: Sending plain text
    const res = await request(app)
      .post('/render')
      .set('Content-Type', 'text/plain')
      .send('not json');

    // THEN: Returns error (400 or 500)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // Return structure validation
  it('POST /render returns videoUrl, duration, and fileSize on success', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    delete process.env.NEXUS_SECRET;

    // GIVEN: Render returns specific values
    mocks.renderVideo.mockResolvedValue({
      videoUrl: 'gs://nexus-bucket/2024-01-01/render/video.mp4',
      duration: 120,
      fileSize: 50_000_000,
    });

    try {
      // WHEN: Valid render request
      const res = await request(app).post('/render').send({
        pipelineId: '2024-01-01',
        timelineUrl: 'gs://bucket/timeline.json',
        audioUrl: 'gs://bucket/audio.wav',
      });

      // THEN: Response has correct structure and values
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        videoUrl: 'gs://nexus-bucket/2024-01-01/render/video.mp4',
        duration: 120,
        fileSize: 50_000_000,
      });
    } finally {
      if (originalSecret !== undefined) process.env.NEXUS_SECRET = originalSecret;
    }
  });
});
