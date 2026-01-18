/**
 * YouTube API quota tracking
 * @module @nexus-ai/youtube/quota
 */

import {
  createLogger,
  FirestoreClient,
  type Logger,
} from '@nexus-ai/core';
import { QUOTA_COSTS, type QuotaUsage, type QuotaBreakdown } from './types.js';

/**
 * Firestore collection path for quota tracking
 */
const QUOTA_COLLECTION = 'youtube-quota';

/**
 * Get the current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Operation types that consume quota
 */
export type QuotaOperation = 'video_insert' | 'thumbnail_set' | 'video_update' | 'other';

/**
 * QuotaTracker class for tracking YouTube API quota usage
 * Per official Google documentation:
 * - videos.insert = 100 quota units (NOT 1600)
 * - thumbnails.set = 50 quota units
 * - videos.update = 50 quota units
 * - Daily quota = 10,000 units
 * - Alert threshold = 8,000 units (80%)
 */
export class QuotaTracker {
  private readonly logger: Logger;
  private readonly firestoreClient: FirestoreClient;

  constructor() {
    this.logger = createLogger('youtube.quota');
    this.firestoreClient = new FirestoreClient();
  }

  /**
   * Record quota usage for an operation
   */
  async recordUsage(operation: QuotaOperation, units?: number): Promise<void> {
    const date = getCurrentDate();
    const usage = await this.getUsage(date);

    // Determine cost based on operation
    const cost = units ?? this.getOperationCost(operation);

    // Update breakdown
    const updatedBreakdown = { ...usage.breakdown };
    switch (operation) {
      case 'video_insert':
        updatedBreakdown.videoInserts += 1;
        break;
      case 'thumbnail_set':
        updatedBreakdown.thumbnailSets += 1;
        break;
      case 'video_update':
        updatedBreakdown.videoUpdates += 1;
        break;
      default:
        updatedBreakdown.other += cost;
    }

    // Calculate new total
    const newTotal = usage.totalUsed + cost;

    // Check alert threshold
    let alertSent = usage.alertSent;
    if (newTotal >= QUOTA_COSTS.ALERT_THRESHOLD && !alertSent) {
      await this.sendQuotaAlert(date, newTotal);
      alertSent = true;
    }

    // Update Firestore
    const updatedUsage: QuotaUsage = {
      date,
      totalUsed: newTotal,
      breakdown: updatedBreakdown,
      alertSent,
    };

    await this.saveUsage(date, updatedUsage);

    this.logger.info({ operation, cost, totalUsed: newTotal, remaining: QUOTA_COSTS.DAILY_QUOTA - newTotal }, 'Quota usage recorded');
  }

  /**
   * Get current quota usage for a date
   */
  async getUsage(date?: string): Promise<QuotaUsage> {
    const targetDate = date ?? getCurrentDate();

    try {
      const docPath = `${QUOTA_COLLECTION}/${targetDate}`;
      const usage = await this.firestoreClient.getDocument<QuotaUsage>(QUOTA_COLLECTION, targetDate);

      if (usage) {
        return usage;
      }
    } catch {
      // Document doesn't exist, return default
    }

    // Return default usage for new day
    return {
      date: targetDate,
      totalUsed: 0,
      breakdown: {
        videoInserts: 0,
        thumbnailSets: 0,
        videoUpdates: 0,
        other: 0,
      },
      alertSent: false,
    };
  }

  /**
   * Check if an operation can be performed without exceeding quota
   */
  async canPerformOperation(operation: QuotaOperation): Promise<boolean> {
    const usage = await this.getUsage();
    const cost = this.getOperationCost(operation);
    const projectedTotal = usage.totalUsed + cost;

    const canPerform = projectedTotal <= QUOTA_COSTS.DAILY_QUOTA;

    if (!canPerform) {
      this.logger.warn({
        operation,
        cost,
        currentUsage: usage.totalUsed,
        dailyLimit: QUOTA_COSTS.DAILY_QUOTA,
      }, 'Quota would be exceeded');
    }

    return canPerform;
  }

  /**
   * Check if quota is approaching limit (above 80%)
   */
  async isQuotaNearLimit(): Promise<boolean> {
    const usage = await this.getUsage();
    return usage.totalUsed >= QUOTA_COSTS.ALERT_THRESHOLD;
  }

  /**
   * Get remaining quota for today
   */
  async getRemainingQuota(): Promise<number> {
    const usage = await this.getUsage();
    return Math.max(0, QUOTA_COSTS.DAILY_QUOTA - usage.totalUsed);
  }

  /**
   * Get the cost of an operation in quota units
   */
  getOperationCost(operation: QuotaOperation): number {
    switch (operation) {
      case 'video_insert':
        return QUOTA_COSTS.VIDEO_INSERT;
      case 'thumbnail_set':
        return QUOTA_COSTS.THUMBNAIL_SET;
      case 'video_update':
        return QUOTA_COSTS.VIDEO_UPDATE;
      default:
        return 1;
    }
  }

  /**
   * Get a breakdown of today's quota usage
   */
  async getBreakdown(): Promise<QuotaBreakdown> {
    const usage = await this.getUsage();
    return usage.breakdown;
  }

  /**
   * Save usage to Firestore
   */
  private async saveUsage(date: string, usage: QuotaUsage): Promise<void> {
    await this.firestoreClient.setDocument(QUOTA_COLLECTION, date, usage);
  }

  /**
   * Send quota alert (placeholder - integrate with notifications in Story 5.4)
   */
  private async sendQuotaAlert(date: string, currentUsage: number): Promise<void> {
    this.logger.warn({
      date,
      currentUsage,
      threshold: QUOTA_COSTS.ALERT_THRESHOLD,
      dailyLimit: QUOTA_COSTS.DAILY_QUOTA,
      percentUsed: Math.round((currentUsage / QUOTA_COSTS.DAILY_QUOTA) * 100),
    }, 'QUOTA ALERT: YouTube API quota usage exceeds 80%');

    // TODO: Story 5.4 - Integrate with notifications package
  }
}

/**
 * Singleton instance of QuotaTracker
 */
let quotaTrackerInstance: QuotaTracker | null = null;

/**
 * Get or create the QuotaTracker singleton
 */
export function getQuotaTracker(): QuotaTracker {
  if (!quotaTrackerInstance) {
    quotaTrackerInstance = new QuotaTracker();
  }
  return quotaTrackerInstance;
}

/**
 * Reset the QuotaTracker singleton (useful for testing)
 */
export function resetQuotaTracker(): void {
  quotaTrackerInstance = null;
}

/**
 * Check if a video upload can be performed
 * (convenience function for stage integration)
 */
export async function canUploadVideo(): Promise<boolean> {
  const tracker = getQuotaTracker();
  return tracker.canPerformOperation('video_insert');
}

/**
 * Record a video upload quota usage
 * (convenience function for stage integration)
 */
export async function recordVideoUpload(): Promise<void> {
  const tracker = getQuotaTracker();
  await tracker.recordUsage('video_insert');
}

/**
 * Record a thumbnail set quota usage
 * (convenience function for stage integration)
 */
export async function recordThumbnailSet(): Promise<void> {
  const tracker = getQuotaTracker();
  await tracker.recordUsage('thumbnail_set');
}
