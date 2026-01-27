/**
 * Visual generation stage implementation
 */

import type { StageInput, StageOutput, ArtifactRef } from '@nexus-ai/core';
import { logger, CloudStorageClient, executeStage, NexusError } from '@nexus-ai/core';
import type { VisualGenInput, VisualGenOutput, SceneMapping } from './types.js';
import { parseVisualCues } from './visual-cue-parser.js';
import { SceneMapper } from './scene-mapper.js';
import { generateTimeline } from './timeline.js';

/**
 * Resolve segment start time from a direction document segment's timing.
 * Prefers actualStartSec (from timestamp-extraction), falls back to estimatedStartSec.
 * Currently used for V2 timing logging; will drive scene timing in stories 6.16+.
 */
export function resolveSegmentStartSec(timing: { actualStartSec?: number; estimatedStartSec?: number }): number | undefined {
  return timing.actualStartSec ?? timing.estimatedStartSec;
}

/**
 * Resolve segment duration from a direction document segment's timing.
 * Prefers actualDurationSec (from timestamp-extraction), falls back to estimatedDurationSec.
 * Currently used for V2 timing logging; will drive scene duration in stories 6.16+.
 */
export function resolveSegmentDurationSec(timing: { actualDurationSec?: number; estimatedDurationSec?: number }): number | undefined {
  return timing.actualDurationSec ?? timing.estimatedDurationSec;
}

/**
 * Execute visual generation stage
 * Converts script with visual cues to scene timeline
 */
export async function executeVisualGen(
  input: StageInput<VisualGenInput>
): Promise<StageOutput<VisualGenOutput>> {
  return executeStage(input, 'visual-gen', async (data, config) => {
    const { pipelineId } = input;

    // Detect V2 path (directionDocument present from timestamp-extraction)
    const hasDirectionDocument = !!data.directionDocument;

    logger.info({
      msg: 'Visual generation stage started',
      pipelineId,
      stage: 'visual-gen',
      scriptLength: data.script.length,
      audioDuration: data.audioDurationSec,
      v2Path: hasDirectionDocument,
      segmentCount: hasDirectionDocument ? data.directionDocument!.segments.length : undefined,
      hasWordTimings: !!data.wordTimings,
    });

    // V2 path: directionDocument is available with segment timings.
    // For now, still use existing script-based flow (full V2 rendering is later stories 6.16+).
    // The directionDocument timing data is logged and available for future use.
    if (hasDirectionDocument) {
      const segments = data.directionDocument!.segments;
      const timingSummary = segments.map((seg) => ({
        id: seg.id,
        type: seg.type,
        startSec: resolveSegmentStartSec(seg.timing),
        durationSec: resolveSegmentDurationSec(seg.timing),
        timingSource: seg.timing.timingSource,
      }));

      logger.info({
        msg: 'V2 direction document available - timing data resolved',
        pipelineId,
        stage: 'visual-gen',
        segmentCount: segments.length,
        timingSource: segments[0]?.timing.timingSource,
        timingSummary,
      });
    }

    // Step 1: Parse visual cues from script (V1 and V2 both use script-based flow for now)
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

    // Step 2: Map cues to components using SceneMapper with TextOnGradient fallback
    const mapper = new SceneMapper();
    const sceneMappings: SceneMapping[] = [];

    for (const cue of visualCues) {
      // Use mapCueWithFallback which always returns a mapping (TextOnGradient if no match)
      const mapping = await mapper.mapCueWithFallback(cue);
      sceneMappings.push(mapping);
      logger.info({
        msg: 'Visual cue mapped',
        pipelineId,
        stage: 'visual-gen',
        cueIndex: cue.index,
        description: cue.description,
        component: mapping.component,
      });
    }

    // Record costs from mapper (LLM usage)
    if (config.tracker && typeof (config.tracker as any).recordApiCall === 'function') {
      const mapperCost = mapper.getTotalCost();
      if (mapperCost > 0) {
        (config.tracker as any).recordApiCall(
          'gemini-3-pro-preview', // Assuming SceneMapper uses this model
          { input: 0, output: 0 },
          mapperCost
        );
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

    // Step 5: Call render service to generate video
    const renderServiceUrl = process.env.RENDER_SERVICE_URL || 'http://localhost:8081';
    const renderSecret = process.env.NEXUS_SECRET || '';

    logger.info({
      msg: 'Calling render service',
      pipelineId,
      stage: 'visual-gen',
      renderServiceUrl,
      timelineUrl,
      audioUrl: data.audioUrl,
    });

    const renderResponse = await fetch(`${renderServiceUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nexus-Secret': renderSecret,
      },
      body: JSON.stringify({
        pipelineId,
        timelineUrl,
        audioUrl: data.audioUrl,
        resolution: '1080p',
      }),
    });

    if (!renderResponse.ok) {
      const errorBody = await renderResponse.text().catch(() => 'unknown');
      throw NexusError.critical(
        'NEXUS_RENDER_FAILED',
        `Render service returned ${renderResponse.status}: ${errorBody}`,
        'visual-gen'
      );
    }

    const renderResult = await renderResponse.json() as { videoUrl: string; duration: number; fileSize: number };
    const videoPath = renderResult.videoUrl;

    logger.info({
      msg: 'Render complete',
      pipelineId,
      stage: 'visual-gen',
      videoPath,
      duration: renderResult.duration,
      fileSize: renderResult.fileSize,
    });

    // Step 6: Calculate quality metrics
    const fallbackUsage = mapper.getFallbackUsage();
    const fallbackPercentage = visualCues.length > 0
      ? (fallbackUsage / visualCues.length) * 100
      : 0;

    // Check if quality is DEGRADED (>30% fallback usage)
    let qualityStatus: 'OK' | 'DEGRADED' = 'OK';
    const MAX_FALLBACK_PERCENTAGE = 30;

    if (fallbackPercentage > MAX_FALLBACK_PERCENTAGE) {
      qualityStatus = 'DEGRADED';
      logger.warn({
        msg: 'High fallback usage detected - quality DEGRADED',
        pipelineId,
        stage: 'visual-gen',
        fallbackUsage,
        totalCues: visualCues.length,
        percentage: fallbackPercentage,
        status: 'DEGRADED',
      });
    }

    // Calculate timeline alignment error
    const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const alignmentError = data.audioDurationSec > 0
      ? Math.abs(totalDuration - data.audioDurationSec) / data.audioDurationSec
      : 0;

    if (alignmentError > 0.05) {
      logger.warn({
        msg: 'Timeline alignment error exceeds 5%',
        pipelineId,
        stage: 'visual-gen',
        expectedDuration: data.audioDurationSec,
        actualDuration: totalDuration,
        errorPercentage: alignmentError * 100,
      });
    }

    // Build quality metrics
    const qualityMeasurements = {
      sceneCount: timeline.scenes.length,
      fallbackUsage,
      fallbackPercentage,
      timelineAlignmentError: alignmentError,
      qualityStatus,
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
      {
        type: 'video',
        url: videoPath,
        size: renderResult.fileSize,
        contentType: 'video/mp4',
        generatedAt: new Date().toISOString(),
        stage: 'visual-gen',
      },
    ];

    // Return data for executeStage
    return {
      timelineUrl,
      sceneCount: timeline.scenes.length,
      fallbackUsage,
      videoPath,  // GCS path to rendered video
      // Pass-through data for YouTube metadata generation
      topicData: data.topicData,
      script: data.script,
      audioDurationSec: data.audioDurationSec,
      // Metadata for executeStage
      artifacts,
      quality: {
        stage: 'visual-gen',
        timestamp: new Date().toISOString(),
        measurements: qualityMeasurements,
      },
      provider: {
        name: fallbackUsage > 0 ? 'keyword-matching+TextOnGradient' : 'keyword-matching',
        tier: fallbackUsage > 0 ? 'fallback' : 'primary',
        attempts: 1,
      },
    } as any;

  }, { qualityGate: 'visual-gen' });
}

