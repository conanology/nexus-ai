/**
 * Costs command - view cost tracking and budget information
 *
 * @module @nexus-ai/operator-cli/commands/costs
 */

import type { Command } from 'commander';
import {
  createLogger,
  getCostsByDate,
  getCostsThisMonth,
  getCostTrend,
  getBudgetStatus,
  type DailyCostBreakdown,
  type MonthlyCostSummary,
  type CostTrendData,
  type BudgetStatus,
} from '@nexus-ai/core';
import { getToday } from '../utils/date.js';
import {
  formatTable,
  formatJson,
  formatError,
  formatCost,
  formatInfo,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.costs');

interface CostsOptions {
  month?: boolean;
  trend?: string;
  budget?: boolean;
}

export function registerCostsCommand(program: Command): void {
  program
    .command('costs')
    .description('View cost tracking and budget information')
    .option('-m, --month', 'Show month-to-date costs', false)
    .option('-t, --trend <days>', 'Show cost trend for N days')
    .option('-b, --budget', 'Show budget status and runway', false)
    .action(async (options: CostsOptions) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ options }, 'Fetching cost data');

      try {
        if (options.budget) {
          // Show budget status
          const budget = await getBudgetStatus();
          displayBudget(budget, jsonMode);
        } else if (options.trend) {
          // Show cost trend
          const days = parseInt(options.trend, 10);
          if (isNaN(days) || days < 1) {
            console.error(formatError('Invalid trend days. Provide a positive number.'));
            process.exit(1);
          }
          const trend = await getCostTrend(days);
          displayTrend(trend, days, jsonMode);
        } else if (options.month) {
          // Show month-to-date costs
          const monthlyCosts = await getCostsThisMonth();
          displayMonthly(monthlyCosts, jsonMode);
        } else {
          // Show today's costs (default)
          const todayCosts = await getCostsByDate(getToday());
          displayDaily(todayCosts, getToday(), jsonMode);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Cost fetch failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to get costs: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}

function displayDaily(
  costs: DailyCostBreakdown | null,
  date: string,
  jsonMode: boolean
): void {
  if (!costs) {
    if (jsonMode) {
      console.log(formatJson({ found: false, date, message: 'No costs found' }));
    } else {
      console.log(formatInfo(`No costs recorded for ${date}`));
    }
    return;
  }

  if (jsonMode) {
    console.log(formatJson({ found: true, ...costs }));
    return;
  }

  console.log(`\nCosts for ${date}`);
  console.log('─'.repeat(40));
  console.log(`Total: ${formatCost(costs.total)}`);
  console.log('');

  // By category
  console.log('By Category:');
  const categoryRows = [
    ['Gemini (LLM/Image)', formatCost(costs.byCategory.gemini)],
    ['TTS', formatCost(costs.byCategory.tts)],
    ['Render', formatCost(costs.byCategory.render)],
  ];
  console.log(formatTable(['Category', 'Cost'], categoryRows));

  // By stage
  if (costs.byStage && Object.keys(costs.byStage).length > 0) {
    console.log('\nBy Stage:');
    const stageRows = Object.entries(costs.byStage).map(([stage, cost]) => [
      stage,
      formatCost(cost),
    ]);
    console.log(formatTable(['Stage', 'Cost'], stageRows));
  }

  // Services
  if (costs.services && costs.services.length > 0) {
    console.log('\nBy Service:');
    const serviceRows = costs.services.map((s) => [
      s.service,
      formatCost(s.cost),
      String(s.calls),
    ]);
    console.log(formatTable(['Service', 'Cost', 'Calls'], serviceRows));
  }
}

function displayMonthly(costs: MonthlyCostSummary | null, jsonMode: boolean): void {
  if (!costs) {
    if (jsonMode) {
      console.log(formatJson({ found: false, message: 'No monthly costs found' }));
    } else {
      console.log(formatInfo('No costs recorded this month'));
    }
    return;
  }

  if (jsonMode) {
    console.log(formatJson({ found: true, ...costs }));
    return;
  }

  console.log(`\nMonth-to-Date Costs: ${costs.month}`);
  console.log('─'.repeat(40));
  console.log(`Total: ${formatCost(costs.total)}`);
  console.log(`Videos: ${costs.videoCount}`);
  console.log(`Average per video: ${formatCost(costs.avgPerVideo)}`);
  console.log('');

  // By category breakdown
  console.log('By Category:');
  const categoryRows = [
    ['Gemini', formatCost(costs.byCategory.gemini), `${((costs.byCategory.gemini / costs.total) * 100).toFixed(1)}%`],
    ['TTS', formatCost(costs.byCategory.tts), `${((costs.byCategory.tts / costs.total) * 100).toFixed(1)}%`],
    ['Render', formatCost(costs.byCategory.render), `${((costs.byCategory.render / costs.total) * 100).toFixed(1)}%`],
  ];
  console.log(formatTable(['Category', 'Cost', 'Percentage'], categoryRows));

  // Budget comparison
  console.log('\nBudget Comparison:');
  console.log(`  Target: ${formatCost(costs.budgetComparison.target)}`);
  console.log(`  Projected: ${formatCost(costs.budgetComparison.projected)}`);
  console.log(`  On Track: ${costs.budgetComparison.onTrack ? 'Yes' : 'No'}`);
  console.log(`  Days Remaining: ${costs.budgetComparison.daysRemaining}`);
}

function displayTrend(trend: CostTrendData | null, days: number, jsonMode: boolean): void {
  if (!trend || trend.dataPoints.length === 0) {
    if (jsonMode) {
      console.log(formatJson({ found: false, days, message: 'No trend data found' }));
    } else {
      console.log(formatInfo(`No cost data found for the last ${days} days`));
    }
    return;
  }

  if (jsonMode) {
    console.log(formatJson({ found: true, days, ...trend }));
    return;
  }

  console.log(`\nCost Trend: Last ${days} Days`);
  console.log('─'.repeat(40));
  console.log(`Total: ${formatCost(trend.summary.totalCost)}`);
  console.log(`Average per day: ${formatCost(trend.summary.avgDaily)}`);
  console.log(`Trend: ${trend.summary.trend === 'increasing' ? '↑' : trend.summary.trend === 'decreasing' ? '↓' : '→'} ${Math.abs(trend.summary.trendPercent).toFixed(1)}%`);
  console.log('');

  // Daily breakdown (last 14 days max)
  console.log('Daily Costs:');
  const rows = trend.dataPoints.slice(-14).map((dp) => [
    dp.date,
    formatCost(dp.total),
    generateSparkline(dp.total, trend.summary.avgDaily * 2),
  ]);
  console.log(formatTable(['Date', 'Cost', 'Graph'], rows));
}

function displayBudget(budget: BudgetStatus | null, jsonMode: boolean): void {
  if (!budget) {
    if (jsonMode) {
      console.log(formatJson({ found: false, message: 'No budget configured' }));
    } else {
      console.log(formatInfo('No budget configured'));
    }
    return;
  }

  if (jsonMode) {
    console.log(formatJson({ found: true, ...budget }));
    return;
  }

  console.log('\nBudget Status');
  console.log('─'.repeat(40));

  const usedPercent = (budget.totalSpent / budget.initialCredit) * 100;
  const progressBar = generateProgressBar(usedPercent);

  console.log(`Initial Credit: ${formatCost(budget.initialCredit)}`);
  console.log(`Spent:  ${formatCost(budget.totalSpent)} (${usedPercent.toFixed(1)}%)`);
  console.log(`Remaining: ${formatCost(budget.remaining)}`);
  console.log(`Progress: ${progressBar}`);
  console.log('');
  console.log(`Days of runway: ${budget.daysOfRunway}`);
  console.log(`Projected monthly: ${formatCost(budget.projectedMonthly)}`);
  console.log(`Credit expires: ${budget.creditExpiration.split('T')[0]}`);
  console.log(`Within budget: ${budget.isWithinBudget ? 'Yes' : 'No'}`);
}

function generateSparkline(value: number, max: number): string {
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const normalized = Math.min(value / max, 1);
  const index = Math.floor(normalized * (bars.length - 1));
  return bars[index] ?? bars[0]!;
}

function generateProgressBar(percent: number): string {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));

  if (percent > 100) {
    return `[${bar}] ⚠️`;
  }
  if (percent > 80) {
    return `[${bar}] ⚠`;
  }
  return `[${bar}]`;
}
