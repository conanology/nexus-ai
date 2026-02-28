import type { Scene } from '@nexus-ai/director-agent';

export interface VisualQualityScore {
  sourceEvidenceCoverage: number;
  foregroundEvidenceRatio: number;
  visualDiversity: number;
  transitionDiversity: number;
  patternBreakRatio: number;
  hookPatternBreakRate: number;
  narrativeTurnDensity: number;
  maxConsecutiveSceneTypeRun: number;
  aiVisualRatio: number;
  gradientOnlyRatio: number;
  sceneCadencePerMin: number;
  qualityScore: number;
  qualityStatus: 'PASS' | 'DEGRADED';
  qualityWarnings: string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function hasPatternBreak(scene: Scene): boolean {
  return Boolean(scene.transition) && scene.transition !== 'cut';
}

function maxConsecutiveRun(values: string[]): number {
  if (values.length === 0) return 0;
  let maxRun = 1;
  let run = 1;

  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }

  return maxRun;
}

const NARRATIVE_TURN_REGEX = /\b(?:but|however|yet|because|therefore|so\b|instead|despite|means|which means|this means|now)\b/i;

export function scoreVisualQuality(
  scenes: Scene[],
  audioDurationSec: number,
): VisualQualityScore {
  const totalScenes = scenes.length || 1;
  const totalFrames = scenes.length > 0 ? Math.max(...scenes.map((scene) => scene.endFrame), 1) : 1;

  const evidenceScenes = scenes.filter((s) =>
    s.visualSource === 'source-screenshot' || s.visualSource === 'content-screenshot' || Boolean(s.sourceUrl),
  ).length;

  const foregroundEvidenceScenes = scenes.filter((s) =>
    (s.visualSource === 'source-screenshot' || s.visualSource === 'content-screenshot') &&
    s.screenshotDisplayMode === 'foreground',
  ).length;

  const sceneTypeSet = new Set(scenes.map((s) => s.type));
  const visualSourceSet = new Set(scenes.map((s) => s.visualSource || 'none'));
  const diversityRaw = (sceneTypeSet.size + visualSourceSet.size) / Math.max(8, totalScenes * 0.8);

  const transitionSet = new Set(
    scenes
      .map((scene) => scene.transition)
      .filter((transition): transition is NonNullable<Scene['transition']> => Boolean(transition) && transition !== 'cut'),
  );

  const patternBreakScenes = scenes.filter((scene) => hasPatternBreak(scene)).length;
  const hookScenes = scenes.filter((scene) => {
    const midpoint = (scene.startFrame + scene.endFrame) / 2;
    return midpoint / totalFrames < 0.15;
  });
  const hookPatternBreakScenes = hookScenes.filter((scene) => hasPatternBreak(scene)).length;

  const aiScenes = scenes.filter((s) => s.visualSource === 'ai-generated').length;
  const gradientScenes = scenes.filter((s) => !s.visualSource || s.visualSource === 'gradient').length;

  const sceneTypeSequence = scenes.map((scene) => scene.type);
  const maxConsecutiveSceneTypeRun = maxConsecutiveRun(sceneTypeSequence);

  const narrativeTurnScenes = scenes.filter((scene) => NARRATIVE_TURN_REGEX.test((scene.content ?? '').toLowerCase())).length;

  const sourceEvidenceCoverage = clamp01(evidenceScenes / totalScenes);
  const foregroundEvidenceRatio = clamp01(foregroundEvidenceScenes / totalScenes);
  const visualDiversity = clamp01(diversityRaw);
  const transitionDiversity = clamp01(transitionSet.size / 5);
  const patternBreakRatio = clamp01(patternBreakScenes / totalScenes);

  const hookDurationMin = Math.max((audioDurationSec * 0.15) / 60, 0.05);
  const hookPatternBreakRate = hookPatternBreakScenes / hookDurationMin;

  const narrativeTurnDensity = clamp01(narrativeTurnScenes / totalScenes);
  const aiVisualRatio = clamp01(aiScenes / totalScenes);
  const gradientOnlyRatio = clamp01(gradientScenes / totalScenes);

  const minutes = Math.max(audioDurationSec / 60, 0.1);
  const sceneCadencePerMin = totalScenes / minutes;

  // Scoring model tuned for retention-first, evidence-heavy tech explainers.
  const evidenceScore = sourceEvidenceCoverage * 32;
  const foregroundScore = foregroundEvidenceRatio * 18;
  const diversityScore = visualDiversity * 14;
  const cadenceScore = clamp01(sceneCadencePerMin / 18) * 12;
  const transitionScore = transitionDiversity * 8;
  const patternBreakScore = clamp01(patternBreakRatio / 0.45) * 8;
  const hookBreakScore = clamp01(hookPatternBreakRate / 24) * 4;
  const narrativeTurnScore = clamp01(narrativeTurnDensity / 0.35) * 4;

  const aiPenalty = aiVisualRatio > 0.45 ? (aiVisualRatio - 0.45) * 18 : 0;
  const gradientPenalty = gradientOnlyRatio > 0.15 ? (gradientOnlyRatio - 0.15) * 55 : 0;
  const repeatPenalty = maxConsecutiveSceneTypeRun > 3 ? (maxConsecutiveSceneTypeRun - 3) * 6 : 0;
  const transitionPenalty = transitionDiversity < 0.25 ? (0.25 - transitionDiversity) * 20 : 0;

  const rawScore =
    evidenceScore +
    foregroundScore +
    diversityScore +
    cadenceScore +
    transitionScore +
    patternBreakScore +
    hookBreakScore +
    narrativeTurnScore -
    aiPenalty -
    gradientPenalty -
    repeatPenalty -
    transitionPenalty;

  const qualityScore = Math.max(0, Math.min(100, rawScore));

  const qualityWarnings: string[] = [];
  if (sourceEvidenceCoverage < 0.35) qualityWarnings.push('Low evidence coverage');
  if (foregroundEvidenceRatio < 0.2) qualityWarnings.push('Not enough foreground evidence shots');
  if (sceneCadencePerMin < 18) qualityWarnings.push('Scene cadence too slow for tech-news pacing');
  if (gradientOnlyRatio > 0.15) qualityWarnings.push('Too many gradient-only scenes');
  if (aiVisualRatio > 0.6) qualityWarnings.push('Over-reliance on AI-generated visuals');
  if (patternBreakRatio < 0.3) qualityWarnings.push('Pattern breaks are too sparse');
  if (hookPatternBreakRate < 14) qualityWarnings.push('Hook window lacks enough kinetic transitions');
  if (transitionDiversity < 0.45) qualityWarnings.push('Transition diversity is too low');
  if (maxConsecutiveSceneTypeRun > 3) qualityWarnings.push('Repetitive scene composition detected');
  if (narrativeTurnDensity < 0.2) qualityWarnings.push('Narrative turns are too sparse; sequence may feel recap-like');

  const qualityStatus = qualityScore >= 70 ? 'PASS' : 'DEGRADED';

  return {
    sourceEvidenceCoverage: round(sourceEvidenceCoverage),
    foregroundEvidenceRatio: round(foregroundEvidenceRatio),
    visualDiversity: round(visualDiversity),
    transitionDiversity: round(transitionDiversity),
    patternBreakRatio: round(patternBreakRatio),
    hookPatternBreakRate: round(hookPatternBreakRate),
    narrativeTurnDensity: round(narrativeTurnDensity),
    maxConsecutiveSceneTypeRun,
    aiVisualRatio: round(aiVisualRatio),
    gradientOnlyRatio: round(gradientOnlyRatio),
    sceneCadencePerMin: round(sceneCadencePerMin),
    qualityScore: round(qualityScore),
    qualityStatus,
    qualityWarnings,
  };
}
