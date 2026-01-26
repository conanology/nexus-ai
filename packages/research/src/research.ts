/**
 * Research stage implementation
 * Generates comprehensive research briefs from selected news topics
 *
 * @module @nexus-ai/research/research
 */

import {
  StageInput,
  StageOutput,
  executeStage,
  withFallback,
  CloudStorageClient,
  GeminiLLMProvider,
  NexusError,
  CostTracker,
  logger,
} from '@nexus-ai/core';
import type { ResearchInput, ResearchOutput, ResearchPromptConfig } from './types.js';

/**
 * Build research prompt for Gemini
 * Instructs the LLM to act as a deep-tech researcher
 */
function buildResearchPrompt(config: ResearchPromptConfig, language: string = 'English'): string {
  const { url, title, description, metadata } = config;

  return `You are a deep-tech researcher specializing in AI, machine learning, and emerging technologies. Your task is to generate a comprehensive 2,000-word research brief on the following topic for use in a YouTube video script.

OUTPUT LANGUAGE: ${language}

TOPIC INFORMATION:
- Title: ${title}
- URL: ${url}
${description ? `- Description: ${description}` : ''}
${metadata ? `- Additional Context: ${JSON.stringify(metadata, null, 2)}` : ''}

RESEARCH BRIEF REQUIREMENTS:
1. **Facts and Data**: Include concrete facts, statistics, and technical details
2. **Historical Context**: Explain the background and evolution of this technology/topic
3. **Technical Implications**: Analyze the technical significance and potential impact
4. **Key Quotes**: Extract or suggest relevant quotes from experts or documentation
5. **Current State**: Describe the current state of development or adoption
6. **Future Outlook**: Discuss potential future developments and trends

FORMAT REQUIREMENTS:
- Write in markdown format
- Target length: 2,000 words (minimum 1,800, maximum 2,200)
- Use clear section headings (## for main sections)
- Be factual, technical, and authoritative
- Focus on information that would be valuable for creating an educational YouTube video

OUTPUT STRUCTURE:
## Overview
[Brief introduction to the topic]

## Background and History
[Historical context and evolution]

## Technical Deep Dive
[Detailed technical explanation]

## Current State and Adoption
[Current developments and real-world usage]

## Implications and Impact
[Analysis of significance and potential impact]

## Future Outlook
[Predictions and potential developments]

## Key Takeaways
[Summarize the most important points]

Generate the research brief now in ${language}:`;
}

/**
 * Parse and count words in the research brief
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Execute the research stage
 * Generates a comprehensive research brief from a selected topic
 *
 * @param input - Stage input with topic data
 * @returns Stage output with research brief
 */
export async function executeResearch(
  input: StageInput<ResearchInput>
): Promise<StageOutput<ResearchOutput>> {
  return executeStage<ResearchInput, ResearchOutput>(
    input,
    'research',
    async (data, config) => {
      const { pipelineId } = input;
      const { topic } = data;
      
      // Safe tracker extraction
      const tracker = (config as any).tracker instanceof CostTracker 
        ? (config as any).tracker as CostTracker 
        : new CostTracker(pipelineId, 'research');

      // Validate input
      if (!topic?.url || !topic?.title) {
        throw NexusError.critical(
          'NEXUS_RESEARCH_INVALID_INPUT',
          'Topic must have url and title',
          'research',
          { topic }
        );
      }

      logger.info({ pipelineId, topic: topic.title }, 'Building research prompt');

      // Build research prompt with language support
      const language = (config.language as string) || 'English';
      const prompt = buildResearchPrompt({
        url: topic.url,
        title: topic.title,
        description: topic.description,
        metadata: topic.metadata,
      }, language);

      // Set up LLM providers with fallback
      const primaryProvider = new GeminiLLMProvider('gemini-3-pro-preview');
      const fallbackProvider = new GeminiLLMProvider('gemini-2.5-pro');
      const providers = [primaryProvider, fallbackProvider];

      logger.info({ pipelineId, model: primaryProvider.name }, 'Generating research brief via LLM');

      // Execute with fallback (GeminiLLMProvider handles internal retries)
      const fallbackResult = await withFallback(
        providers,
        async (provider) => {
          const llmResult = await provider.generate(prompt, {
            temperature: 0.7,
            maxTokens: 8192, // Increased from 3000 to avoid truncation
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
          stage: 'research',
          onFallback: (from, to, error) => {
            logger.warn({ pipelineId, from, to, errorCode: error.code }, 'Research LLM fallback triggered');
          }
        }
      );

      const brief = fallbackResult.result;
      const providerName = fallbackResult.provider;
      const providerTier = fallbackResult.tier;

      // Count words
      const wordCount = countWords(brief);
      logger.info({ pipelineId, wordCount, provider: providerName }, 'Research brief generated');

      // Store research brief in Cloud Storage
      logger.info({ pipelineId }, 'Uploading research artifact to Cloud Storage');
      const storage = new CloudStorageClient();
      const artifactUrl = await storage.uploadArtifact(
        pipelineId,
        'research',
        'research.md',
        brief,
        'text/markdown'
      );

      // Return the research output with provider info
      // Pass through topic data for downstream stages (YouTube metadata)
      return {
        brief,
        researchBrief: brief,
        wordCount,
        artifactUrl,
        provider: {
          name: providerName,
          tier: providerTier,
          attempts: fallbackResult.attempts.length,
        },
        // Pass-through topic for YouTube metadata generation
        topicData: {
          title: topic.title,
          url: topic.url,
          source: topic.source || 'unknown',
          publishedAt: (topic as any).publishedAt || new Date().toISOString(),
          viralityScore: (topic as any).viralityScore || 0,
          metadata: topic.metadata,
        },
      };
    },
    { qualityGate: 'research' }
  );
}
