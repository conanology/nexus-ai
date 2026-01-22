/**
 * Tests for buffer video types and constants
 * @module @nexus-ai/core/buffer/__tests__/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  BUFFER_THRESHOLDS,
  BUFFER_VALIDATION,
  BUFFER_COLLECTION,
  BUFFER_VIDEO_STATUSES,
  isValidBufferVideoStatus,
  type BufferVideo,
  type BufferVideoStatus,
  type BufferDeploymentResult,
  type BufferHealthStatus,
  type CreateBufferInput,
  type BufferSummary,
} from '../types.js';

describe('Buffer Types and Constants', () => {
  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('BUFFER_THRESHOLDS', () => {
    it('should have MINIMUM_COUNT of 1 per NFR5', () => {
      expect(BUFFER_THRESHOLDS.MINIMUM_COUNT).toBe(1);
    });

    it('should have WARNING_COUNT of 2 for early warning', () => {
      expect(BUFFER_THRESHOLDS.WARNING_COUNT).toBe(2);
    });

    it('should have WARNING_COUNT greater than MINIMUM_COUNT', () => {
      expect(BUFFER_THRESHOLDS.WARNING_COUNT).toBeGreaterThan(
        BUFFER_THRESHOLDS.MINIMUM_COUNT
      );
    });
  });

  describe('BUFFER_COLLECTION', () => {
    it('should be buffer-videos', () => {
      expect(BUFFER_COLLECTION).toBe('buffer-videos');
    });
  });

  describe('BUFFER_VALIDATION', () => {
    it('should have MAX_TITLE_LENGTH of 100', () => {
      expect(BUFFER_VALIDATION.MAX_TITLE_LENGTH).toBe(100);
    });

    it('should have valid duration range', () => {
      expect(BUFFER_VALIDATION.MIN_DURATION_SEC).toBe(60);
      expect(BUFFER_VALIDATION.MAX_DURATION_SEC).toBe(900);
      expect(BUFFER_VALIDATION.MIN_DURATION_SEC).toBeLessThan(
        BUFFER_VALIDATION.MAX_DURATION_SEC
      );
    });

    it('should have YouTube video ID pattern', () => {
      const pattern = BUFFER_VALIDATION.YOUTUBE_VIDEO_ID_PATTERN;
      expect(pattern.test('dQw4w9WgXcQ')).toBe(true); // Valid 11-char ID
      expect(pattern.test('abc123')).toBe(false); // Too short
      expect(pattern.test('12345678901234')).toBe(false); // Too long
    });
  });

  describe('BUFFER_VIDEO_STATUSES', () => {
    it('should contain all valid statuses', () => {
      expect(BUFFER_VIDEO_STATUSES).toContain('active');
      expect(BUFFER_VIDEO_STATUSES).toContain('deployed');
      expect(BUFFER_VIDEO_STATUSES).toContain('archived');
    });

    it('should have exactly 3 statuses', () => {
      expect(BUFFER_VIDEO_STATUSES).toHaveLength(3);
    });
  });

  describe('isValidBufferVideoStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidBufferVideoStatus('active')).toBe(true);
      expect(isValidBufferVideoStatus('deployed')).toBe(true);
      expect(isValidBufferVideoStatus('archived')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidBufferVideoStatus('invalid')).toBe(false);
      expect(isValidBufferVideoStatus('')).toBe(false);
      expect(isValidBufferVideoStatus('ACTIVE')).toBe(false);
    });
  });

  // ==========================================================================
  // Type Structure Tests
  // ==========================================================================

  describe('BufferVideo interface', () => {
    const validBufferVideo: BufferVideo = {
      id: 'bf-123e4567-e89b-12d3-a456-426614174000',
      videoId: 'dQw4w9WgXcQ',
      topic: 'Top 5 AI Papers This Week',
      title: 'Top 5 AI Research Papers You Must Read',
      description: 'Weekly roundup of the most impactful AI research papers.',
      createdDate: '2026-01-15T10:00:00.000Z',
      used: false,
      deploymentCount: 0,
      durationSec: 360,
      thumbnailPath: 'gs://nexus-ai-artifacts/buffers/bf-123/thumb.png',
      source: 'manual',
      evergreen: true,
      status: 'active',
    };

    it('should have all required fields', () => {
      expect(validBufferVideo.id).toBeDefined();
      expect(validBufferVideo.videoId).toBeDefined();
      expect(validBufferVideo.topic).toBeDefined();
      expect(validBufferVideo.title).toBeDefined();
      expect(validBufferVideo.createdDate).toBeDefined();
      expect(validBufferVideo.used).toBeDefined();
      expect(validBufferVideo.deploymentCount).toBeDefined();
      expect(validBufferVideo.durationSec).toBeDefined();
      expect(validBufferVideo.source).toBeDefined();
      expect(validBufferVideo.evergreen).toBeDefined();
      expect(validBufferVideo.status).toBeDefined();
    });

    it('should allow optional fields', () => {
      const minimal: BufferVideo = {
        id: 'bf-minimal',
        videoId: 'abc123',
        topic: 'Test Topic',
        title: 'Test Title',
        createdDate: '2026-01-15T10:00:00.000Z',
        used: false,
        deploymentCount: 0,
        durationSec: 300,
        source: 'auto',
        evergreen: true,
        status: 'active',
      };
      expect(minimal.description).toBeUndefined();
      expect(minimal.thumbnailPath).toBeUndefined();
      expect(minimal.usedDate).toBeUndefined();
      expect(minimal.retirementDate).toBeUndefined();
    });

    it('should support deployed status with usedDate', () => {
      const deployed: BufferVideo = {
        ...validBufferVideo,
        used: true,
        usedDate: '2026-01-20T14:00:00.000Z',
        deploymentCount: 1,
        status: 'deployed',
      };
      expect(deployed.used).toBe(true);
      expect(deployed.usedDate).toBeDefined();
      expect(deployed.status).toBe('deployed');
    });
  });

  describe('BufferVideoStatus type', () => {
    it('should allow valid status values', () => {
      const active: BufferVideoStatus = 'active';
      const deployed: BufferVideoStatus = 'deployed';
      const archived: BufferVideoStatus = 'archived';

      expect(active).toBe('active');
      expect(deployed).toBe('deployed');
      expect(archived).toBe('archived');
    });
  });

  describe('BufferDeploymentResult interface', () => {
    const deploymentResult: BufferDeploymentResult = {
      success: true,
      bufferId: 'bf-123',
      videoId: 'dQw4w9WgXcQ',
      scheduledTime: '2026-01-20T14:00:00.000Z',
      previousStatus: 'active',
      newStatus: 'deployed',
    };

    it('should have all required fields for successful deployment', () => {
      expect(deploymentResult.success).toBe(true);
      expect(deploymentResult.bufferId).toBeDefined();
      expect(deploymentResult.videoId).toBeDefined();
      expect(deploymentResult.scheduledTime).toBeDefined();
      expect(deploymentResult.previousStatus).toBe('active');
      expect(deploymentResult.newStatus).toBe('deployed');
    });

    it('should support failed deployment with error', () => {
      const failed: BufferDeploymentResult = {
        success: false,
        bufferId: 'bf-123',
        error: 'No available buffers',
      };
      expect(failed.success).toBe(false);
      expect(failed.error).toBeDefined();
    });
  });

  describe('BufferHealthStatus interface', () => {
    const healthStatus: BufferHealthStatus = {
      totalCount: 5,
      availableCount: 3,
      deployedCount: 2,
      status: 'healthy',
      belowWarningThreshold: false,
      belowMinimumThreshold: false,
      lastChecked: '2026-01-20T10:00:00.000Z',
    };

    it('should have all required health metrics', () => {
      expect(healthStatus.totalCount).toBeDefined();
      expect(healthStatus.availableCount).toBeDefined();
      expect(healthStatus.deployedCount).toBeDefined();
      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.belowWarningThreshold).toBeDefined();
      expect(healthStatus.belowMinimumThreshold).toBeDefined();
      expect(healthStatus.lastChecked).toBeDefined();
    });

    it('should support warning status', () => {
      const warning: BufferHealthStatus = {
        totalCount: 2,
        availableCount: 1,
        deployedCount: 1,
        status: 'warning',
        belowWarningThreshold: true,
        belowMinimumThreshold: false,
        lastChecked: '2026-01-20T10:00:00.000Z',
      };
      expect(warning.status).toBe('warning');
      expect(warning.belowWarningThreshold).toBe(true);
    });

    it('should support critical status', () => {
      const critical: BufferHealthStatus = {
        totalCount: 1,
        availableCount: 0,
        deployedCount: 1,
        status: 'critical',
        belowWarningThreshold: true,
        belowMinimumThreshold: true,
        lastChecked: '2026-01-20T10:00:00.000Z',
      };
      expect(critical.status).toBe('critical');
      expect(critical.belowMinimumThreshold).toBe(true);
    });
  });

  describe('CreateBufferInput interface', () => {
    const createInput: CreateBufferInput = {
      videoId: 'abc123',
      topic: 'Test Topic',
      title: 'Test Title',
      durationSec: 300,
      source: 'manual',
    };

    it('should have required fields for buffer creation', () => {
      expect(createInput.videoId).toBeDefined();
      expect(createInput.topic).toBeDefined();
      expect(createInput.title).toBeDefined();
      expect(createInput.durationSec).toBeDefined();
      expect(createInput.source).toBeDefined();
    });

    it('should support optional fields', () => {
      const withOptional: CreateBufferInput = {
        ...createInput,
        description: 'Test description',
        thumbnailPath: 'gs://bucket/thumb.png',
      };
      expect(withOptional.description).toBeDefined();
      expect(withOptional.thumbnailPath).toBeDefined();
    });
  });

  describe('BufferSummary interface', () => {
    const summary: BufferSummary = {
      date: '2026-01-20',
      totalBuffers: 5,
      availableBuffers: 3,
      deployedToday: 0,
      healthStatus: 'healthy',
      oldestBufferDate: '2026-01-01T10:00:00.000Z',
    };

    it('should have all required summary fields', () => {
      expect(summary.date).toBeDefined();
      expect(summary.totalBuffers).toBeDefined();
      expect(summary.availableBuffers).toBeDefined();
      expect(summary.deployedToday).toBeDefined();
      expect(summary.healthStatus).toBeDefined();
    });

    it('should allow optional oldestBufferDate', () => {
      const noOldest: BufferSummary = {
        date: '2026-01-20',
        totalBuffers: 0,
        availableBuffers: 0,
        deployedToday: 0,
        healthStatus: 'critical',
      };
      expect(noOldest.oldestBufferDate).toBeUndefined();
    });
  });
});
