export type RetentionProfile = 'balanced' | 'premium' | 'aggressive';

export interface RetentionProfileConfig {
  profile: RetentionProfile;
  hookPatternBreakTargetSec: number;
  expositionPatternBreakTargetSec: number;
  conclusionPatternBreakTargetSec: number;
  maxSameSceneTypeRun: number;
  maxSameVisualSourceRun: number;
  targetCadencePerMin: number;
  targetHookPatternBreakRate: number;
  targetPatternBreakRatio: number;
  targetTransitionDiversity: number;
  minHeroMomentCoverage: number;
}

const PROFILE_CONFIG: Record<RetentionProfile, RetentionProfileConfig> = {
  balanced: {
    profile: 'balanced',
    hookPatternBreakTargetSec: 6,
    expositionPatternBreakTargetSec: 10,
    conclusionPatternBreakTargetSec: 9,
    maxSameSceneTypeRun: 3,
    maxSameVisualSourceRun: 3,
    targetCadencePerMin: 18,
    targetHookPatternBreakRate: 14,
    targetPatternBreakRatio: 0.3,
    targetTransitionDiversity: 0.45,
    minHeroMomentCoverage: 0.22,
  },
  premium: {
    profile: 'premium',
    hookPatternBreakTargetSec: 5,
    expositionPatternBreakTargetSec: 8,
    conclusionPatternBreakTargetSec: 8,
    maxSameSceneTypeRun: 2,
    maxSameVisualSourceRun: 3,
    targetCadencePerMin: 20,
    targetHookPatternBreakRate: 18,
    targetPatternBreakRatio: 0.4,
    targetTransitionDiversity: 0.55,
    minHeroMomentCoverage: 0.28,
  },
  aggressive: {
    profile: 'aggressive',
    hookPatternBreakTargetSec: 4,
    expositionPatternBreakTargetSec: 7,
    conclusionPatternBreakTargetSec: 7,
    maxSameSceneTypeRun: 2,
    maxSameVisualSourceRun: 2,
    targetCadencePerMin: 24,
    targetHookPatternBreakRate: 24,
    targetPatternBreakRatio: 0.5,
    targetTransitionDiversity: 0.62,
    minHeroMomentCoverage: 0.33,
  },
};

function readProfileFromEnv(): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXUS_RETENTION_PROFILE;
}

export function getRetentionProfile(): RetentionProfile {
  const raw = readProfileFromEnv()?.trim().toLowerCase();
  if (raw === 'aggressive') return 'aggressive';
  if (raw === 'balanced') return 'balanced';
  return 'premium';
}

export function getRetentionProfileConfig(profile: RetentionProfile = getRetentionProfile()): RetentionProfileConfig {
  return PROFILE_CONFIG[profile];
}
