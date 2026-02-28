export type VideoStyleProfile = 'cinematic' | 'fireship';

export interface VideoStyleProfileConfig {
  profile: VideoStyleProfile;
  transitionFrameMultiplier: number;
  maxTransitionFrames: number;
  slamShakePx: number;
  popOvershootScale: number;
  introParticleCount: number;
  ctaPulseStrength: number;
  titleLetterSpacing: number;
}

const PROFILE_CONFIG: Record<VideoStyleProfile, VideoStyleProfileConfig> = {
  cinematic: {
    profile: 'cinematic',
    transitionFrameMultiplier: 1,
    maxTransitionFrames: 6,
    slamShakePx: 6,
    popOvershootScale: 1.2,
    introParticleCount: 32,
    ctaPulseStrength: 0.08,
    titleLetterSpacing: 2.2,
  },
  fireship: {
    profile: 'fireship',
    transitionFrameMultiplier: 0.66,
    maxTransitionFrames: 4,
    slamShakePx: 8,
    popOvershootScale: 1.28,
    introParticleCount: 18,
    ctaPulseStrength: 0.13,
    titleLetterSpacing: 1.4,
  },
};

function readProfileFromEnv(): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXUS_VIDEO_STYLE_PROFILE;
}

export function getVideoStyleProfile(): VideoStyleProfile {
  const raw = readProfileFromEnv()?.trim().toLowerCase();
  return raw === 'fireship' ? 'fireship' : 'cinematic';
}

export function getVideoStyleConfig(profile: VideoStyleProfile = getVideoStyleProfile()): VideoStyleProfileConfig {
  return PROFILE_CONFIG[profile];
}
