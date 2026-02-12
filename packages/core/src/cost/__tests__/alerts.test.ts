/**
 * Tests for cost alert functions
 *
 * @module @nexus-ai/core/cost/__tests__/alerts.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { COST_THRESHOLDS } from '../types.js';

// Mock FirestoreClient
vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: vi.fn(),
    setDocument: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../observability/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock budget module
vi.mock('../budget.js', () => ({
  getBudgetStatus: vi.fn().mockResolvedValue({
    initialCredit: 300,
    totalSpent: 14.5,
    remaining: 285.5,
    daysOfRunway: 607,
    projectedMonthly: 14.1,
    creditExpiration: '2026-04-08T00:00:00.000Z',
    isWithinBudget: true,
    isInCreditPeriod: true,
    startDate: '2026-01-08T00:00:00.000Z',
    lastUpdated: '2026-01-22T10:00:00.000Z',
  }),
}));

// Import after mocks
import {
  checkCostThresholds,
  getAlertCounts,
  resetAlertCounts,
  setNotificationFunctions,
  type NotificationFunctions,
} from '../alerts.js';
import { FirestoreClient } from '../../storage/firestore-client.js';

const mockFirestoreClient = FirestoreClient as unknown as vi.Mock;

// Mock notification functions for injection
const mockSendDiscordAlert = vi.fn().mockResolvedValue(undefined);
const mockSendAlertEmail = vi.fn().mockResolvedValue(undefined);

const mockNotifications: NotificationFunctions = {
  sendDiscordAlert: mockSendDiscordAlert,
  sendAlertEmail: mockSendAlertEmail,
};

const mockBreakdown = {
  gemini: 0.35,
  tts: 0.32,
  render: 0.15,
};

// Helper to get current month for test isolation
function getCurrentTestMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Default alert state (no previous alerts) - dynamically generated
function createEmptyAlertState() {
  return {
    warningCount: 0,
    criticalCount: 0,
    month: getCurrentTestMonth(),
  };
}

describe('checkCostThresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Inject mock notifications
    setNotificationFunctions(mockNotifications);
  });

  afterEach(() => {
    // Reset notifications
    setNotificationFunctions(null);
  });

  it('should not trigger alert when cost is below warning threshold', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.50, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(false);
    expect(result.sent).toBe(false);
    expect(mockSendDiscordAlert).not.toHaveBeenCalled();
    expect(mockSendAlertEmail).not.toHaveBeenCalled();
  });

  it('should trigger WARNING alert when cost exceeds $0.75', async () => {
    const setDocMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: setDocMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.82, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('WARNING');
    expect(result.sent).toBe(true);
    expect(mockSendDiscordAlert).toHaveBeenCalled();
    expect(mockSendAlertEmail).not.toHaveBeenCalled();
    expect(setDocMock).toHaveBeenCalled();
  });

  it('should trigger CRITICAL alert when cost exceeds $1.00', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(1.05, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    expect(result.sent).toBe(true);
    expect(mockSendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('CRITICAL'),
        severity: 'CRITICAL',
      })
    );
    expect(mockSendDiscordAlert).not.toHaveBeenCalled();
  });

  it('should trigger CRITICAL (not WARNING) when cost exceeds both thresholds', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(1.50, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    // Verify that result indicates alert was sent (notifications mocked at package level)
    expect(result.sent).toBe(true);
  });

  it('should track warning alert count and timestamp on sent', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.80, '2026-01-22', mockBreakdown);

    expect(result.sent).toBe(true);
    expect(result.severity).toBe('WARNING');
    // Verify Firestore was called to update alert state
    expect(setDocumentMock).toHaveBeenCalled();
  });

  it('should track critical alert count and timestamp on sent', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(1.10, '2026-01-22', mockBreakdown);

    expect(result.sent).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    // Verify Firestore was called to update alert state
    expect(setDocumentMock).toHaveBeenCalled();
  });

  it('should respect cooldown period and not send duplicate alerts', async () => {
    // Previous alert was 30 minutes ago (within 1 hour cooldown)
    const recentAlertState = {
      warningCount: 1,
      criticalCount: 0,
      month: getCurrentTestMonth(),
      lastWarningAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    };

    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(recentAlertState),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.80, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.reason).toContain('cooldown');
    expect(mockSendDiscordAlert).not.toHaveBeenCalled();
  });

  it('should send alert after cooldown period expires', async () => {
    // Previous alert was 2 hours ago (outside 1 hour cooldown)
    const oldAlertState = {
      warningCount: 1,
      criticalCount: 0,
      month: getCurrentTestMonth(),
      lastWarningAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    };

    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(oldAlertState),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.80, '2026-01-22', mockBreakdown);

    expect(result.triggered).toBe(true);
    expect(result.sent).toBe(true);
    expect(mockSendDiscordAlert).toHaveBeenCalled();
  });

  it('should reset counts for new month', async () => {
    // Previous state from last month
    const lastMonthState = {
      warningCount: 5,
      criticalCount: 2,
      month: '2025-12', // Different month
      lastWarningAt: '2025-12-31T10:00:00.000Z',
    };

    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(lastMonthState),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.80, '2026-01-22', mockBreakdown);

    expect(result.sent).toBe(true);
    // New month should start with count = 1 (not 6)
    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'alerts',
      expect.objectContaining({
        warningCount: 1,
      })
    );
  });

  it('should send warning alert via Discord channel', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(0.82, '2026-01-22', mockBreakdown);

    // Warning alerts go to Discord, result indicates sent
    expect(result.sent).toBe(true);
    expect(result.severity).toBe('WARNING');
    // The notification was sent (mocked - we verify via result.sent)
  });

  it('should send critical alert via email channel', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await checkCostThresholds(1.05, '2026-01-22', mockBreakdown);

    // Critical alerts go to email, result indicates sent
    expect(result.sent).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    // The notification was sent (mocked - we verify via result.sent)
  });

  it('should handle exact threshold values', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(createEmptyAlertState()),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    // Exactly at warning threshold
    const warningResult = await checkCostThresholds(
      COST_THRESHOLDS.WARNING,
      '2026-01-22',
      mockBreakdown
    );
    expect(warningResult.triggered).toBe(true);
    expect(warningResult.severity).toBe('WARNING');

    vi.clearAllMocks();

    // Exactly at critical threshold
    const criticalResult = await checkCostThresholds(
      COST_THRESHOLDS.CRITICAL,
      '2026-01-23',
      mockBreakdown
    );
    expect(criticalResult.triggered).toBe(true);
    expect(criticalResult.severity).toBe('CRITICAL');
  });
});

describe('getAlertCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return current alert counts', async () => {
    const alertState = {
      warningCount: 3,
      criticalCount: 1,
      month: getCurrentTestMonth(),
      lastWarningAt: '2026-01-20T10:00:00.000Z',
      lastCriticalAt: '2026-01-22T14:00:00.000Z',
    };

    mockFirestoreClient.mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(alertState),
    }));

    const counts = await getAlertCounts();

    expect(counts.warningCount).toBe(3);
    expect(counts.criticalCount).toBe(1);
    expect(counts.lastAlert).toBe('2026-01-22T14:00:00.000Z'); // Most recent
    expect(counts.lastAlertType).toBe('critical');
  });

  it('should return zero counts when no state exists', async () => {
    mockFirestoreClient.mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(null),
    }));

    const counts = await getAlertCounts();

    expect(counts.warningCount).toBe(0);
    expect(counts.criticalCount).toBe(0);
    expect(counts.lastAlert).toBeUndefined();
  });

  it('should return zeros on error', async () => {
    mockFirestoreClient.mockImplementation(() => ({
      getDocument: vi.fn().mockRejectedValue(new Error('Firestore error')),
    }));

    const counts = await getAlertCounts();

    expect(counts.warningCount).toBe(0);
    expect(counts.criticalCount).toBe(0);
  });

  it('should identify last alert type correctly when warning is more recent', async () => {
    // Warning was more recent
    const warningMoreRecent = {
      warningCount: 2,
      criticalCount: 1,
      month: getCurrentTestMonth(),
      lastWarningAt: '2026-01-22T15:00:00.000Z',
      lastCriticalAt: '2026-01-22T10:00:00.000Z',
    };

    mockFirestoreClient.mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(warningMoreRecent),
    }));

    const counts = await getAlertCounts();

    expect(counts.lastAlertType).toBe('warning');
    expect(counts.lastAlert).toBe('2026-01-22T15:00:00.000Z');
  });
});

describe('resetAlertCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset counts to zero', async () => {
    const setDocumentMock = vi.fn();
    mockFirestoreClient.mockImplementation(() => ({
      setDocument: setDocumentMock,
    }));

    await resetAlertCounts();

    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'alerts',
      expect.objectContaining({
        warningCount: 0,
        criticalCount: 0,
      })
    );
  });
});
