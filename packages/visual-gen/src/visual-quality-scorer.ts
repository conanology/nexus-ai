import type { Scene } from '@nexus-ai/director-agent';

export interface VisualQualityScore {
  sourceEvidenceCoverage: number;
  foregroundEvidenceRatio: number;
  visualDiversity: number;
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

export function scoreVisualQuality(
  scenes: Scene[],
  audioDurationSec: number,
): VisualQualityScore {
  const totalScenes = scenes.length || 1;

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

  const aiScenes = scenes.filter((s) => s.visualSource === 'ai-generated').length;
  const gradientScenes = scenes.filter((s) => !s.visualSource || s.visualSource === 'gradient').length;

  const sourceEvidenceCoverage = clamp01(evidenceScenes / totalScenes);
  const foregroundEvidenceRatio = clamp01(foregroundEvidenceScenes / totalScenes);
  const visualDiversity = clamp01(diversityRaw);
  const aiVisualRatio = clamp01(aiScenes / totalScenes);
  const gradientOnlyRatio = clamp01(gradientScenes / totalScenes);

  const minutes = Math.max(audioDurationSec / 60, 0.1);
  const sceneCadencePerMin = totalScenes / minutes;

  // Scoring model tuned for evidence-first tech explainers
  const evidenceScore = sourceEvidenceCoverage * 35;
  const foregroundScore = foregroundEvidenceRatio * 20;
  const diversityScore = visualDiversity * 20;
  const cadenceTarget = sceneCadencePerMin >= 18 ? 1 : sceneCadencePerMin / 18;
  const cadenceScore = clamp01(cadenceTarget) * 15;
  const aiPenalty = aiVisualRatio > 0.45 ? (aiVisualRatio - 0.45) * 20 : 0;
  const gradientPenalty = gradientOnlyRatio > 0.15 ? (gradientOnlyRatio - 0.15) * 60 : 0;

  const rawScore = evidenceScore + foregroundScore + diversityScore + cadenceScore - aiPenalty - gradientPenalty;
  const qualityScore = Math.max(0, Math.min(100, rawScore));

  const qualityWarnings: string[] = [];
  if (sourceEvidenceCoverage < 0.35) qualityWarnings.push('Low evidence coverage');
  if (foregroundEvidenceRatio < 0.2) qualityWarnings.push('Not enough foreground evidence shots');
  if (sceneCadencePerMin < 18) qualityWarnings.push('Scene cadence too slow for tech-news pacing');
  if (gradientOnlyRatio > 0.15) qualityWarnings.push('Too many gradient-only scenes');
  if (aiVisualRatio > 0.6) qualityWarnings.push('Over-reliance on AI-generated visuals');

  const qualityStatus = qualityScore >= 70 ? 'PASS' : 'DEGRADED';

  return {
    sourceEvidenceCoverage: round(sourceEvidenceCoverage),
    foregroundEvidenceRatio: round(foregroundEvidenceRatio),
    visualDiversity: round(visualDiversity),
    aiVisualRatio: round(aiVisualRatio),
    gradientOnlyRatio: round(gradientOnlyRatio),
    sceneCadencePerMin: round(sceneCadencePerMin),
    qualityScore: round(qualityScore),
    qualityStatus,
    qualityWarnings,
  };
}
