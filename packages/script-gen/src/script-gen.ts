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
  ScriptGenOutputV2,
  AgentDraft,
  AgentProviderInfo,
  MultiAgentResult,
  DirectionDocument,
  DirectionSegment,
  SegmentType,
  ComponentName,
} from './types.js';
import {
  safeValidateDirectionDocument,
  MOTION_PRESETS,
} from './types.js';
import {
  buildWriterPrompt,
  buildCriticPrompt,
  buildOptimizerPrompt,
  buildWordCountAdjustmentPrompt,
} from './prompts.js';
import {
  detectSegmentType,
} from './compatibility.js';

// Default word count range
const DEFAULT_WORD_COUNT = { min: 1200, max: 1800 };

// Maximum regeneration attempts
const MAX_REGENERATION_ATTEMPTS = 3;

// Words per minute for TTS timing estimation (150 WPM = 2.5 words per second)
const WORDS_PER_MINUTE = 150;
const WORDS_PER_SECOND = WORDS_PER_MINUTE / 60; // 2.5

// Patterns for parsing dual output from optimizer
const NARRATION_PATTERN = /## NARRATION\s*\n([\s\S]*?)(?=## DIRECTION|$)/i;
const DIRECTION_PATTERN = /## DIRECTION\s*\n```json\n([\s\S]*?)\n```/i;

// Note: detectSegmentType is imported from compatibility.ts to avoid duplication

// Default visual templates based on segment type
const DEFAULT_VISUAL_TEMPLATE: Record<SegmentType, ComponentName> = {
  intro: 'BrandedTransition',
  hook: 'TextOnGradient',
  explanation: 'TextOnGradient',
  code_demo: 'CodeHighlight',
  comparison: 'ComparisonChart',
  example: 'TextOnGradient',
  transition: 'BrandedTransition',
  recap: 'KineticText',
  outro: 'BrandedTransition',
};

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate estimated duration in seconds from word count
 * Based on 150 words per minute (2.5 words per second)
 */
function calculateEstimatedDuration(wordCount: number): number {
  return wordCount / WORDS_PER_SECOND;
}

/**
 * Generate a URL-safe slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Extract keywords from text (first 3-5 significant words)
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but', 'and', 'or', 'if', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  // Get unique words and return first 5
  const unique = [...new Set(words)];
  return unique.slice(0, 5);
}


/**
 * Parse dual output from optimizer
 * Returns narration text and direction document (or null if parsing fails)
 * @exported for testing
 */
export function parseDualOutput(content: string): { narration: string; direction: DirectionDocument | null } {
  const narrationMatch = content.match(NARRATION_PATTERN);
  const directionMatch = content.match(DIRECTION_PATTERN);

  // Extract narration - fallback to full content if no section found
  const narration = narrationMatch?.[1]?.trim() ?? content;

  let direction: DirectionDocument | null = null;
  if (directionMatch?.[1]) {
    try {
      const parsed = JSON.parse(directionMatch[1]);
      const result = safeValidateDirectionDocument(parsed);
      if (result.success) {
        direction = result.data;
      } else {
        logger.warn({ errors: result.error.errors }, 'Direction document validation failed');
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to parse direction JSON from optimizer output');
    }
  }

  return { narration, direction };
}

/**
 * Generate segments from narration text when LLM fails to produce direction JSON
 * @exported for testing
 */
export function generateSegmentsFromNarration(
  narration: string,
  totalDurationSec: number
): DirectionSegment[] {
  // Split narration by double newlines (paragraph breaks)
  const paragraphs = narration
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Handle edge case: no paragraphs or single very short text
  if (paragraphs.length === 0) {
    paragraphs.push(narration.trim() || 'Content');
  }

  // Calculate word counts for each paragraph
  const segmentData = paragraphs.map((text, index) => ({
    text,
    wordCount: countWords(text),
    index,
  }));

  // Calculate total words for proportional timing
  const totalWords = segmentData.reduce((sum, s) => sum + s.wordCount, 0);

  // Handle edge case: no words
  const actualTotalWords = totalWords > 0 ? totalWords : segmentData.length;

  // Distribute timing and generate segments
  let currentTime = 0;

  return segmentData.map((data, index) => {
    const wordCount = data.wordCount > 0 ? data.wordCount : 1; // Prevent division by zero
    const proportion = wordCount / actualTotalWords;
    const duration = totalDurationSec * proportion;

    const segmentType = detectSegmentType(data.text, index, segmentData.length);
    const keywords = extractKeywords(data.text);

    const segment: DirectionSegment = {
      id: crypto.randomUUID(),
      index,
      type: segmentType,
      content: {
        text: data.text,
        wordCount: data.wordCount,
        keywords,
        emphasis: [], // No emphasis detection in fallback mode
      },
      timing: {
        estimatedStartSec: currentTime,
        estimatedEndSec: currentTime + duration,
        estimatedDurationSec: duration,
        timingSource: 'estimated',
      },
      visual: {
        template: DEFAULT_VISUAL_TEMPLATE[segmentType],
        motion: { ...MOTION_PRESETS.standard },
      },
      audio: {
        mood: 'neutral',
      },
    };

    currentTime += duration;
    return segment;
  });
}

/**
 * Strip visual cue brackets from text
 * Removes [VISUAL:...], [PRONOUNCE:...], [MUSIC:...], [SFX:...] tags
 * @exported for testing
 */
export function stripBrackets(text: string): string {
  return text
    .replace(/\[VISUAL:[^\]]+\]\s*/g, '')
    .replace(/\[PRONOUNCE:([^:]+):[^\]]+\]/g, '$1')
    .replace(/\[MUSIC:[^\]]+\]\s*/g, '')
    .replace(/\[SFX:[^\]]+\]\s*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Build a complete DirectionDocument from narration and segments
 */
function buildDirectionDocument(
  narration: string,
  segments: DirectionSegment[],
  totalDurationSec: number,
  topicData?: { title: string; url: string; source: string; publishedAt: string; viralityScore: number; metadata?: Record<string, unknown> }
): DirectionDocument {
  // Generate title and slug from topic data or narration
  const title = topicData?.title || extractTitleFromNarration(narration);
  const slug = generateSlug(title);

  return {
    version: '2.0',
    metadata: {
      title,
      slug,
      estimatedDurationSec: totalDurationSec,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      generatedAt: new Date().toISOString(),
    },
    segments,
    globalAudio: {
      defaultMood: 'neutral',
      musicTransitions: 'smooth',
    },
  };
}

/**
 * Extract a title from the first sentence of narration
 */
function extractTitleFromNarration(narration: string): string {
  // Get first sentence or first 50 words
  const firstLine = narration.split(/[.!?]/)[0]?.trim();
  if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
    return firstLine;
  }

  // Fallback to first N words
  const words = narration.split(/\s+/).slice(0, 10);
  if (words.length > 0) {
    return words.join(' ') + '...';
  }

  return 'Untitled';
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

      // Parse dual output from optimizer
      const { narration, direction } = parseDualOutput(finalScript);

      // Get clean narration text (strip any remaining brackets)
      const cleanNarration = stripBrackets(narration);
      const narrationWordCount = countWords(cleanNarration);

      // Calculate estimated duration based on narration word count
      const estimatedDurationSec = calculateEstimatedDuration(narrationWordCount);

      // Get or generate DirectionDocument
      let directionDocument: DirectionDocument;
      if (direction) {
        // LLM produced valid direction - use it but ensure timing is populated
        directionDocument = direction;

        // Update metadata with calculated duration if not set
        if (!directionDocument.metadata.estimatedDurationSec) {
          directionDocument.metadata.estimatedDurationSec = estimatedDurationSec;
        }

        // Ensure all segments have timing source set to 'estimated'
        directionDocument.segments = directionDocument.segments.map((segment) => ({
          ...segment,
          timing: {
            ...segment.timing,
            timingSource: 'estimated' as const,
          },
        }));

        logger.info({ pipelineId, segmentCount: directionDocument.segments.length }, 'Using LLM-generated direction document');
      } else {
        // Fallback: generate direction from narration paragraphs
        logger.warn({ pipelineId }, 'LLM failed to produce valid direction JSON, using paragraph-based fallback');

        const segments = generateSegmentsFromNarration(cleanNarration, estimatedDurationSec);
        directionDocument = buildDirectionDocument(
          cleanNarration,
          segments,
          estimatedDurationSec,
          data.topicData
        );
      }

      // Update title/slug from topic data if available
      if (data.topicData?.title) {
        directionDocument.metadata.title = data.topicData.title;
        directionDocument.metadata.slug = generateSlug(data.topicData.title);
      }

      // Save script.md (plain narration) to Cloud Storage
      const scriptUrl = await storage.uploadArtifact(
        pipelineId,
        'script-gen',
        'script.md',
        cleanNarration,
        'text/markdown'
      );

      // Save direction.json to Cloud Storage
      const directionUrl = await storage.uploadArtifact(
        pipelineId,
        'script-gen',
        'direction.json',
        JSON.stringify(directionDocument, null, 2),
        'application/json'
      );

      // Keep legacy artifactUrl pointing to script.md for V1 compatibility
      const artifactUrl = scriptUrl;

      logger.info(
        { pipelineId, scriptUrl, directionUrl, segmentCount: directionDocument.segments.length },
        'V2 dual output saved to Cloud Storage'
      );

      // Build V2 output structure
      const output: ScriptGenOutputV2 = {
        // V2 fields
        version: '2.0',
        scriptText: cleanNarration,
        scriptUrl,
        directionDocument,
        directionUrl,
        // V1 compatible fields (for backward compatibility)
        script: cleanNarration, // Plain narration for V1 consumers (use getScriptText() for best compatibility)
        wordCount: narrationWordCount,
        artifactUrl,
        draftUrls,
        regenerationAttempts,
        providers: {
          writer: multiAgentResult.writerDraft.provider,
          critic: multiAgentResult.criticDraft.provider,
          optimizer: multiAgentResult.optimizerDraft.provider,
        },
        quality: {
          metrics: { wordCount: narrationWordCount, targetMin: targetWordCount.min, targetMax: targetWordCount.max },
          status: qualityStatus,
          reason: validation.valid ? undefined : validation.reason,
        },
        // Pass-through topic data for YouTube metadata generation
        topicData: data.topicData,
      };

      return output;
    },
    { qualityGate: 'script-gen' }
  );
}
