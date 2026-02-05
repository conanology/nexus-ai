/**
 * Visual generation stage implementation
 */

import type { StageInput, StageOutput, ArtifactRef } from '@nexus-ai/core';
import { logger, CloudStorageClient, executeStage, NexusError } from '@nexus-ai/core';
import { mixAudio } from '@nexus-ai/audio-mixer';
import type { AudioMixerInput } from '@nexus-ai/audio-mixer';
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

    // Resolve script: use provided script, or reconstruct from directionDocument segments
    // This handles V2 flow where script is not passed through timestamp-extraction
    let resolvedScript = data.script;
    if (!resolvedScript && hasDirectionDocument) {
      resolvedScript = data.directionDocument!.segments
        .map(seg => seg.content.text)
        .join('\n\n');
      logger.info({
        msg: 'Script reconstructed from directionDocument segments',
        pipelineId,
        stage: 'visual-gen',
        segmentCount: data.directionDocument!.segments.length,
      });
    }

    if (!resolvedScript) {
      throw NexusError.critical(
        'NEXUS_VISUAL_GEN_NO_SCRIPT',
        'No script provided and no directionDocument to reconstruct from',
        'visual-gen'
      );
    }

    logger.info({
      msg: 'Visual generation stage started',
      pipelineId,
      stage: 'visual-gen',
      scriptLength: resolvedScript.length,
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
    let visualCues = parseVisualCues(resolvedScript);

    logger.info({
      msg: 'Visual cues parsed',
      pipelineId,
      stage: 'visual-gen',
      cueCount: visualCues.length,
    });

    // Generate fallback cues from directionDocument if no visual cues found in script
    if (visualCues.length === 0 && hasDirectionDocument) {
      logger.info({
        msg: 'Generating fallback scenes from directionDocument segments',
        pipelineId,
        stage: 'visual-gen',
        segmentCount: data.directionDocument!.segments.length,
      });

      visualCues = data.directionDocument!.segments.map((segment, index) => ({
        index,
        // Use first sentence of segment content as description
        description: segment.content.text.split(/[.!?]/)[0]?.trim() || 'Scene',
        context: segment.content.text,
        position: index * 100,
      }));
    }

    if (visualCues.length === 0) {
      logger.warn({
        msg: 'No visual cues found in script and no directionDocument segments available',
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
    const timeline = generateTimeline(sceneMappings, data.audioDurationSec, {
      segments: data.directionDocument?.segments,
    });

    // Compute timing mode distribution across all segments
    let timingMode = 'proportional';
    const timingModeCounts: Record<string, number> = {};
    if (data.directionDocument?.segments?.length) {
      for (const seg of data.directionDocument.segments) {
        const mode = seg.timing.wordTimings?.length
          ? 'word-timings'
          : seg.timing.actualDurationSec !== undefined
            ? 'actual'
            : seg.timing.estimatedDurationSec !== undefined
              ? 'estimated'
              : 'proportional';
        timingModeCounts[mode] = (timingModeCounts[mode] ?? 0) + 1;
      }
      // Primary mode is the most common across segments
      timingMode = Object.entries(timingModeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'proportional';
    }

    logger.info({
      msg: 'Timeline generated',
      pipelineId,
      stage: 'visual-gen',
      sceneCount: timeline.scenes.length,
      audioDuration: timeline.audioDurationSec,
      timingMode,
      timingModeCounts: Object.keys(timingModeCounts).length > 0 ? timingModeCounts : undefined,
      validationWarnings: timeline.validationWarnings,
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

    // Step 5: Audio mixing (if enabled)
    let finalAudioUrl = data.audioUrl;
    let mixedAudioUrl: string | undefined;
    let audioMixingApplied = false;
    let audioMixingFailed = false;

    const mixingEnabled = !!data.directionDocument && data.audioMixingEnabled !== false;

    if (mixingEnabled) {
      try {
        logger.info({
          msg: 'Audio mixing enabled - calling mixAudio',
          pipelineId,
          stage: 'visual-gen',
          voiceTrackUrl: data.audioUrl,
          targetDurationSec: data.audioDurationSec,
        });

        const mixInput: StageInput<AudioMixerInput> = {
          pipelineId,
          previousStage: 'visual-gen',
          data: {
            voiceTrackUrl: data.audioUrl,
            directionDocument: data.directionDocument!,
            targetDurationSec: data.audioDurationSec,
          },
          config: input.config,
        };

        const mixResult = await mixAudio(mixInput);
        mixedAudioUrl = mixResult.data.mixedAudioUrl;
        finalAudioUrl = mixedAudioUrl;
        audioMixingApplied = true;

        // Record audio-mixer costs if available
        if (mixResult.cost && config.tracker && typeof (config.tracker as any).recordApiCall === 'function') {
          (config.tracker as any).recordApiCall(
            'audio-mixer',
            { input: 0, output: 0 },
            mixResult.cost.totalCost ?? 0
          );
        }

        logger.info({
          msg: 'Audio mixing succeeded',
          pipelineId,
          stage: 'visual-gen',
          mixedAudioUrl,
          duckingApplied: mixResult.data.duckingApplied,
        });
      } catch (error) {
        audioMixingFailed = true;
        logger.warn({
          msg: 'Audio mixing failed - using original TTS audio',
          pipelineId,
          stage: 'visual-gen',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.info({
        msg: 'Audio mixing skipped',
        pipelineId,
        stage: 'visual-gen',
        reason: !data.directionDocument ? 'no directionDocument' : 'audioMixingEnabled is false',
      });
    }

    // Step 6: Call render service to generate video (async with polling)
    const renderServiceUrl = process.env.RENDER_SERVICE_URL || 'http://localhost:8081';
    const renderSecret = process.env.NEXUS_SECRET || '';

    logger.info({
      msg: 'Calling render service (async)',
      pipelineId,
      stage: 'visual-gen',
      renderServiceUrl,
      timelineUrl,
      audioUrl: finalAudioUrl,
    });

    // Start async render job
    const startResponse = await fetch(`${renderServiceUrl}/render/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nexus-Secret': renderSecret,
      },
      body: JSON.stringify({
        pipelineId,
        timelineUrl,
        audioUrl: finalAudioUrl,
        resolution: '1080p',
      }),
    });

    if (!startResponse.ok) {
      const errorBody = await startResponse.text().catch(() => 'unknown');
      throw NexusError.critical(
        'NEXUS_RENDER_FAILED',
        `Failed to start render job: ${startResponse.status}: ${errorBody}`,
        'visual-gen'
      );
    }

    const { jobId } = await startResponse.json() as { jobId: string };

    logger.info({
      msg: 'Render job started',
      pipelineId,
      stage: 'visual-gen',
      jobId,
    });

    // Poll for completion
    const renderTimeoutMs = 60 * 60 * 1000; // 60 minutes max
    const pollIntervalMs = 10 * 1000; // Poll every 10 seconds
    const startTime = Date.now();
    let lastProgress = '';
    let renderResult: { videoUrl: string; duration: number; fileSize: number } | null = null;

    while (Date.now() - startTime < renderTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      const statusResponse = await fetch(`${renderServiceUrl}/render/status/${jobId}`, {
        headers: {
          'X-Nexus-Secret': renderSecret,
        },
      });

      if (!statusResponse.ok) {
        logger.warn({
          msg: 'Failed to poll render status',
          pipelineId,
          stage: 'visual-gen',
          jobId,
          status: statusResponse.status,
        });
        continue;
      }

      const status = await statusResponse.json() as {
        status: 'pending' | 'running' | 'completed' | 'failed';
        progress?: string;
        result?: { videoUrl: string; duration: number; fileSize: number };
        error?: string;
      };

      // Log progress updates
      if (status.progress && status.progress !== lastProgress) {
        lastProgress = status.progress;
        logger.info({
          msg: 'Render progress',
          pipelineId,
          stage: 'visual-gen',
          jobId,
          progress: status.progress,
          status: status.status,
        });
      }

      if (status.status === 'completed' && status.result) {
        logger.info({
          msg: 'Render job completed',
          pipelineId,
          stage: 'visual-gen',
          jobId,
          result: status.result,
        });

        renderResult = status.result;
        break;
      }

      if (status.status === 'failed') {
        throw NexusError.critical(
          'NEXUS_RENDER_FAILED',
          `Render job failed: ${status.error || 'unknown error'}`,
          'visual-gen'
        );
      }
    }

    // Check if we timed out
    if (!renderResult) {
      throw NexusError.critical(
        'NEXUS_RENDER_TIMEOUT',
        `Render job timed out after ${renderTimeoutMs / 1000 / 60} minutes`,
        'visual-gen'
      );
    }
    const videoPath = renderResult.videoUrl;

    logger.info({
      msg: 'Render complete',
      pipelineId,
      stage: 'visual-gen',
      videoPath,
      duration: renderResult.duration,
      fileSize: renderResult.fileSize,
    });

    // Step 7: Calculate quality metrics
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

    // Mark quality as DEGRADED if audio mixing failed
    if (audioMixingFailed) {
      qualityStatus = 'DEGRADED';
    }

    // Build quality metrics
    const qualityMeasurements = {
      sceneCount: timeline.scenes.length,
      fallbackUsage,
      fallbackPercentage,
      timelineAlignmentError: alignmentError,
      qualityStatus,
      audioMixingApplied,
      audioMixingFailed,
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
      script: resolvedScript,
      audioDurationSec: data.audioDurationSec,
      // Audio URL fields
      originalAudioUrl: data.audioUrl,
      mixedAudioUrl,
      finalAudioUrl,
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

