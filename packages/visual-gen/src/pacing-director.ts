import type { Scene, ScenePacing } from '@nexus-ai/director-agent';

export interface PacingDirectiveMetrics {
  hookSceneCount: number;
  expositionSceneCount: number;
  conclusionSceneCount: number;
  cadencePerMin: number;
}

function isEvidenceScene(scene: Scene): boolean {
  return Boolean(scene.sourceUrl) || scene.visualSource === 'source-screenshot' || scene.visualSource === 'content-screenshot';
}

function chooseHookTransition(index: number): Scene['transition'] {
  const pattern: Array<NonNullable<Scene['transition']>> = ['slam', 'cut', 'split', 'zoom-in', 'cut'];
  return pattern[index % pattern.length];
}

function chooseConclusionTransition(index: number): Scene['transition'] {
  const pattern: Array<NonNullable<Scene['transition']>> = ['zoom-in', 'wipe-down', 'cut'];
  return pattern[index % pattern.length];
}

function inferPacing(ratio: number, scene: Scene, sceneDurationSec: number): ScenePacing {
  if (ratio < 0.15) return 'punch';
  if (ratio >= 0.8) return 'breathe';
  if (sceneDurationSec > 10) return 'breathe';
  if (isEvidenceScene(scene)) return 'dense';
  return 'normal';
}

export function applyPacingEnvelope(scenes: Scene[], audioDurationSec: number): PacingDirectiveMetrics {
  if (scenes.length === 0) {
    return { hookSceneCount: 0, expositionSceneCount: 0, conclusionSceneCount: 0, cadencePerMin: 0 };
  }

  const totalFrames = Math.max(...scenes.map((s) => s.endFrame), 1);
  let hookSceneCount = 0;
  let expositionSceneCount = 0;
  let conclusionSceneCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const midpoint = (scene.startFrame + scene.endFrame) / 2;
    const ratio = midpoint / totalFrames;
    const sceneDurationSec = Math.max((scene.endFrame - scene.startFrame) / 30, 0.1);

    scene.pacing = inferPacing(ratio, scene, sceneDurationSec);

    if (ratio < 0.15) {
      hookSceneCount++;
      if (!scene.transition || scene.transition === 'cut') {
        scene.transition = chooseHookTransition(i);
      }
    } else if (ratio < 0.8) {
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
  }

  const minutes = Math.max(audioDurationSec / 60, 0.1);
  const cadencePerMin = Number((scenes.length / minutes).toFixed(2));

  return { hookSceneCount, expositionSceneCount, conclusionSceneCount, cadencePerMin };
}
