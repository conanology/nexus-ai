/**
 * Visual generation stage implementation
 */

import type { StageInput, StageOutput, QualityMetrics, StageCostSummary, ArtifactRef } from '@nexus-ai/core';
import { logger, CloudStorageClient } from '@nexus-ai/core';
import { NexusError } from '@nexus-ai/core';
import type { VisualGenInput, VisualGenOutput, SceneMapping } from './types.js';
import { parseVisualCues } from './visual-cue-parser.js';
import { SceneMapper } from './scene-mapper.js';
import { generateTimeline } from './timeline.js';

/**
 * Execute visual generation stage
 * Converts script with visual cues to scene timeline
 */
export async function executeVisualGen(
  input: StageInput<VisualGenInput>
): Promise<StageOutput<VisualGenOutput>> {
  const startTime = Date.now();
  const { pipelineId, data } = input;

  logger.info({
    msg: 'Visual generation stage started',
    pipelineId,
    stage: 'visual-gen',
    scriptLength: data.script.length,
    audioDuration: data.audioDurationSec,
  });

  try {
    // Step 1: Parse visual cues from script
    const visualCues = parseVisualCues(data.script);

    logger.info({
      msg: 'Visual cues parsed',
      pipelineId,
      stage: 'visual-gen',
      cueCount: visualCues.length,
    });

    if (visualCues.length === 0) {
      logger.warn({
        msg: 'No visual cues found in script',
        pipelineId,
        stage: 'visual-gen',
      });
    }

    // Step 2: Map cues to components using SceneMapper
    const mapper = new SceneMapper();
    const sceneMappings: SceneMapping[] = [];

    for (const cue of visualCues) {
      const mapping = await mapper.mapCueWithLLMFallback(cue);
      if (mapping) {
        sceneMappings.push(mapping);
        logger.info({
          msg: 'Visual cue mapped',
          pipelineId,
          stage: 'visual-gen',
          cueIndex: cue.index,
          description: cue.description,
          component: mapping.component,
        });
      } else {
        logger.warn({
          msg: 'Failed to map visual cue',
          pipelineId,
          stage: 'visual-gen',
          cueIndex: cue.index,
          description: cue.description,
        });
      }
    }

    // Step 3: Generate timeline aligned to audio duration
    const timeline = generateTimeline(sceneMappings, data.audioDurationSec);

    logger.info({
      msg: 'Timeline generated',
      pipelineId,
      stage: 'visual-gen',
      sceneCount: timeline.scenes.length,
      audioDuration: timeline.audioDurationSec,
    });

    // Step 4: Generate Cloud Storage path and URL
    const storagePath = `${pipelineId}/visual-gen/scenes.json`;
    const timelineJson = JSON.stringify(timeline, null, 2);
    
    // Upload to Cloud Storage
    const storageClient = new CloudStorageClient(process.env.NEXUS_BUCKET_NAME || 'nexus-ai-artifacts');
    const timelineUrl = await storageClient.uploadFile(
      storagePath,
      timelineJson,
      'application/json'
    );

    logger.info({
      msg: 'Timeline path generated',
      pipelineId,
      stage: 'visual-gen',
      url: timelineUrl,
      size: timelineJson.length,
    });

    // Step 5: Calculate quality metrics
    const fallbackUsage = mapper.getFallbackUsage();
    const fallbackPercentage = visualCues.length > 0
      ? (fallbackUsage / visualCues.length) * 100
      : 0;

    // Warn if fallback usage >30%
    const warnings: string[] = [];
    if (fallbackPercentage > 30) {
      const warning = `High LLM fallback usage: ${fallbackPercentage.toFixed(1)}% (${fallbackUsage}/${visualCues.length} cues)`;
      warnings.push(warning);
      logger.warn({
        msg: 'High LLM fallback usage detected',
        pipelineId,
        stage: 'visual-gen',
        fallbackUsage,
        totalCues: visualCues.length,
        percentage: fallbackPercentage,
      });
    }

    // Calculate timeline alignment error
    const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const alignmentError = data.audioDurationSec > 0
      ? Math.abs(totalDuration - data.audioDurationSec) / data.audioDurationSec
      : 0;

    if (alignmentError > 0.05) {
      const warning = `Timeline alignment error: ${(alignmentError * 100).toFixed(1)}%`;
      warnings.push(warning);
      logger.warn({
        msg: 'Timeline alignment error exceeds 5%',
        pipelineId,
        stage: 'visual-gen',
        expectedDuration: data.audioDurationSec,
        actualDuration: totalDuration,
        errorPercentage: alignmentError * 100,
      });
    }

    // Check for unmapped cues
    const unmappedCues = visualCues.length - sceneMappings.length;
    if (unmappedCues > 0) {
      const warning = `Unmapped visual cues: ${unmappedCues}`;
      warnings.push(warning);
      logger.error({
        msg: 'Some visual cues could not be mapped',
        pipelineId,
        stage: 'visual-gen',
        unmappedCount: unmappedCues,
        totalCues: visualCues.length,
      });
    }

    // Build quality metrics
    const quality: QualityMetrics = {
      stage: 'visual-gen',
      timestamp: new Date().toISOString(),
      measurements: {
        sceneCount: timeline.scenes.length,
        fallbackUsage,
        fallbackPercentage,
        unmappedCues,
        timelineAlignmentError: alignmentError,
      },
    };

    // Build cost breakdown
    const llmCost = mapper.getTotalCost();
    const cost: StageCostSummary = {
      stage: 'visual-gen',
      totalCost: llmCost,
      breakdown: [
        {
          service: 'gemini-llm',
          cost: llmCost,
          tokens: {},
          callCount: fallbackUsage,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Build artifacts array
    const artifacts: ArtifactRef[] = [
      {
        type: 'json',
        url: timelineUrl,
        size: timelineJson.length,
        contentType: 'application/json',
        generatedAt: new Date().toISOString(),
        stage: 'visual-gen',
      },
    ];

    // Build output
    const output: StageOutput<VisualGenOutput> = {
      success: true,
      data: {
        timelineUrl,
        sceneCount: timeline.scenes.length,
        fallbackUsage,
      },
      artifacts,
      quality,
      cost,
      durationMs: Date.now() - startTime,
      provider: {
        name: 'keyword-matching',
        tier: fallbackUsage > 0 ? 'fallback' : 'primary',
        attempts: 1,
      },
      warnings,
    };

    logger.info({
      msg: 'Visual generation stage complete',
      pipelineId,
      stage: 'visual-gen',
      durationMs: output.durationMs,
      sceneCount: timeline.scenes.length,
      fallbackUsage,
      cost: cost.totalCost,
    });

    return output;

  } catch (error) {
    logger.error({
      msg: 'Visual generation stage failed',
      pipelineId,
      stage: 'visual-gen',
      error,
      durationMs: Date.now() - startTime,
    });

    throw NexusError.fromError(error, 'visual-gen');
  }
}
