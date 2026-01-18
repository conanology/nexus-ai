import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QUOTA_COSTS } from '../types.js';

// Hoist mocks using vi.hoisted
const {
  mockFirestoreGetDocument,
  mockFirestoreSetDocument,
} = vi.hoisted(() => ({
  mockFirestoreGetDocument: vi.fn(),
  mockFirestoreSetDocument: vi.fn(),
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: mockFirestoreGetDocument,
    setDocument: mockFirestoreSetDocument,
    updateDocument: vi.fn(),
  })),
}));

import {
  QuotaTracker,
  getQuotaTracker,
  resetQuotaTracker,
  canUploadVideo,
  recordVideoUpload,
} from '../quota.js';

describe('QuotaTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQuotaTracker();
    
    // Default: no existing usage
    mockFirestoreGetDocument.mockResolvedValue(null);
    mockFirestoreSetDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetQuotaTracker();
  });

  describe('constructor', () => {
    it('should create a QuotaTracker instance', () => {
      const tracker = new QuotaTracker();
      expect(tracker).toBeInstanceOf(QuotaTracker);
    });
  });

  describe('getOperationCost', () => {
    it('should return correct cost for video_insert', () => {
      const tracker = new QuotaTracker();
      expect(tracker.getOperationCost('video_insert')).toBe(QUOTA_COSTS.VIDEO_INSERT);
      expect(tracker.getOperationCost('video_insert')).toBe(100);
    });

    it('should return correct cost for thumbnail_set', () => {
      const tracker = new QuotaTracker();
      expect(tracker.getOperationCost('thumbnail_set')).toBe(QUOTA_COSTS.THUMBNAIL_SET);
      expect(tracker.getOperationCost('thumbnail_set')).toBe(50);
    });

    it('should return correct cost for video_update', () => {
      const tracker = new QuotaTracker();
      expect(tracker.getOperationCost('video_update')).toBe(QUOTA_COSTS.VIDEO_UPDATE);
      expect(tracker.getOperationCost('video_update')).toBe(50);
    });

    it('should return 1 for other operations', () => {
      const tracker = new QuotaTracker();
      expect(tracker.getOperationCost('other')).toBe(1);
    });
  });

  describe('getUsage', () => {
    it('should return default usage for new day', async () => {
      const tracker = new QuotaTracker();
      const usage = await tracker.getUsage();

      expect(usage).toEqual({
        date: expect.any(String),
        totalUsed: 0,
        breakdown: {
          videoInserts: 0,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: false,
      });
    });

    it('should return existing usage from Firestore', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 500,
        breakdown: {
          videoInserts: 5,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: false,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      const usage = await tracker.getUsage('2026-01-18');

      expect(usage).toEqual(existingUsage);
    });
  });

  describe('recordUsage', () => {
    it('should record video_insert usage', async () => {
      const tracker = new QuotaTracker();
      await tracker.recordUsage('video_insert');

      expect(mockFirestoreSetDocument).toHaveBeenCalledWith(
        'youtube-quota',
        expect.any(String),
        expect.objectContaining({
          totalUsed: 100,
          breakdown: expect.objectContaining({
            videoInserts: 1,
          }),
        })
      );
    });

    it('should accumulate usage', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 500,
        breakdown: {
          videoInserts: 5,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: false,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      await tracker.recordUsage('video_insert');

      expect(mockFirestoreSetDocument).toHaveBeenCalledWith(
        'youtube-quota',
        expect.any(String),
        expect.objectContaining({
          totalUsed: 600,
          breakdown: expect.objectContaining({
            videoInserts: 6,
          }),
        })
      );
    });

    it('should trigger alert when usage exceeds 80%', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 7950, // Just below threshold
        breakdown: {
          videoInserts: 79,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 50,
        },
        alertSent: false,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      await tracker.recordUsage('video_insert'); // This pushes to 8050

      expect(mockFirestoreSetDocument).toHaveBeenCalledWith(
        'youtube-quota',
        expect.any(String),
        expect.objectContaining({
          totalUsed: 8050,
          alertSent: true, // Alert should be sent
        })
      );
    });

    it('should not send duplicate alerts', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 8500,
        breakdown: {
          videoInserts: 85,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: true, // Already alerted
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      await tracker.recordUsage('video_insert');

      expect(mockFirestoreSetDocument).toHaveBeenCalledWith(
        'youtube-quota',
        expect.any(String),
        expect.objectContaining({
          alertSent: true, // Should remain true
        })
      );
    });
  });

  describe('canPerformOperation', () => {
    it('should return true when quota is available', async () => {
      const tracker = new QuotaTracker();
      const canPerform = await tracker.canPerformOperation('video_insert');

      expect(canPerform).toBe(true);
    });

    it('should return false when quota would be exceeded', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 9950, // Only 50 units left
        breakdown: {
          videoInserts: 99,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 50,
        },
        alertSent: true,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      const canPerform = await tracker.canPerformOperation('video_insert'); // Needs 100 units

      expect(canPerform).toBe(false);
    });
  });

  describe('isQuotaNearLimit', () => {
    it('should return false when quota is low', async () => {
      const tracker = new QuotaTracker();
      const isNearLimit = await tracker.isQuotaNearLimit();

      expect(isNearLimit).toBe(false);
    });

    it('should return true when quota exceeds 80%', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 8500,
        breakdown: {
          videoInserts: 85,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: true,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      const isNearLimit = await tracker.isQuotaNearLimit();

      expect(isNearLimit).toBe(true);
    });
  });

  describe('getRemainingQuota', () => {
    it('should return full quota for new day', async () => {
      const tracker = new QuotaTracker();
      const remaining = await tracker.getRemainingQuota();

      expect(remaining).toBe(QUOTA_COSTS.DAILY_QUOTA);
      expect(remaining).toBe(10000);
    });

    it('should return correct remaining quota', async () => {
      const existingUsage = {
        date: '2026-01-18',
        totalUsed: 3000,
        breakdown: {
          videoInserts: 30,
          thumbnailSets: 0,
          videoUpdates: 0,
          other: 0,
        },
        alertSent: false,
      };

      mockFirestoreGetDocument.mockResolvedValue(existingUsage);

      const tracker = new QuotaTracker();
      const remaining = await tracker.getRemainingQuota();

      expect(remaining).toBe(7000);
    });
  });
});

describe('Singleton helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQuotaTracker();
    mockFirestoreGetDocument.mockResolvedValue(null);
    mockFirestoreSetDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetQuotaTracker();
  });

  describe('getQuotaTracker', () => {
    it('should return a QuotaTracker instance', () => {
      const tracker = getQuotaTracker();
      expect(tracker).toBeInstanceOf(QuotaTracker);
    });

    it('should return the same instance on subsequent calls', () => {
      const tracker1 = getQuotaTracker();
      const tracker2 = getQuotaTracker();
      expect(tracker1).toBe(tracker2);
    });
  });

  describe('canUploadVideo', () => {
    it('should return true when quota is available', async () => {
      const canUpload = await canUploadVideo();
      expect(canUpload).toBe(true);
    });
  });

  describe('recordVideoUpload', () => {
    it('should record video upload usage', async () => {
      await recordVideoUpload();
      expect(mockFirestoreSetDocument).toHaveBeenCalled();
    });
  });
});

describe('QUOTA_COSTS constants', () => {
  it('should have correct values per YouTube API documentation', () => {
    expect(QUOTA_COSTS.VIDEO_INSERT).toBe(100);
    expect(QUOTA_COSTS.THUMBNAIL_SET).toBe(50);
    expect(QUOTA_COSTS.VIDEO_UPDATE).toBe(50);
    expect(QUOTA_COSTS.VIDEO_LIST).toBe(1);
    expect(QUOTA_COSTS.DAILY_QUOTA).toBe(10000);
    expect(QUOTA_COSTS.ALERT_THRESHOLD).toBe(8000);
  });
});
