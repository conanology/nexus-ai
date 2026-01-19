/**
 * Tests for YouTube scheduled publishing
 * @module @nexus-ai/youtube/__tests__/scheduler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculatePublishTime, scheduleVideo } from '../scheduler.js';
import { getYouTubeClient } from '../client.js';
import { getQuotaTracker } from '../quota.js';

// Mock dependencies
vi.mock('../client.js');
vi.mock('../quota.js');

describe('calculatePublishTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should default to 2 PM UTC on the current date when before 1 PM UTC', () => {
    // Set time to 10:00 AM UTC on 2026-01-19
    const now = new Date('2026-01-19T10:00:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    expect(publishTime.toISOString()).toBe('2026-01-19T14:00:00.000Z');
  });

  it('should schedule for tomorrow at 2 PM UTC when current time is after 1 PM UTC', () => {
    // Set time to 1:01 PM UTC on 2026-01-19 (just after cutoff)
    const now = new Date('2026-01-19T13:01:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    // Should be tomorrow at 2 PM UTC
    expect(publishTime.toISOString()).toBe('2026-01-20T14:00:00.000Z');
  });

  it('should schedule for tomorrow at 2 PM UTC when current time is exactly 1 PM UTC', () => {
    // Set time to exactly 1:00 PM UTC on 2026-01-19 (cutoff time)
    const now = new Date('2026-01-19T13:00:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    // Should be tomorrow at 2 PM UTC (less than 1 hour before slot)
    expect(publishTime.toISOString()).toBe('2026-01-20T14:00:00.000Z');
  });

  it('should accept a custom now parameter', () => {
    const customNow = new Date('2026-01-19T08:30:00.000Z');

    const publishTime = calculatePublishTime(customNow);

    expect(publishTime.toISOString()).toBe('2026-01-19T14:00:00.000Z');
  });

  it('should handle edge case at 12:59 PM UTC (before cutoff)', () => {
    const now = new Date('2026-01-19T12:59:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    // Should be today at 2 PM UTC (still 1 hour and 1 minute before slot)
    expect(publishTime.toISOString()).toBe('2026-01-19T14:00:00.000Z');
  });

  it('should handle late evening times correctly', () => {
    // Set time to 11:00 PM UTC on 2026-01-19
    const now = new Date('2026-01-19T23:00:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    // Should be tomorrow at 2 PM UTC
    expect(publishTime.toISOString()).toBe('2026-01-20T14:00:00.000Z');
  });

  it('should handle midnight correctly', () => {
    // Set time to midnight UTC on 2026-01-19
    const now = new Date('2026-01-19T00:00:00.000Z');
    vi.setSystemTime(now);

    const publishTime = calculatePublishTime();

    // Should be today at 2 PM UTC
    expect(publishTime.toISOString()).toBe('2026-01-19T14:00:00.000Z');
  });
});

describe('scheduleVideo', () => {
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

  it('should call videos.update with correct parameters', async () => {
    const videoId = 'abc123xyz';
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

    expect(mockYoutubeApi.videos.update).toHaveBeenCalledWith({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: publishTime.toISOString(),
        },
      },
    });
  });

  it('should record quota usage after successful scheduling', async () => {
    const videoId = 'abc123xyz';
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

    expect(mockQuotaTracker.recordUsage).toHaveBeenCalledWith('video_update', 50);
  });

  it('should return scheduling details', async () => {
    const videoId = 'abc123xyz';
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

    const result = await scheduleVideo(videoId, publishTime);

    expect(result).toEqual({
      videoId,
      scheduledFor: publishTime.toISOString(),
      videoUrl: `https://youtu.be/${videoId}`,
    });
  });

  it('should use calculatePublishTime when no publishTime provided', async () => {
    const videoId = 'abc123xyz';

    // Set time to 10:00 AM UTC on 2026-01-19
    vi.useFakeTimers();
    const now = new Date('2026-01-19T10:00:00.000Z');
    vi.setSystemTime(now);

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

    const result = await scheduleVideo(videoId);

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

    expect(result.scheduledFor).toBe(expectedPublishTime.toISOString());

    vi.useRealTimers();
  });

  it('should throw error if YouTube API call fails', async () => {
    const videoId = 'abc123xyz';
    const publishTime = new Date('2026-01-20T14:00:00.000Z');

    mockYoutubeApi.videos.update.mockRejectedValue(new Error('API Error'));

    await expect(scheduleVideo(videoId, publishTime)).rejects.toThrow('API Error');
  });

  it('should verify scheduled time in API response', async () => {
    const videoId = 'abc123xyz';
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

    const result = await scheduleVideo(videoId, publishTime);

    // Verify that the returned scheduledFor matches what was requested
    expect(result.scheduledFor).toBe(publishTime.toISOString());
  });
});
