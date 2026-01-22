/**
 * Costs command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/costs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerCostsCommand } from '../../commands/costs.js';

// Mock @nexus-ai/core
const mockGetCostsByDate = vi.fn();
const mockGetCostsThisMonth = vi.fn();
const mockGetCostTrend = vi.fn();
const mockGetBudgetStatus = vi.fn();

vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  getCostsByDate: (...args: unknown[]) => mockGetCostsByDate(...args),
  getCostsThisMonth: (...args: unknown[]) => mockGetCostsThisMonth(...args),
  getCostTrend: (...args: unknown[]) => mockGetCostTrend(...args),
  getBudgetStatus: (...args: unknown[]) => mockGetBudgetStatus(...args),
}));

describe('Costs Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerCostsCommand(program);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never) as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should register costs command', () => {
    const costsCmd = program.commands.find((cmd) => cmd.name() === 'costs');
    expect(costsCmd).toBeDefined();
    expect(costsCmd?.description()).toContain('cost');
  });

  it('should have --month option', () => {
    const costsCmd = program.commands.find((cmd) => cmd.name() === 'costs');
    const monthOpt = costsCmd?.options.find((opt) => opt.long === '--month');
    expect(monthOpt).toBeDefined();
  });

  it('should have --trend option', () => {
    const costsCmd = program.commands.find((cmd) => cmd.name() === 'costs');
    const trendOpt = costsCmd?.options.find((opt) => opt.long === '--trend');
    expect(trendOpt).toBeDefined();
  });

  it('should have --budget option', () => {
    const costsCmd = program.commands.find((cmd) => cmd.name() === 'costs');
    const budgetOpt = costsCmd?.options.find((opt) => opt.long === '--budget');
    expect(budgetOpt).toBeDefined();
  });

  it('should display daily costs by default', async () => {
    mockGetCostsByDate.mockResolvedValueOnce({
      date: '2026-01-22',
      total: 0.47,
      byCategory: { gemini: 0.30, tts: 0.12, render: 0.05 },
      byStage: { 'script-gen': 0.20, tts: 0.12 },
      services: [],
      videoCount: 1,
    });

    await program.parseAsync(['node', 'test', 'costs']);

    expect(mockGetCostsByDate).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should display monthly costs with --month flag', async () => {
    mockGetCostsThisMonth.mockResolvedValueOnce({
      month: '2026-01',
      total: 14.50,
      videoCount: 22,
      avgPerVideo: 0.66,
      byCategory: { gemini: 9.0, tts: 4.0, render: 1.5 },
      budgetComparison: { target: 50, onTrack: true, projected: 22, daysRemaining: 9 },
    });

    await program.parseAsync(['node', 'test', 'costs', '--month']);

    expect(mockGetCostsThisMonth).toHaveBeenCalled();
  });

  it('should display cost trend with --trend flag', async () => {
    mockGetCostTrend.mockResolvedValueOnce({
      periodDays: 7,
      dataPoints: [
        { date: '2026-01-15', total: 0.45, avgPerVideo: 0.45, changeFromPrevious: 0, percentChange: 0 },
      ],
      summary: {
        avgDaily: 0.48,
        minDaily: 0.40,
        maxDaily: 0.55,
        totalCost: 3.36,
        totalVideos: 7,
        trend: 'stable',
        trendPercent: 2.5,
      },
    });

    await program.parseAsync(['node', 'test', 'costs', '--trend', '7']);

    expect(mockGetCostTrend).toHaveBeenCalledWith(7);
  });

  it('should display budget status with --budget flag', async () => {
    mockGetBudgetStatus.mockResolvedValueOnce({
      initialCredit: 300,
      totalSpent: 15,
      remaining: 285,
      daysOfRunway: 190,
      projectedMonthly: 22,
      creditExpiration: '2026-04-07T00:00:00Z',
      isWithinBudget: true,
      isInCreditPeriod: true,
      startDate: '2026-01-07T00:00:00Z',
      lastUpdated: '2026-01-22T10:00:00Z',
    });

    await program.parseAsync(['node', 'test', 'costs', '--budget']);

    expect(mockGetBudgetStatus).toHaveBeenCalled();
  });

  it('should output JSON when --json flag is set', async () => {
    mockGetCostsByDate.mockResolvedValueOnce({
      date: '2026-01-22',
      total: 0.47,
      byCategory: { gemini: 0.30, tts: 0.12, render: 0.05 },
      byStage: {},
      services: [],
      videoCount: 1,
    });

    await program.parseAsync(['node', 'test', '--json', 'costs']);

    const jsonOutput = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('"found"')
    );
    expect(jsonOutput).toBeDefined();
  });

  it('should handle no costs found', async () => {
    mockGetCostsByDate.mockResolvedValueOnce(null);

    await program.parseAsync(['node', 'test', 'costs']);

    expect(consoleLogSpy).toHaveBeenCalled();
    // Should show info message
  });
});
