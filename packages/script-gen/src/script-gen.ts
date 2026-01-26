/**
 * Script generation stage implementation
 * Multi-agent pipeline: Writer → Critic → Optimizer
 *
 * @module @nexus-ai/script-gen/script-gen
 */

import {
  type StageInput,
  type StageOutput,
  type StageConfig,
  type LLMProvider,
  executeStage,
  withFallback,
  CloudStorageClient,
  GeminiLLMProvider,
  NexusError,
  CostTracker,
  logger,
} from '@nexus-ai/core';
import type {
  ScriptGenInput,
  ScriptGenOutput,
  AgentDraft,
  AgentProviderInfo,
  MultiAgentResult,
} from './types.js';
import {
  buildWriterPrompt,
  buildCriticPrompt,
  buildOptimizerPrompt,
  buildWordCountAdjustmentPrompt,
} from './prompts.js';

// Default word count range
const DEFAULT_WORD_COUNT = { min: 1200, max: 1800 };

// Maximum regeneration attempts
const MAX_REGENERATION_ATTEMPTS = 3;

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate script meets word count requirements
 */
function validateWordCount(
  wordCount: number,
  targetWordCount: { min: number; max: number }
): { valid: boolean; reason?: string } {
  if (wordCount < targetWordCount.min) {
    return {
      valid: false,
      reason: `Script is too short (${wordCount} words, minimum ${targetWordCount.min})`,
    };
  }
  if (wordCount > targetWordCount.max) {
    return {
      valid: false,
      reason: `Script is too long (${wordCount} words, maximum ${targetWordCount.max})`,
    };
  }
  return { valid: true };
}

/**
 * Execute a single agent with fallback
 */
async function executeAgent(
  agentName: 'writer' | 'critic' | 'optimizer',
  prompt: string,
  tracker: CostTracker,
  pipelineId: string,
  providers: LLMProvider[]
): Promise<AgentDraft> {
  logger.info({ pipelineId, agent: agentName, model: providers[0].name }, `Executing ${agentName} agent`);

  const fallbackResult = await withFallback(
    providers,
    async (provider: LLMProvider) => {
      const llmResult = await provider.generate(prompt, {
        temperature: 0.7,
        maxTokens: 8192, // High token limit for script generation
      });

      // Track costs
      tracker.recordApiCall(
        provider.name,
        {
          input: llmResult.tokens.input,
          output: llmResult.tokens.output,
        },
        llmResult.cost
      );

      return llmResult.text;
    },
    {
      stage: 'script-gen',
      onFallback: (from: string, to: string, error: Error & { code?: string }) => {
        logger.warn(
          { pipelineId, agent: agentName, from, to, errorCode: error.code },
          `${agentName} agent fallback triggered`
        );
      },
    }
  );

  const content = fallbackResult.result;
  const wordCount = countWords(content);

  const providerInfo: AgentProviderInfo = {
    name: fallbackResult.provider,
    tier: fallbackResult.tier,
    attempts: fallbackResult.attempts.length,
  };

  logger.info(
    { pipelineId, agent: agentName, wordCount, provider: providerInfo.name },
    `${agentName} agent completed`
  );

  return {
    content,
    wordCount,
    provider: providerInfo,
  };
}

/**
 * Execute multi-agent pipeline: Writer → Critic → Optimizer
 */
async function executeMultiAgentPipeline(
  researchBrief: string,
  targetWordCount: { min: number; max: number },
  tracker: CostTracker,
  pipelineId: string,
  language: string = 'English'
): Promise<MultiAgentResult> {
  // Shared providers to avoid redundant instantiation
  const providers = [
    new GeminiLLMProvider('gemini-3-pro-preview'),
    new GeminiLLMProvider('gemini-2.5-pro'),
  ];

  // Phase 1: Writer
  const writerPrompt = buildWriterPrompt(researchBrief, targetWordCount, language);
  const writerDraft = await executeAgent('writer', writerPrompt, tracker, pipelineId, providers);

  // Phase 2: Critic
  const criticPrompt = buildCriticPrompt(writerDraft.content, targetWordCount, language);
  const criticDraft = await executeAgent('critic', criticPrompt, tracker, pipelineId, providers);

  // Extract the revised script from critic's output
  // Robust extraction: look for "## Revised Script" or similar, otherwise fallback to full content
  const revisedScriptMatch = criticDraft.content.match(/(?:##\s*Revised\s+Script|REVISED\s+SCRIPT:?)\s*\n([\s\S]*)/i);
  const criticRevisedContent = revisedScriptMatch ? revisedScriptMatch[1].trim() : criticDraft.content;

  // Phase 3: Optimizer
  const optimizerPrompt = buildOptimizerPrompt(criticRevisedContent, targetWordCount, language);
  const optimizerDraft = await executeAgent('optimizer', optimizerPrompt, tracker, pipelineId, providers);

  return {
    writerDraft,
    criticDraft: {
      ...criticDraft,
      content: criticRevisedContent, // Use the extracted revised script
    },
    optimizerDraft,
  };
}

/**
 * Save agent drafts to Cloud Storage
 */
async function saveDrafts(
  pipelineId: string,
  multiAgentResult: MultiAgentResult,
  storage: CloudStorageClient
): Promise<{ writer: string; critic: string; optimizer: string }> {
  logger.info({ pipelineId }, 'Saving agent drafts to Cloud Storage');

  const [writerUrl, criticUrl, optimizerUrl] = await Promise.all([
    storage.uploadArtifact(
      pipelineId,
      'script-drafts',
      'v1-writer.md',
      multiAgentResult.writerDraft.content,
      'text/markdown'
    ),
    storage.uploadArtifact(
      pipelineId,
      'script-drafts',
      'v2-critic.md',
      multiAgentResult.criticDraft.content,
      'text/markdown'
    ),
    storage.uploadArtifact(
      pipelineId,
      'script-drafts',
      'v3-optimizer.md',
      multiAgentResult.optimizerDraft.content,
      'text/markdown'
    ),
  ]);

  logger.info({ pipelineId }, 'All agent drafts saved successfully');

  return {
    writer: writerUrl,
    critic: criticUrl,
    optimizer: optimizerUrl,
  };
}

/**
 * Execute the script generation stage
 * Multi-agent pipeline with word count validation and regeneration
 *
 * @param input - Stage input with research brief
 * @returns Stage output with final script and drafts
 */
export async function executeScriptGen(
  input: StageInput<ScriptGenInput>
): Promise<StageOutput<ScriptGenOutput>> {
  return executeStage<ScriptGenInput, ScriptGenOutput>(
    input,
    'script-gen',
    async (data: ScriptGenInput, config: StageConfig) => {
      const { pipelineId } = input;
      const { researchBrief } = data;

      // Safe tracker extraction
      const tracker =
        (config as any).tracker instanceof CostTracker
          ? ((config as any).tracker as CostTracker)
          : new CostTracker(pipelineId, 'script-gen');

      // Validate input
      if (!researchBrief || researchBrief.trim().length === 0) {
        throw NexusError.critical(
          'NEXUS_SCRIPTGEN_INVALID_INPUT',
          'Research brief is required and cannot be empty',
          'script-gen',
          { researchBrief }
        );
      }

      const targetWordCount = data.targetWordCount || DEFAULT_WORD_COUNT;
      const language = (config.language as string) || 'English';

      logger.info(
        { pipelineId, targetWordCount, language },
        'Starting multi-agent script generation'
      );

      // Shared providers
      const providers = [
        new GeminiLLMProvider('gemini-3-pro-preview'),
        new GeminiLLMProvider('gemini-2.5-pro'),
      ];

      // Execute multi-agent pipeline
      let multiAgentResult = await executeMultiAgentPipeline(
        researchBrief,
        targetWordCount,
        tracker,
        pipelineId,
        language
      );

      let finalScript = multiAgentResult.optimizerDraft.content;
      let wordCount = multiAgentResult.optimizerDraft.wordCount;
      let regenerationAttempts = 0;

      // Validate word count and regenerate if needed (max 3 attempts)
      let validation = validateWordCount(wordCount, targetWordCount);
      while (!validation.valid && regenerationAttempts < MAX_REGENERATION_ATTEMPTS) {
        regenerationAttempts++;
        logger.warn(
          { pipelineId, wordCount, targetWordCount, attempt: regenerationAttempts },
          `Word count validation failed: ${validation.reason}. Regenerating...`
        );

        // Generate adjustment prompt
        const adjustmentPrompt = buildWordCountAdjustmentPrompt(
          finalScript,
          wordCount,
          targetWordCount,
          language
        );

        // Execute adjustment
        const adjustedDraft = await executeAgent(
          'optimizer',
          adjustmentPrompt,
          tracker,
          pipelineId,
          providers
        );

        finalScript = adjustedDraft.content;
        wordCount = adjustedDraft.wordCount;

        // Update optimizer draft with adjusted version
        multiAgentResult.optimizerDraft = adjustedDraft;

        // Re-validate
        validation = validateWordCount(wordCount, targetWordCount);
      }

      // Final validation check - log warning but continue with degraded quality
      const qualityStatus = validation.valid ? 'PASS' : 'DEGRADED';
      if (!validation.valid) {
        logger.warn(
          { pipelineId, wordCount, targetWordCount, regenerationAttempts, qualityStatus },
          `Script word count outside target after ${MAX_REGENERATION_ATTEMPTS} attempts: ${validation.reason}. Continuing with DEGRADED quality.`
        );
      } else {
        logger.info(
          { pipelineId, wordCount, regenerationAttempts },
          'Script generation complete and validated'
        );
      }

      // Save all drafts to Cloud Storage
      const storage = new CloudStorageClient();
      const draftUrls = await saveDrafts(pipelineId, multiAgentResult, storage);

      // Save final script
      const artifactUrl = await storage.uploadArtifact(
        pipelineId,
        'script-gen',
        'script.md',
        finalScript,
        'text/markdown'
      );

      logger.info({ pipelineId, artifactUrl }, 'Final script saved to Cloud Storage');

      return {
        script: finalScript,
        wordCount,
        artifactUrl,
        draftUrls,
        regenerationAttempts,
        providers: {
          writer: multiAgentResult.writerDraft.provider,
          critic: multiAgentResult.criticDraft.provider,
          optimizer: multiAgentResult.optimizerDraft.provider,
        },
        quality: {
          metrics: { wordCount, targetMin: targetWordCount.min, targetMax: targetWordCount.max },
          status: qualityStatus,
          reason: validation.valid ? undefined : validation.reason,
        },
        // Pass-through topic data for YouTube metadata generation
        topicData: data.topicData,
      };
    },
    { qualityGate: 'script-gen' }
  );
}
