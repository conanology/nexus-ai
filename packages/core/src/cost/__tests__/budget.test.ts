/**
 * Tests for budget tracking functions
 *
 * @module @nexus-ai/core/cost/__tests__/budget.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initializeBudget,
  getBudgetStatus,
  updateBudgetSpent,
  calculateRunway,
  getMonthlyHistory,
  resetBudget,
} from '../budget.js';
import { BUDGET_TARGETS } from '../types.js';

// Mock FirestoreClient
vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: vi.fn(),
    setDocument: vi.fn(),
    deleteDocument: vi.fn(),
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

// Mock queries for getCostTrend
vi.mock('../queries.js', () => ({
  getCostTrend: vi.fn().mockResolvedValue({
    periodDays: 7,
    dataPoints: [],
    summary: {
      avgDaily: 0.47,
      minDaily: 0.45,
      maxDaily: 0.52,
      totalCost: 3.29,
      totalVideos: 7,
      trend: 'stable',
      trendPercent: 2.1,
    },
  }),
}));

import { FirestoreClient } from '../../storage/firestore-client.js';
import { getCostTrend } from '../queries.js';

const mockFirestoreClient = FirestoreClient as unknown as vi.Mock;
const mockGetCostTrend = getCostTrend as unknown as vi.Mock;

// Sample budget data
const mockBudgetDoc = {
  initialCredit: 300,
  totalSpent: 14.5,
  remaining: 285.5,
  startDate: '2026-01-08T00:00:00.000Z',
  lastUpdated: '2026-01-22T10:00:00.000Z',
  creditExpiration: '2026-04-08T00:00:00.000Z',
};

describe('calculateRunway', () => {
  it('should calculate correct runway with normal values', () => {
    expect(calculateRunway(285.5, 0.47)).toBe(607);
  });

  it('should return 999 when no cost data (avgDailyCost = 0)', () => {
    expect(calculateRunway(285.5, 0)).toBe(999);
  });

  it('should return 999 when avgDailyCost is negative', () => {
    expect(calculateRunway(285.5, -0.1)).toBe(999);
  });

  it('should return 0 when no budget remaining', () => {
    expect(calculateRunway(0, 0.47)).toBe(0);
  });

  it('should return 0 when budget is negative', () => {
    expect(calculateRunway(-10, 0.47)).toBe(0);
  });

  it('should floor the result', () => {
    expect(calculateRunway(100, 0.33)).toBe(303); // 100/0.33 = 303.03
  });
});

describe('initializeBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create budget document with default credit', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(null),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await initializeBudget();

    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'current',
      expect.objectContaining({
        initialCredit: 300,
        totalSpent: 0,
        remaining: 300,
      })
    );
  });

  it('should create budget document with custom credit', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(null),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await initializeBudget(500);

    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'current',
      expect.objectContaining({
        initialCredit: 500,
        remaining: 500,
      })
    );
  });

  it('should not overwrite existing budget', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(mockBudgetDoc),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await initializeBudget();

    expect(setDocumentMock).not.toHaveBeenCalled();
  });

  it('should calculate correct expiration date (90 days)', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(null),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await initializeBudget(300, '2026-01-01T00:00:00.000Z');

    const savedDoc = setDocumentMock.mock.calls[0][2];
    const expiration = new Date(savedDoc.creditExpiration);
    const start = new Date('2026-01-01');

    const daysDiff = Math.round((expiration.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(90);
  });
});

describe('getBudgetStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return budget status with calculated values', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(mockBudgetDoc),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const status = await getBudgetStatus();

    expect(status.initialCredit).toBe(300);
    expect(status.totalSpent).toBe(14.5);
    expect(status.remaining).toBe(285.5);
    expect(status.daysOfRunway).toBe(607); // 285.5 / 0.47
    expect(status.projectedMonthly).toBe(14.1); // 0.47 * 30
    expect(status.isWithinBudget).toBe(true);
    expect(status.isInCreditPeriod).toBe(true);
  });

  it('should initialize budget if not exists', async () => {
    // Track call sequence to simulate:
    // 1. getBudgetStatus checks -> null
    // 2. initializeBudget checks -> null (so it creates)
    // 3. getBudgetStatus re-checks -> returns created budget
    const state = { getDocumentCalls: 0, setDocumentCalls: 0 };

    mockFirestoreClient.mockImplementation(() => ({
      getDocument: vi.fn().mockImplementation(() => {
        state.getDocumentCalls++;
        // First two calls return null (getBudgetStatus check + initializeBudget check)
        // Third call returns the created budget
        if (state.getDocumentCalls <= 2) return Promise.resolve(null);
        return Promise.resolve(mockBudgetDoc);
      }),
      setDocument: vi.fn().mockImplementation(() => {
        state.setDocumentCalls++;
        return Promise.resolve();
      }),
    }));

    const status = await getBudgetStatus();

    expect(state.setDocumentCalls).toBeGreaterThan(0);
    expect(status.initialCredit).toBe(300);
  });

  it('should mark as over budget when projected exceeds target', async () => {
    // Mock high daily cost
    mockGetCostTrend.mockResolvedValueOnce({
      periodDays: 7,
      dataPoints: [],
      summary: {
        avgDaily: 2.0, // High cost
        minDaily: 1.8,
        maxDaily: 2.2,
        totalCost: 14,
        totalVideos: 7,
        trend: 'stable',
        trendPercent: 0,
      },
    });

    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(mockBudgetDoc),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const status = await getBudgetStatus();

    expect(status.projectedMonthly).toBe(60); // 2.0 * 30
    expect(status.isWithinBudget).toBe(false); // Over $50 target
  });

  it('should mark as outside credit period after expiration', async () => {
    const expiredBudget = {
      ...mockBudgetDoc,
      creditExpiration: '2025-01-01T00:00:00.000Z', // Past date
    };

    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(expiredBudget),
      setDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const status = await getBudgetStatus();

    expect(status.isInCreditPeriod).toBe(false);
  });
});

describe('updateBudgetSpent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update budget with new spending', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(mockBudgetDoc),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await updateBudgetSpent(0.47);

    // Should update main budget
    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'current',
      expect.objectContaining({
        totalSpent: 14.97, // 14.5 + 0.47
        remaining: 285.03, // 300 - 14.97
      })
    );
  });

  it('should update monthly history', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn()
        .mockResolvedValueOnce(mockBudgetDoc) // Budget doc
        .mockResolvedValueOnce(null), // History doc (new month)
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await updateBudgetSpent(0.47, '2026-01-22');

    // Should update history
    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget/history',
      '2026-01',
      expect.objectContaining({
        month: '2026-01',
        monthlySpent: 0.47,
        videoCount: 1,
      })
    );
  });

  it('should initialize budget if not exists', async () => {
    const setDocumentMock = vi.fn();
    const newBudget = {
      initialCredit: 300,
      totalSpent: 0,
      remaining: 300,
      startDate: '2026-01-22T00:00:00.000Z',
      lastUpdated: '2026-01-22T00:00:00.000Z',
      creditExpiration: '2026-04-22T00:00:00.000Z',
    };

    let budgetCallCount = 0;
    const getDocumentMock = vi.fn().mockImplementation((collection: string) => {
      if (collection === 'budget') {
        budgetCallCount++;
        // First budget call returns null, subsequent return the new budget
        if (budgetCallCount <= 1) return Promise.resolve(null);
        return Promise.resolve(newBudget);
      }
      return Promise.resolve(null); // History doc
    });

    mockFirestoreClient.mockImplementation(() => ({
      getDocument: getDocumentMock,
      setDocument: setDocumentMock,
    }));

    await updateBudgetSpent(0.47);

    // Should have multiple setDocument calls (init + update + history)
    expect(setDocumentMock).toHaveBeenCalled();
  });

  it('should accumulate spending in existing month history', async () => {
    const existingHistory = {
      month: '2026-01',
      monthlySpent: 10.0,
      videoCount: 21,
      avgCostPerVideo: 0.4762,
      days: { '2026-01-21': 0.48 },
    };

    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn()
        .mockResolvedValueOnce(mockBudgetDoc)
        .mockResolvedValueOnce(existingHistory),
      setDocument: setDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await updateBudgetSpent(0.47, '2026-01-22');

    // Find the history update call
    const historyCall = setDocumentMock.mock.calls.find(
      call => call[0] === 'budget/history'
    );

    expect(historyCall).toBeDefined();
    expect(historyCall[2].monthlySpent).toBe(10.47); // 10.0 + 0.47
    expect(historyCall[2].videoCount).toBe(22);
    expect(historyCall[2].days['2026-01-22']).toBe(0.47);
  });
});

describe('getMonthlyHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return history for specified month', async () => {
    const mockHistory = {
      month: '2026-01',
      monthlySpent: 10.35,
      videoCount: 22,
      avgCostPerVideo: 0.47,
      days: {},
    };

    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(mockHistory),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const history = await getMonthlyHistory('2026-01');

    expect(history).toEqual(mockHistory);
  });

  it('should return null for non-existent month', async () => {
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(null),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const history = await getMonthlyHistory('2025-01');

    expect(history).toBeNull();
  });
});

describe('resetBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete and recreate budget', async () => {
    const deleteDocumentMock = vi.fn();
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn()
        .mockResolvedValueOnce(null), // After delete
      setDocument: setDocumentMock,
      deleteDocument: deleteDocumentMock,
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await resetBudget(300);

    expect(deleteDocumentMock).toHaveBeenCalledWith('budget', 'current');
    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'current',
      expect.objectContaining({
        initialCredit: 300,
        totalSpent: 0,
        remaining: 300,
      })
    );
  });

  it('should accept custom credit amount', async () => {
    const setDocumentMock = vi.fn();
    const mockInstance = {
      getDocument: vi.fn().mockResolvedValue(null),
      setDocument: setDocumentMock,
      deleteDocument: vi.fn(),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    await resetBudget(500);

    expect(setDocumentMock).toHaveBeenCalledWith(
      'budget',
      'current',
      expect.objectContaining({
        initialCredit: 500,
        remaining: 500,
      })
    );
  });
});
