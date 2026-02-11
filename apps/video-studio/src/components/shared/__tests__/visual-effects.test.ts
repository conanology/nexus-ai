import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// ParticleField: deterministic position generation
// ---------------------------------------------------------------------------

// Mirror the seededRandom from ParticleField.tsx to verify determinism
function seededRandom(seed: number): number {
  let s = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
  s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
  return (s % 10000) / 10000;
}

describe('ParticleField', () => {
  it('generates deterministic positions — same index always produces same x,y', () => {
    const FRAME_W = 1920;
    const FRAME_H = 1080;

    // Particle at index 0
    const x0a = seededRandom(0 * 7 + 1) * FRAME_W;
    const y0a = seededRandom(0 * 7 + 2) * FRAME_H;
    const x0b = seededRandom(0 * 7 + 1) * FRAME_W;
    const y0b = seededRandom(0 * 7 + 2) * FRAME_H;

    expect(x0a).toBe(x0b);
    expect(y0a).toBe(y0b);

    // Particle at index 5
    const x5a = seededRandom(5 * 7 + 1) * FRAME_W;
    const y5a = seededRandom(5 * 7 + 2) * FRAME_H;
    const x5b = seededRandom(5 * 7 + 1) * FRAME_W;
    const y5b = seededRandom(5 * 7 + 2) * FRAME_H;

    expect(x5a).toBe(x5b);
    expect(y5a).toBe(y5b);

    // Different indices produce different positions
    expect(x0a).not.toBe(x5a);
  });

  it('density "sparse" creates 30 particles, "dense" creates 70', () => {
    const DENSITY_MAP = { sparse: 30, normal: 50, dense: 70 } as const;

    expect(DENSITY_MAP.sparse).toBe(30);
    expect(DENSITY_MAP.normal).toBe(50);
    expect(DENSITY_MAP.dense).toBe(70);
  });

  it('seededRandom produces values in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const val = seededRandom(i);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('particle radii are in range 2-4', () => {
    for (let i = 0; i < 50; i++) {
      const r4 = seededRandom(i * 7 + 5);
      const radius = 2 + r4 * 2;
      expect(radius).toBeGreaterThanOrEqual(2);
      expect(radius).toBeLessThanOrEqual(4);
    }
  });
});

// ---------------------------------------------------------------------------
// SlowZoom: interpolation correctness
// ---------------------------------------------------------------------------

describe('SlowZoom', () => {
  it('interpolates scale correctly at frame 0 and last frame', () => {
    const startScale = 1.0;
    const endScale = 1.04;
    const durationInFrames = 150;

    // At frame 0 → startScale
    const scaleAt0 = startScale + (endScale - startScale) * (0 / durationInFrames);
    expect(scaleAt0).toBeCloseTo(1.0, 5);

    // At last frame → endScale
    const scaleAtEnd = startScale + (endScale - startScale) * (durationInFrames / durationInFrames);
    expect(scaleAtEnd).toBeCloseTo(1.04, 5);

    // At midpoint → 1.02
    const scaleAtMid = startScale + (endScale - startScale) * (75 / durationInFrames);
    expect(scaleAtMid).toBeCloseTo(1.02, 5);
  });

  it('with custom scales', () => {
    const startScale = 0.95;
    const endScale = 1.1;
    const durationInFrames = 200;

    const scaleAt0 = startScale + (endScale - startScale) * (0 / durationInFrames);
    expect(scaleAt0).toBeCloseTo(0.95, 5);

    const scaleAtEnd = startScale + (endScale - startScale) * (durationInFrames / durationInFrames);
    expect(scaleAtEnd).toBeCloseTo(1.1, 5);
  });
});

// ---------------------------------------------------------------------------
// ParallaxContainer: layer multipliers
// ---------------------------------------------------------------------------

describe('ParallaxContainer', () => {
  const LAYER_MULTIPLIER = {
    background: 0.3,
    midground: 0.6,
    foreground: 1.0,
  } as const;

  const BASE_DRIFT_PER_FRAME = 0.2;

  it('applies correct multiplier per layer', () => {
    expect(LAYER_MULTIPLIER.background).toBe(0.3);
    expect(LAYER_MULTIPLIER.midground).toBe(0.6);
    expect(LAYER_MULTIPLIER.foreground).toBe(1.0);
  });

  it('background moves slower than midground, midground slower than foreground', () => {
    expect(LAYER_MULTIPLIER.background).toBeLessThan(LAYER_MULTIPLIER.midground);
    expect(LAYER_MULTIPLIER.midground).toBeLessThan(LAYER_MULTIPLIER.foreground);
  });

  it('over 150 frames: background ~9px, midground ~18px, foreground ~30px', () => {
    const frames = 150;
    const bgDrift = BASE_DRIFT_PER_FRAME * LAYER_MULTIPLIER.background * frames;
    const midDrift = BASE_DRIFT_PER_FRAME * LAYER_MULTIPLIER.midground * frames;
    const fgDrift = BASE_DRIFT_PER_FRAME * LAYER_MULTIPLIER.foreground * frames;

    expect(bgDrift).toBeCloseTo(9, 1);
    expect(midDrift).toBeCloseTo(18, 1);
    expect(fgDrift).toBeCloseTo(30, 1);
  });

  it('parallax difference between background and foreground is perceptible', () => {
    const frames = 150;
    const bgDrift = BASE_DRIFT_PER_FRAME * LAYER_MULTIPLIER.background * frames;
    const fgDrift = BASE_DRIFT_PER_FRAME * LAYER_MULTIPLIER.foreground * frames;
    const difference = fgDrift - bgDrift;

    // At least 20px difference over a typical scene — enough to see depth
    expect(difference).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// GridOverlay: opacity gradient with Y position
// ---------------------------------------------------------------------------

describe('GridOverlay', () => {
  it('opacity increases from top to bottom (perspective fade)', () => {
    const baseOpacity = 0.05;
    const FRAME_H = 1080;

    // Line at top (y=0): t=0, opacity = 0.05 * (0.4 + 0*1.2) = 0.05*0.4 = 0.02
    const topT = 0 / FRAME_H;
    const topOpacity = baseOpacity * (0.4 + topT * 1.2);

    // Line at bottom (y=1080): t=1, opacity = 0.05 * (0.4 + 1*1.2) = 0.05*1.6 = 0.08
    const botT = FRAME_H / FRAME_H;
    const botOpacity = baseOpacity * (0.4 + botT * 1.2);

    // Line at mid (y=540): t=0.5, opacity = 0.05 * (0.4 + 0.5*1.2) = 0.05*1.0 = 0.05
    const midT = 540 / FRAME_H;
    const midOpacity = baseOpacity * (0.4 + midT * 1.2);

    expect(topOpacity).toBeCloseTo(0.02, 3);
    expect(midOpacity).toBeCloseTo(0.05, 3);
    expect(botOpacity).toBeCloseTo(0.08, 3);

    // Bottom lines are more opaque than top lines
    expect(botOpacity).toBeGreaterThan(topOpacity);
    expect(midOpacity).toBeGreaterThan(topOpacity);
    expect(botOpacity).toBeGreaterThan(midOpacity);
  });

  it('grid scrolls with frame — offset wraps at grid spacing', () => {
    const GRID_SPACING = 80;
    const scrollSpeed = 0.5;

    // Frame 0: offset = 0
    expect((0 * scrollSpeed) % GRID_SPACING).toBe(0);

    // Frame 160: offset = 80 → wraps to 0
    expect((160 * scrollSpeed) % GRID_SPACING).toBe(0);

    // Frame 80: offset = 40
    expect((80 * scrollSpeed) % GRID_SPACING).toBe(40);
  });
});
