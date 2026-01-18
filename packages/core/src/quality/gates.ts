/**
 * Quality Gate Framework Implementation
 */

import { QualityGate, QualityGateResult, QualityStatus, PublishDecision, PrePublishResult } from './types.js';
import { createLogger } from '../observability/logger.js';
import { PipelineState } from '../types/pipeline.js';
import { CostTracker } from '../observability/cost-tracker.js';

const logger = createLogger('quality.gates');

type GateFunction = (output: any) => Promise<QualityGateResult> | QualityGateResult;

/**
 * Registry for managing and executing quality gates
 */
export class QualityGateRegistry implements QualityGate {
  private gates: Map<string, GateFunction> = new Map();

  constructor() {
    this.registerDefaultGates();
  }

  /**
   * Register a gate for a specific stage
   * @param stage Stage name
   * @param gateFn Gate function
   */
  registerGate(stage: string, gateFn: GateFunction): void {
    this.gates.set(stage, gateFn);
    logger.debug({ stage }, 'Registered quality gate');
  }

  /**
   * Execute quality check for a stage
   * @param stageName Stage name
   * @param output Stage output
   */
  async check(stageName: string, output: any): Promise<QualityGateResult> {
    const gate = this.gates.get(stageName);

    if (!gate) {
      logger.warn({ stage: stageName }, 'No quality gate registered for stage');
      return {
        status: QualityStatus.PASS,
        metrics: {},
        warnings: [`No quality gate defined for stage: ${stageName}`],
        stage: stageName,
      };
    }

    try {
      logger.debug({ stage: stageName }, 'Executing quality gate');
      const result = await gate(output);
      
      logger.info({ 
        stage: stageName, 
        status: result.status,
        metrics: result.metrics 
      }, 'Quality gate complete');

      return result;
    } catch (error: any) {
      logger.error({ stage: stageName, error }, 'Quality gate execution failed');
      return {
        status: QualityStatus.FAIL,
        metrics: {},
        warnings: [],
        reason: `Quality gate execution failed: ${error.message}`,
        stage: stageName,
      };
    }
  }

  /**
   * Register default stage gates based on architecture requirements
   */
  private registerDefaultGates(): void {
    // script-gen: word count 1200-1800
    this.registerGate('script-gen', (output: any) => {
      const data = output.data || {};
      const wordCount = data.wordCount || 0; 
      const min = 1200;
      const max = 1800;
      
      let status = QualityStatus.PASS;
      const warnings: string[] = [];
      let reason: string | undefined;

      if (wordCount < min || wordCount > max) {
        // NFR21: Must be 1200-1800. Strict fail? 
        // Let's assume strict fail for now as per AC.
        status = QualityStatus.FAIL;
        reason = `Word count ${wordCount} is outside range [${min}, ${max}]`;
      }

      return {
        status,
        metrics: { wordCount },
        warnings,
        reason: status === QualityStatus.FAIL ? reason : undefined,
        stage: 'script-gen'
      };
    });

    // tts: silence < 5%, no clipping
    this.registerGate('tts', (output: any) => {
      // Assuming quality metrics are available in output.quality
      const silencePct = output.quality?.measurements?.silencePct || 0;
      const clipping = output.quality?.measurements?.clippingDetected || false;

      let status = QualityStatus.PASS;
      let reason: string | undefined;

      if (silencePct >= 5) {
        status = QualityStatus.FAIL;
        reason = `Silence percentage ${silencePct}% exceeds limit 5%`;
      }
      if (clipping) {
        status = QualityStatus.FAIL;
        reason = reason ? `${reason}; Clipping detected` : 'Clipping detected';
      }

      return {
        status,
        metrics: { silencePct, clippingDetected: clipping },
        warnings: [],
        reason,
        stage: 'tts'
      };
    });

    // render: zero frame drops, audio sync < 100ms
    this.registerGate('render', (output: any) => {
      const frameDrops = output.quality?.measurements?.frameDrops || 0;
      const audioSyncMs = output.quality?.measurements?.audioSyncMs || 0;

      let status = QualityStatus.PASS;
      let reason: string | undefined;

      if (frameDrops > 0) {
        status = QualityStatus.FAIL;
        reason = `Detected ${frameDrops} frame drops`;
      }
      if (Math.abs(audioSyncMs) >= 100) {
        status = QualityStatus.FAIL;
        reason = reason ? `${reason}; Audio sync offset ${audioSyncMs}ms exceeds 100ms` : `Audio sync offset ${audioSyncMs}ms exceeds 100ms`;
      }

      return {
        status,
        metrics: { frameDrops, audioSyncMs },
        warnings: [],
        reason,
        stage: 'render'
      };
    });

    // thumbnail: 3 variants
    this.registerGate('thumbnail', (output: any) => {
      const data = output.data || output;
      const variants = Array.isArray(data) ? data.length : (data.variants?.length || 0);

      let status = QualityStatus.PASS;
      let reason: string | undefined;

      if (variants !== 3) {
        status = QualityStatus.FAIL;
        reason = `Expected 3 thumbnail variants, got ${variants}`;
      }

      return {
        status,
        metrics: { variantsGenerated: variants },
        warnings: [],
        reason,
        stage: 'thumbnail'
      };
    });

    // news-sourcing: verify topic selection succeeded or fallback identified
    this.registerGate('news-sourcing', (output: any) => {
      const data = output.data || output;
      const selected = data.selected;
      const fallback = data.fallback || false;
      const candidateCount = data.candidates?.length || 0;
      const deepDiveCount = data.deepDiveCandidates?.length || 0;

      let status = QualityStatus.PASS;
      const warnings: string[] = [];
      let reason: string | undefined;

      // If not fallback, must have a selected topic
      if (!fallback && !selected) {
        status = QualityStatus.FAIL;
        reason = 'No topic selected and fallback not triggered';
      }

      // If fallback, should have deep dive candidates identified
      if (fallback && deepDiveCount === 0) {
        warnings.push('Fallback triggered but no deep dive candidates identified');
      }

      // Warn if very low candidate count
      if (candidateCount < 3 && !fallback) {
        warnings.push(`Low candidate count: ${candidateCount}`);
      }

      return {
        status,
        metrics: {
          selected: !!selected,
          fallback,
          candidateCount,
          deepDiveCount,
        },
        warnings,
        reason,
        stage: 'news-sourcing',
      };
    });

    // research: minimum word count and content presence check
    this.registerGate('research', (output: any) => {
      const data = output.data || output;
      const wordCount = data.wordCount || 0;
      const brief = data.brief || '';
      const minWords = 1800; // Minimum acceptable word count

      let status = QualityStatus.PASS;
      const warnings: string[] = [];
      let reason: string | undefined;

      // Check minimum word count
      if (wordCount < minWords) {
        status = QualityStatus.FAIL;
        reason = `Research brief word count ${wordCount} is below minimum ${minWords}`;
      }

      // Warn if content is missing
      if (!brief || brief.trim().length === 0) {
        status = QualityStatus.FAIL;
        reason = 'Research brief is empty';
      }

      // Warn if word count is too high (over 2,500 words)
      if (wordCount > 2500) {
        warnings.push(`Word count ${wordCount} exceeds recommended maximum of 2,500`);
      }

      return {
        status,
        metrics: {
          wordCount,
          briefLength: brief.length,
        },
        warnings,
        reason,
        stage: 'research',
      };
    });
  }
}

// Export singleton instance
export const qualityGate = new QualityGateRegistry();

/**
 * Evaluate whether a pipeline run is ready for publishing
 * @param run Pipeline state
 */
export async function evaluatePublishReadiness(run: PipelineState): Promise<PrePublishResult> {
  const issues: Array<{ stage: string; severity: 'warning' | 'error'; message: string }> = [];
  const degradedStages = run.qualityContext?.degradedStages || [];
  const fallbacksUsed = run.qualityContext?.fallbacksUsed || [];

  // Check critical errors
  if (run.errors && run.errors.length > 0) {
    run.errors.forEach(err => {
      issues.push({
        stage: err.stage,
        severity: 'error',
        message: `Pipeline error: ${err.message}`
      });
    });
  }

  // Check cost
  try {
    const totalCost = await CostTracker.getVideoCost(run.pipelineId);
    const COST_LIMIT = 1.50; // Hard limit for HUMAN_REVIEW
    if (totalCost > COST_LIMIT) {
      issues.push({
        stage: 'cost',
        severity: 'error', // Treating high cost as 'error' level concern for publishing
        message: `Total cost $${totalCost.toFixed(2)} exceeds limit $${COST_LIMIT.toFixed(2)}`
      });
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to check cost during publish readiness evaluation');
  }

  // Analyze fallbacks
  // Rule: No TTS fallback for AUTO_PUBLISH_WITH_WARNING (must be primary)
  const hasTTSFallback = fallbacksUsed.some(f => f.toLowerCase().includes('tts') && !f.toLowerCase().includes('gemini')); 
  // Assuming 'gemini' is primary as per context. But better to just check if it's NOT primary?
  // Context says: tts primary: gemini-2.5-pro-tts. Fallbacks: chirp3-hd, wavenet.
  // fallbacksUsed format: "stage:provider".
  // If 'tts:chirp3-hd' is in list, it's a fallback.
  
  if (hasTTSFallback) {
    issues.push({
      stage: 'tts',
      severity: 'error', // Forces HUMAN_REVIEW
      message: 'TTS fallback provider was used'
    });
  }

  // Count issues
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.length - errorCount; // Assuming others are warnings (though I haven't pushed warnings yet)

  // Determine decision
  let decision = PublishDecision.AUTO_PUBLISH;
  let recommendedAction: string | undefined;

  if (errorCount > 0) {
    decision = PublishDecision.HUMAN_REVIEW;
    recommendedAction = 'Review critical errors, high cost, or fallback usage before publishing.';
  } else if (warningCount > 0 || degradedStages.length > 0 || fallbacksUsed.length > 0) {
    // Check constraints for WARNING
    // Minor issues <= 2 (including warnings, degraded stages, and fallbacks)
    const totalIssues = warningCount + degradedStages.length + fallbacksUsed.length; 
    
    if (totalIssues <= 2 && !hasTTSFallback) {
       decision = PublishDecision.AUTO_PUBLISH_WITH_WARNING;
       recommendedAction = 'Publish allowed with warnings. Check logs.';
    } else {
       decision = PublishDecision.HUMAN_REVIEW;
       recommendedAction = 'Too many minor issues or critical fallback used.';
    }
  }

  // If degraded stages, add to issues if not already
  degradedStages.forEach(stage => {
     // Check if we already have an issue for this?
     // Just add it as info/warning if not present
     if (!issues.some(i => i.stage === stage)) {
        issues.push({
           stage,
           severity: 'warning',
           message: 'Stage reported degradation'
        });
     }
  });

  return {
    decision,
    issues,
    fallbacksUsed,
    degradedStages,
    recommendedAction
  };
}
