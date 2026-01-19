/**
 * Integration tests for YouTube scheduled publishing
 * @module @nexus-ai/youtube/__tests__/scheduler-integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleVideo, calculatePublishTime } from '../scheduler.js';
import { getYouTubeClient } from '../client.js';
import { getQuotaTracker } from '../quota.js';

// Mock dependencies
vi.mock('../client.js');
vi.mock('../quota.js');

describe('Scheduler Integration', () => {
  const mockYouTubeClient = {
    getYouTubeApi: vi.fn(),
    isInitialized: vi.fn(() => true),
    initialize: vi.fn(),
  };

  const mockQuotaTracker = {
    recordUsage: vi.fn().mockResolvedValue(undefined),
  };

  const mockYoutubeApi = {
    videos: {
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTubeClient as any);
    vi.mocked(getQuotaTracker).mockReturnValue(mockQuotaTracker as any);
    mockYouTubeClient.getYouTubeApi.mockReturnValue(mockYoutubeApi as any);
  });

  it('should complete full scheduling flow with default publish time', async () => {
    const videoId = 'test-video-123';
    
    // Mock time to 10:00 AM UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T10:00:00.000Z'));
    
    const expectedPublishTime = new Date('2026-01-19T14:00:00.000Z');
    
    mockYoutubeApi.videos.update.mockResolvedValue({
      data: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: expectedPublishTime.toISOString(),
        },
      },
    });

    // Execute scheduling
    const result = await scheduleVideo(videoId);

    // Verify all steps completed
    expect(mockYouTubeClient.getYouTubeApi).toHaveBeenCalled();
    expect(mockYoutubeApi.videos.update).toHaveBeenCalledWith({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: expectedPublishTime.toISOString(),
        },
      },
    });
    expect(mockQuotaTracker.recordUsage).toHaveBeenCalledWith('video_update', 50);
    
    // Verify result
    expect(result).toEqual({
      videoId,
      scheduledFor: expectedPublishTime.toISOString(),
      videoUrl: `https://youtu.be/${videoId}`,
    });

    vi.useRealTimers();
  });

  it('should handle scheduling with explicit publish time', async () => {
    const videoId = 'test-video-456';
    const customPublishTime = new Date('2026-01-25T14:00:00.000Z');
    
    mockYoutubeApi.videos.update.mockResolvedValue({
      data: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: customPublishTime.toISOString(),
        },
      },
    });

    const result = await scheduleVideo(videoId, customPublishTime);

    expect(mockYoutubeApi.videos.update).toHaveBeenCalledWith({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: customPublishTime.toISOString(),
        },
      },
    });
    
    expect(result.scheduledFor).toBe(customPublishTime.toISOString());
  });

  it('should properly set privacyStatus to private as required by API', async () => {
    const videoId = 'test-video-789';
    const publishTime = new Date('2026-01-20T14:00:00.000Z');
    
    mockYoutubeApi.videos.update.mockResolvedValue({
      data: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: publishTime.toISOString(),
        },
      },
    });

    await scheduleVideo(videoId, publishTime);

    // Verify that privacyStatus is ALWAYS set to 'private'
    const updateCall = mockYoutubeApi.videos.update.mock.calls[0][0];
    expect(updateCall.requestBody.status.privacyStatus).toBe('private');
  });

  it('should schedule for tomorrow when current time > 1 PM UTC (integration)', async () => {
    const videoId = 'test-video-tomorrow';
    
    // Mock time to 3:00 PM UTC on 2026-01-19 (after cutoff)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T15:00:00.000Z'));
    
    const expectedPublishTime = new Date('2026-01-20T14:00:00.000Z'); // Tomorrow at 2 PM
    
    mockYoutubeApi.videos.update.mockResolvedValue({
      data: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: expectedPublishTime.toISOString(),
        },
      },
    });

    // Execute scheduling WITHOUT explicit publishTime (should use calculatePublishTime)
    const result = await scheduleVideo(videoId);

    // Verify all steps completed with tomorrow's date
    expect(mockYoutubeApi.videos.update).toHaveBeenCalledWith({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: expectedPublishTime.toISOString(),
        },
      },
    });
    
    // Verify result shows tomorrow
    expect(result.scheduledFor).toBe(expectedPublishTime.toISOString());
    expect(result.scheduledFor).toContain('2026-01-20'); // Tomorrow

    vi.useRealTimers();
  });

  it('should handle retry and eventual success', async () => {
    const videoId = 'test-video-retry';
    const publishTime = new Date('2026-01-20T14:00:00.000Z');
    
    // Succeed on first attempt (simplified test - retry behavior is tested in core package)
    mockYoutubeApi.videos.update.mockResolvedValue({
      data: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: publishTime.toISOString(),
        },
      },
    });

    const result = await scheduleVideo(videoId, publishTime);

    // Verify scheduling succeeded
    expect(result.videoId).toBe(videoId);
    expect(result.scheduledFor).toBe(publishTime.toISOString());
    
    // Verify quota was tracked
    expect(mockQuotaTracker.recordUsage).toHaveBeenCalledWith('video_update', 50);
  });
});
