/**
 * Troll Agent — Adversarial retention debate loop
 *
 * Evaluates script drafts for viewer retention weaknesses via
 * a multi-round debate between the Troll (critic) and Writer (reviser).
 *
 * @module @nexus-ai/script-gen/troll-agent
 */

import {
  type LLMProvider,
  CostTracker,
  withFallback,
  logger,
} from '@nexus-ai/core';
import type {
  TrollEvaluation,
  DebateRound,
  DebateResult,
  AgentProviderInfo,
} from './types.js';
import { buildTrollPrompt, buildTrollRevisionPrompt } from './prompts.js';

/** Default approval threshold */
const DEFAULT_APPROVAL_THRESHOLD = 70;

/** Default maximum debate rounds */
const DEFAULT_MAX_ROUNDS = 3;

/**
 * Parse the Troll Agent's JSON evaluation from LLM output
 */
function parseTrollEvaluation(raw: string): TrollEvaluation {
  // Try to extract JSON from markdown fences or raw text
  let jsonStr = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    return {
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0,
      approved: typeof parsed.approved === 'boolean' ? parsed.approved : false,
      critique: typeof parsed.critique === 'string' ? parsed.critique : 'No critique provided.',
      metrics: {
        hookCount: typeof parsed.metrics?.hookCount === 'number' ? parsed.metrics.hookCount : 0,
        openLoopCount: typeof parsed.metrics?.openLoopCount === 'number' ? parsed.metrics.openLoopCount : 0,
        longestGapSec: typeof parsed.metrics?.longestGapSec === 'number' ? parsed.metrics.longestGapSec : 0,
      },
    };
  } catch {
    // If JSON parsing fails, return a default low-score evaluation
    logger.warn('Failed to parse Troll evaluation JSON, using default low score');
    return {
      score: 30,
      approved: false,
      critique: raw.slice(0, 2000), // Use raw text as critique
      metrics: { hookCount: 0, openLoopCount: 0, longestGapSec: 30 },
    };
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Execute a single LLM call (Troll evaluation or Writer revision)
 */
async function executeLLMCall(
  prompt: string,
  tracker: CostTracker,
  pipelineId: string,
  providers: LLMProvider[],
  agentName: string,
  temperature: number
): Promise<{ text: string; provider: AgentProviderInfo }> {
  const fallbackResult = await withFallback(
    providers,
    async (provider: LLMProvider) => {
      const llmResult = await provider.generate(prompt, {
        temperature,
        maxTokens: 8192,
      });

      tracker.recordApiCall(
        provider.name,
        { input: llmResult.tokens.input, output: llmResult.tokens.output },
        llmResult.cost
      );

      return llmResult.text;
    },
    {
      stage: 'script-gen',
      onFallback: (from: string, to: string, error: Error & { code?: string }) => {
        logger.warn(
          { pipelineId, agent: agentName, from, to, errorCode: error.code },
          `${agentName} fallback triggered`
        );
      },
    }
  );

  return {
    text: fallbackResult.result,
    provider: {
      name: fallbackResult.provider,
      tier: fallbackResult.tier,
      attempts: fallbackResult.attempts.length,
    },
  };
}

/**
 * Execute the Troll Agent debate loop
 *
 * Flow:
 * 1. Troll evaluates the Critic's draft
 * 2. If approved (score >= threshold) → exit with approved draft
 * 3. If not → Writer revises based on critique
 * 4. Repeat up to maxRounds
 * 5. Select the highest-scoring draft
 *
 * @param criticDraft - The Critic's revised draft to evaluate
 * @param researchBrief - Original research brief for context
 * @param tracker - Cost tracker for API calls
 * @param pipelineId - Pipeline run ID
 * @param providers - LLM providers (with fallback chain)
 * @param options - Optional configuration overrides
 * @returns DebateResult with best draft and round history
 */
export async function executeTrollDebate(
  criticDraft: string,
  researchBrief: string,
  tracker: CostTracker,
  pipelineId: string,
  providers: LLMProvider[],
  options?: { maxRounds?: number; approvalThreshold?: number }
): Promise<DebateResult> {
  const maxRounds = options?.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const approvalThreshold = options?.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;

  const rounds: DebateRound[] = [];
  let currentDraft = criticDraft;

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    // Step 1: Troll evaluates the current draft
    const trollPrompt = buildTrollPrompt(currentDraft, researchBrief);
    const trollResponse = await executeLLMCall(
      trollPrompt,
      tracker,
      pipelineId,
      providers,
      `troll-round-${roundNum}`,
      0.4 // Slightly creative for interesting critiques
    );

    const evaluation = parseTrollEvaluation(trollResponse.text);

    // Override the approved flag based on threshold
    evaluation.approved = evaluation.score >= approvalThreshold;

    const round: DebateRound = {
      roundNumber: roundNum,
      draftText: currentDraft,
      wordCount: countWords(currentDraft),
      trollScore: evaluation.score,
      trollApproved: evaluation.approved,
      trollCritique: evaluation.critique,
      hookCount: evaluation.metrics.hookCount,
      openLoopCount: evaluation.metrics.openLoopCount,
      longestGapSec: evaluation.metrics.longestGapSec,
      provider: trollResponse.provider,
    };
    rounds.push(round);

    logger.info(
      {
        pipelineId,
        round: roundNum,
        score: evaluation.score,
        approved: evaluation.approved,
        hookCount: evaluation.metrics.hookCount,
        openLoopCount: evaluation.metrics.openLoopCount,
      },
      `[Troll] Round ${roundNum}: Score ${evaluation.score}/100 — ${evaluation.approved ? 'APPROVED' : 'NOT APPROVED'}`
    );

    // Step 2: If approved, exit early
    if (evaluation.approved) {
      return {
        bestDraft: currentDraft,
        bestScore: evaluation.score,
        rounds,
        approvedOnRound: roundNum,
        totalRounds: roundNum,
      };
    }

    // Step 3: If not the last round, Writer revises based on critique
    if (roundNum < maxRounds) {
      const revisionPrompt = buildTrollRevisionPrompt(
        currentDraft,
        evaluation.critique,
        researchBrief
      );
      const writerResponse = await executeLLMCall(
        revisionPrompt,
        tracker,
        pipelineId,
        providers,
        `writer-revision-${roundNum}`,
        0.7 // Standard writer temperature
      );

      currentDraft = writerResponse.text;

      logger.info(
        { pipelineId, round: roundNum, wordCount: countWords(currentDraft) },
        `[Writer] Revised draft based on Troll critique`
      );
    }
  }

  // No approval after all rounds — select highest-scoring draft
  const bestRound = rounds.reduce((best, r) => (r.trollScore > best.trollScore ? r : best), rounds[0]);

  logger.warn(
    {
      pipelineId,
      bestScore: bestRound.trollScore,
      bestRound: bestRound.roundNumber,
      totalRounds: rounds.length,
    },
    `[Troll] No approval after ${rounds.length} rounds — selecting best draft (Round ${bestRound.roundNumber}, Score ${bestRound.trollScore}/100)`
  );

  return {
    bestDraft: bestRound.draftText,
    bestScore: bestRound.trollScore,
    rounds,
    approvedOnRound: null,
    totalRounds: rounds.length,
  };
}
