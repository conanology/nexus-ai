import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

const mocks = vi.hoisted(() => ({
  renderVideo: vi.fn(),
}));

vi.mock('./render.js', () => ({
  RenderService: vi.fn().mockImplementation(() => ({
    renderVideo: mocks.renderVideo,
  }))
}));

// Mock logger to avoid noise
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }
  };
});

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  it('POST /render returns 200 on success', async () => {
    mocks.renderVideo.mockResolvedValue({
      videoUrl: 'gs://bucket/vid.mp4',
      duration: 10,
      fileSize: 100
    });

    const res = await request(app)
      .post('/render')
      .send({
        pipelineId: '123',
        timelineUrl: 'gs://t.json',
        audioUrl: 'gs://a.wav'
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      videoUrl: 'gs://bucket/vid.mp4',
      duration: 10,
      fileSize: 100
    });
  });

  it('POST /render returns 400 on invalid input', async () => {
    const res = await request(app)
      .post('/render')
      .send({ pipelineId: '123' }); // Missing required fields

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('POST /render returns 401 if secret missing when configured', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    process.env.NEXUS_SECRET = 'super-secret';
    
    try {
        const res = await request(app)
          .post('/render')
          .send({ 
              pipelineId: '123', 
              timelineUrl: 'gs://t.json', 
              audioUrl: 'gs://a.wav' 
          });
          
        expect(res.status).toBe(401);
    } finally {
        process.env.NEXUS_SECRET = originalSecret;
    }
  });

  it('POST /render returns 200 if secret provided', async () => {
    const originalSecret = process.env.NEXUS_SECRET;
    process.env.NEXUS_SECRET = 'super-secret';
    
    mocks.renderVideo.mockResolvedValue({});

    try {
        const res = await request(app)
          .post('/render')
          .set('X-NEXUS-SECRET', 'super-secret')
          .send({ 
              pipelineId: '123', 
              timelineUrl: 'gs://t.json', 
              audioUrl: 'gs://a.wav' 
          });
          
        expect(res.status).toBe(200);
    } finally {
        process.env.NEXUS_SECRET = originalSecret;
    }
  });
});
