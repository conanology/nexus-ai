import type { Scene, ScenePacing } from '@nexus-ai/director-agent';
import { getRetentionProfileConfig, type RetentionProfile, type RetentionProfileContext } from './retention-profile.js';

export type HookArchetype = 'shock-stat' | 'contradiction' | 'breaking-shift';
type StoryPhase = 'hook' | 'exposition' | 'conclusion';

export interface PacingEnvelopeOptions {
  retentionProfile?: RetentionProfile;
  retentionContext?: RetentionProfileContext;
}

export interface PacingDirectiveMetrics {
  hookSceneCount: number;
  expositionSceneCount: number;
  conclusionSceneCount: number;
  cadencePerMin: number;
  hookArchetype: HookArchetype;
  patternBreakCount: number;
  noveltyInterventions: number;
  maxConsecutiveSceneTypeRun: number;
  retentionProfile: RetentionProfile;
}

function isEvidenceScene(scene: Scene): boolean {
  return Boolean(scene.sourceUrl) || scene.visualSource === 'source-screenshot' || scene.visualSource === 'content-screenshot';
}

function inferPhase(ratio: number): StoryPhase {
  if (ratio < 0.15) return 'hook';
  if (ratio < 0.8) return 'exposition';
  return 'conclusion';
}

function inferPacing(phase: StoryPhase, scene: Scene, sceneDurationSec: number): ScenePacing {
  if (phase === 'hook') return 'punch';
  if (phase === 'conclusion' || sceneDurationSec > 10) return 'breathe';
  if (isEvidenceScene(scene)) return 'dense';
  return 'normal';
}

function extractHookText(scenes: Scene[], totalFrames: number): string {
  return scenes
    .filter((scene) => ((scene.startFrame + scene.endFrame) / 2) / totalFrames < 0.22)
    .slice(0, 3)
    .map((scene) => scene.content || '')
    .join(' ')
    .toLowerCase();
}

function detectHookArchetype(scenes: Scene[], totalFrames: number): HookArchetype {
  const hookText = extractHookText(scenes, totalFrames);
  const hasStatSignal = /\b\d+(?:\.\d+)?\s*(?:%|x|k|m|b|million|billion|seconds?|minutes?|hours?)\b/i.test(hookText);
  if (hasStatSignal) return 'shock-stat';

  const hasContradictionSignal = /\b(?:but|however|yet|despite|although|instead|versus|vs\.?|while)\b/i.test(hookText);
  if (hasContradictionSignal) return 'contradiction';

  return 'breaking-shift';
}

function chooseHookTransition(index: number, archetype: HookArchetype, retentionProfile: RetentionProfile): Scene['transition'] {
  const premiumPattern: Record<HookArchetype, Array<NonNullable<Scene['transition']>>> = {
    'shock-stat': ['slam', 'split', 'zoom-in', 'cut'],
    'contradiction': ['split', 'wipe-down', 'zoom-in', 'cut'],
    'breaking-shift': ['zoom-in', 'slam', 'split', 'cut'],
  };

  const aggressivePattern: Record<HookArchetype, Array<NonNullable<Scene['transition']>>> = {
    'shock-stat': ['slam', 'split', 'zoom-in', 'pop-in'],
    'contradiction': ['split', 'wipe-down', 'slam', 'zoom-in'],
    'breaking-shift': ['zoom-in', 'slam', 'split', 'pop-in'],
  };

  const balancedPattern: Record<HookArchetype, Array<NonNullable<Scene['transition']>>> = {
    'shock-stat': ['slam', 'cut', 'split', 'zoom-in'],
    'contradiction': ['split', 'cut', 'wipe-down', 'zoom-in'],
    'breaking-shift': ['zoom-in', 'cut', 'slam', 'split'],
  };

  const table = retentionProfile === 'aggressive' ? aggressivePattern : retentionProfile === 'balanced' ? balancedPattern : premiumPattern;
  const pattern = table[archetype];
  return pattern[index % pattern.length];
}

function chooseConclusionTransition(index: number): Scene['transition'] {
  const pattern: Array<NonNullable<Scene['transition']>> = ['zoom-in', 'wipe-down', 'cut'];
  return pattern[index % pattern.length];
}

function choosePatternBreakTransition(index: number, phase: StoryPhase, retentionProfile: RetentionProfile): NonNullable<Scene['transition']> {
  if (retentionProfile === 'aggressive') {
    const pattern = phase === 'hook'
      ? (['slam', 'split', 'zoom-in', 'pop-in', 'wipe-down'] as const)
      : (['split', 'zoom-in', 'wipe-down', 'pop-in'] as const);
    return pattern[index % pattern.length];
  }

  if (retentionProfile === 'balanced') {
    const pattern = phase === 'hook'
      ? (['slam', 'split', 'zoom-in'] as const)
      : (['split', 'zoom-in', 'wipe-down'] as const);
    return pattern[index % pattern.length];
  }

  const pattern = phase === 'hook'
    ? (['slam', 'split', 'zoom-in', 'wipe-down'] as const)
    : (['split', 'zoom-in', 'wipe-down', 'pop-in'] as const);
  return pattern[index % pattern.length];
}

function hasPatternBreak(scene: Scene): boolean {
  return Boolean(scene.transition) && scene.transition !== 'cut';
}

function appendSfx(scene: Scene, sfxName: string): void {
  if (!scene.sfx) {
    scene.sfx = [sfxName];
    return;
  }
  if (!scene.sfx.includes(sfxName)) {
    scene.sfx.push(sfxName);
  }
}

function hookSfxForArchetype(archetype: HookArchetype): string {
  if (archetype === 'shock-stat') return 'impact-hard';
  if (archetype === 'contradiction') return 'transition';
  return 'reveal';
}

function getPatternBreakTargetSec(phase: StoryPhase, config: ReturnType<typeof getRetentionProfileConfig>): number {
  if (phase === 'hook') return config.hookPatternBreakTargetSec;
  if (phase === 'conclusion') return config.conclusionPatternBreakTargetSec;
  return config.expositionPatternBreakTargetSec;
}

export function applyPacingEnvelope(
  scenes: Scene[],
  audioDurationSec: number,
  options: PacingEnvelopeOptions = {},
): PacingDirectiveMetrics {
  const retentionConfig = options.retentionProfile
    ? getRetentionProfileConfig(options.retentionProfile)
    : getRetentionProfileConfig(options.retentionContext ?? {});

  if (scenes.length === 0) {
    return {
      hookSceneCount: 0,
      expositionSceneCount: 0,
      conclusionSceneCount: 0,
      cadencePerMin: 0,
      hookArchetype: 'breaking-shift',
      patternBreakCount: 0,
      noveltyInterventions: 0,
      maxConsecutiveSceneTypeRun: 0,
      retentionProfile: retentionConfig.profile,
    };
  }

  const totalFrames = Math.max(...scenes.map((s) => s.endFrame), 1);
  const hookArchetype = detectHookArchetype(scenes, totalFrames);

  let hookSceneCount = 0;
  let expositionSceneCount = 0;
  let conclusionSceneCount = 0;
  let patternBreakCount = 0;
  let noveltyInterventions = 0;

  let elapsedSincePatternBreakSec = 0;
  let previousType: string | undefined;
  let typeRun = 0;
  let maxConsecutiveSceneTypeRun = 0;
  let previousVisualSource: string | undefined;
  let visualRun = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const midpoint = (scene.startFrame + scene.endFrame) / 2;
    const ratio = midpoint / totalFrames;
    const sceneDurationSec = Math.max((scene.endFrame - scene.startFrame) / 30, 0.1);
    const phase = inferPhase(ratio);

    scene.pacing = inferPacing(phase, scene, sceneDurationSec);

    if (phase === 'hook') {
      hookSceneCount++;
      if (!scene.transition || scene.transition === 'cut') {
        scene.transition = chooseHookTransition(i, hookArchetype, retentionConfig.profile);
      }
      if (i === 0) {
        appendSfx(scene, hookSfxForArchetype(hookArchetype));
      }
    } else if (phase === 'exposition') {
      expositionSceneCount++;
      if (!scene.transition) {
        scene.transition = scene.pacing === 'dense' ? 'split' : 'cut';
      }
    } else {
      conclusionSceneCount++;
      if (!scene.transition || scene.transition === 'cut') {
        scene.transition = chooseConclusionTransition(i);
      }
    }

    if (scene.type === previousType) {
      typeRun += 1;
    } else {
      typeRun = 1;
      previousType = scene.type;
    }
    maxConsecutiveSceneTypeRun = Math.max(maxConsecutiveSceneTypeRun, typeRun);

    const visualKey = scene.visualSource ?? 'none';
    if (visualKey === previousVisualSource) {
      visualRun += 1;
    } else {
      visualRun = 1;
      previousVisualSource = visualKey;
    }

    if (typeRun > retentionConfig.maxSameSceneTypeRun || visualRun > retentionConfig.maxSameVisualSourceRun) {
      if (!scene.transition || scene.transition === 'cut') {
        scene.transition = choosePatternBreakTransition(i, phase, retentionConfig.profile);
      }
      if (phase !== 'conclusion') {
        scene.pacing = 'dense';
      }
      appendSfx(scene, phase === 'hook' ? 'impact-hard' : 'whoosh-in');
      noveltyInterventions++;
    }

    if (hasPatternBreak(scene)) {
      patternBreakCount++;
      elapsedSincePatternBreakSec = 0;
      continue;
    }

    elapsedSincePatternBreakSec += sceneDurationSec;
    const patternBreakTargetSec = getPatternBreakTargetSec(phase, retentionConfig);
    if (elapsedSincePatternBreakSec >= patternBreakTargetSec) {
      scene.transition = choosePatternBreakTransition(i, phase, retentionConfig.profile);
      if (phase !== 'conclusion' && scene.pacing === 'normal') {
        scene.pacing = 'dense';
      }
      patternBreakCount++;
      noveltyInterventions++;
      elapsedSincePatternBreakSec = 0;
    }
  }

  const minutes = Math.max(audioDurationSec / 60, 0.1);
  const cadencePerMin = Number((scenes.length / minutes).toFixed(2));

  return {
    hookSceneCount,
    expositionSceneCount,
    conclusionSceneCount,
    cadencePerMin,
    hookArchetype,
    patternBreakCount,
    noveltyInterventions,
    maxConsecutiveSceneTypeRun,
    retentionProfile: retentionConfig.profile,
  };
}
