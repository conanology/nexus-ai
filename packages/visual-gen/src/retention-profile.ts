export type RetentionProfile = 'balanced' | 'premium' | 'aggressive';

export interface RetentionProfileContext {
  /** Optional direct profile hint from caller */
  explicitProfile?: RetentionProfile;
  /** Topic virality score; accepts 0-1 or 0-100 scales */
  viralityScore?: number;
  /** Total narration duration in seconds */
  audioDurationSec?: number;
  /** Script text used for urgency keyword heuristics */
  script?: string;
}

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

const URGENCY_REGEX = /\b(?:breaking|urgent|explodes?|surge|panic|crash|wars?|vs\.?|leak|ban|shutdown|now)\b/i;

function readProfileFromEnv(): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXUS_RETENTION_PROFILE;
}

function normalizeVirality(score?: number): number | undefined {
  if (typeof score !== 'number' || Number.isNaN(score)) return undefined;
  if (score <= 0) return 0;
  if (score <= 1) return score;
  return Math.min(score / 100, 1);
}

export function inferRetentionProfile(context: RetentionProfileContext = {}): RetentionProfile {
  if (context.explicitProfile) {
    return context.explicitProfile;
  }

  const virality = normalizeVirality(context.viralityScore);
  const durationSec = context.audioDurationSec ?? 0;
  const script = (context.script ?? '').toLowerCase();
  const urgentScript = URGENCY_REGEX.test(script);

  // Short + urgent + high virality needs maximal kinetic pacing.
  if ((virality ?? 0) >= 0.82 || (durationSec > 0 && durationSec <= 95 && urgentScript)) {
    return 'aggressive';
  }

  // Long deep-dives benefit from calmer rhythm to avoid fatigue.
  if (durationSec >= 7 * 60 && (virality ?? 0) < 0.55) {
    return 'balanced';
  }

  return 'premium';
}

export function getRetentionProfile(context: RetentionProfileContext = {}): RetentionProfile {
  const envRaw = readProfileFromEnv()?.trim().toLowerCase();
  if (envRaw === 'aggressive') return 'aggressive';
  if (envRaw === 'balanced') return 'balanced';
  if (envRaw === 'premium') return 'premium';

  return inferRetentionProfile(context);
}

export function getRetentionProfileConfig(
  profileOrContext: RetentionProfile | RetentionProfileContext = {},
): RetentionProfileConfig {
  const profile = typeof profileOrContext === 'string'
    ? profileOrContext
    : getRetentionProfile(profileOrContext);
  return PROFILE_CONFIG[profile];
}
