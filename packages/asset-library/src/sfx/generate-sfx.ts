#!/usr/bin/env tsx
/**
 * SFX Generator — creates 7 sound effect WAV files using pure synthesis.
 *
 * Run: npx tsx packages/asset-library/src/sfx/generate-sfx.ts
 *
 * Output: packages/asset-library/sfx/*.wav
 *         apps/video-studio/public/audio/sfx/*.wav
 *
 * Format: 44100 Hz, 16-bit, mono WAV
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SAMPLE_RATE,
  createWavBuffer,
  samplesToBuffer,
  sine,
  sweep,
  whiteNoise,
  applyFade,
  applyExpDecay,
  mix,
  bandpassFilter,
} from '../wav-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Output directories
// ---------------------------------------------------------------------------

const sfxDir = join(__dirname, '../../sfx');
const publicSfxDir = join(__dirname, '../../../../apps/video-studio/public/audio/sfx');

for (const dir of [sfxDir, publicSfxDir]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// SFX Generators
// ---------------------------------------------------------------------------

/**
 * whoosh-in.wav — quick rising sweep (0.4s)
 * Sine sweep 200→2000 Hz, white noise at 10%, fade-in/out
 */
function generateWhooshIn(): Float64Array {
  const swp = sweep(200, 2000, 0.4, 0.7);
  const noise = whiteNoise(0.4, 0.07); // 10% of 0.7
  const mixed = mix(swp, noise);
  return applyFade(mixed, 0.05, 0.1);
}

/**
 * whoosh-out.wav — quick falling sweep (0.4s)
 * Reverse of whoosh-in: 2000→200 Hz
 */
function generateWhooshOut(): Float64Array {
  const swp = sweep(2000, 200, 0.4, 0.7);
  const noise = whiteNoise(0.4, 0.07);
  const mixed = mix(swp, noise);
  return applyFade(mixed, 0.05, 0.1);
}

/**
 * impact-soft.wav — soft bass thud (0.3s)
 * 80 Hz sine with fast exponential decay + 1ms click transient at 4000 Hz
 */
function generateImpactSoft(): Float64Array {
  const duration = 0.3;
  const numSamples = Math.floor(SAMPLE_RATE * duration);

  // Bass thud
  const thud = applyExpDecay(sine(80, duration, 0.8), 10);

  // Click transient: 1ms burst of 4000 Hz
  const clickSamples = Math.floor(SAMPLE_RATE * 0.001);
  const click = new Float64Array(numSamples);
  for (let i = 0; i < clickSamples; i++) {
    click[i] = 0.3 * Math.sin((2 * Math.PI * 4000 * i) / SAMPLE_RATE);
  }

  return mix(thud, click);
}

/**
 * impact-hard.wav — harder bass thud (0.4s)
 * 60 Hz + 30 Hz sub-bass, louder, longer decay + click transient
 */
function generateImpactHard(): Float64Array {
  const duration = 0.4;
  const numSamples = Math.floor(SAMPLE_RATE * duration);

  const thud = applyExpDecay(sine(60, duration, 0.9), 7);
  const sub = applyExpDecay(sine(30, duration, 0.5), 6);

  // Click transient
  const clickSamples = Math.floor(SAMPLE_RATE * 0.001);
  const click = new Float64Array(numSamples);
  for (let i = 0; i < clickSamples; i++) {
    click[i] = 0.4 * Math.sin((2 * Math.PI * 4000 * i) / SAMPLE_RATE);
  }

  return mix(mix(thud, sub), click);
}

/**
 * click.wav — subtle tick (0.1s)
 * 3000 Hz sine, 5ms attack, 50ms exponential decay
 */
function generateClick(): Float64Array {
  const duration = 0.1;
  const tone = sine(3000, duration, 0.5);
  const attackSamples = Math.floor(0.005 * SAMPLE_RATE);
  const result = new Float64Array(tone);

  for (let i = 0; i < result.length; i++) {
    if (i < attackSamples) {
      // Linear attack
      result[i] *= i / attackSamples;
    } else {
      // Fast exponential decay after attack
      result[i] *= Math.exp((-20 * (i - attackSamples)) / SAMPLE_RATE);
    }
  }

  return result;
}

/**
 * reveal.wav — shimmery reveal chord (0.5s)
 * Three sine waves at 1000/1500/2000 Hz, each detuned ±2 Hz for chorus
 * Fast attack, slow fade-out
 */
function generateReveal(): Float64Array {
  const duration = 0.5;

  // Main tones + detuned copies for chorus effect
  const a1 = sine(1000, duration, 0.2);
  const a2 = sine(1002, duration, 0.2);
  const b1 = sine(1500, duration, 0.2);
  const b2 = sine(1498, duration, 0.2);
  const c1 = sine(2000, duration, 0.2);
  const c2 = sine(2002, duration, 0.2);

  let mixed = mix(a1, a2);
  mixed = mix(mixed, mix(b1, b2));
  mixed = mix(mixed, mix(c1, c2));

  // Fast attack, exponential decay, then fade edges
  const decayed = applyExpDecay(mixed, 3);
  return applyFade(decayed, 0.01, 0.15);
}

/**
 * transition.wav — scene transition marker (0.6s)
 * Quick white noise burst (0.1s) → low sine sweep 100→400 Hz (0.5s) → fade out
 */
function generateTransition(): Float64Array {
  const totalDuration = 0.6;
  const numSamples = Math.floor(SAMPLE_RATE * totalDuration);
  const result = new Float64Array(numSamples);

  // White noise burst (first 0.1s, with internal decay)
  const noiseSamples = Math.floor(SAMPLE_RATE * 0.1);
  for (let i = 0; i < noiseSamples; i++) {
    result[i] = 0.4 * (Math.random() * 2 - 1) * (1 - i / noiseSamples);
  }

  // Sine sweep 100→400 Hz starting at 0.1s, with fade-out
  const sweepStart = noiseSamples;
  const sweepSamples = Math.floor(SAMPLE_RATE * 0.5);
  let phase = 0;
  for (let i = 0; i < sweepSamples && sweepStart + i < numSamples; i++) {
    const t = i / sweepSamples;
    const freq = 100 + 300 * t;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const fadeOut = 1 - t;
    result[sweepStart + i] += 0.5 * Math.sin(phase) * fadeOut;
  }

  return applyFade(result, 0.01, 0.05);
}

// ---------------------------------------------------------------------------
// New SFX — Fireship-quality sound density
// ---------------------------------------------------------------------------

/**
 * keyboard-clack.wav — 0.08s
 * 3500Hz click transient + bandpass-filtered noise (2kHz), exp decay 30
 */
function generateKeyboardClack(): Float64Array {
  const duration = 0.08;
  const click = applyExpDecay(sine(3500, duration, 0.6), 30);
  const noise = applyExpDecay(bandpassFilter(whiteNoise(duration, 0.4), 2000, 2), 30);
  return mix(click, noise);
}

/**
 * pen-scratch.wav — 0.3s
 * Bandpass noise (1.8kHz, Q=1.5) + amplitude modulation for friction
 */
function generatePenScratch(): Float64Array {
  const duration = 0.3;
  const noise = bandpassFilter(whiteNoise(duration, 0.5), 1800, 1.5);
  const numSamples = noise.length;
  const result = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    // Amplitude modulation: tremolo at 25Hz for scratchy friction
    const mod = 0.5 + 0.5 * Math.sin((2 * Math.PI * 25 * i) / SAMPLE_RATE);
    result[i] = noise[i] * mod;
  }
  return applyFade(applyExpDecay(result, 5), 0.005, 0.05);
}

/**
 * record-scratch.wav — 0.2s
 * Sweep 180→80Hz + bandpass noise (400Hz)
 */
function generateRecordScratch(): Float64Array {
  const duration = 0.2;
  const swp = applyExpDecay(sweep(180, 80, duration, 0.6), 8);
  const noise = applyExpDecay(bandpassFilter(whiteNoise(duration, 0.3), 400, 1.2), 10);
  return mix(swp, noise);
}

/**
 * digital-scan.wav — 0.2s
 * Sweep 800→2400Hz + quantized noise
 */
function generateDigitalScan(): Float64Array {
  const duration = 0.2;
  const swp = applyExpDecay(sweep(800, 2400, duration, 0.5), 8);
  const noise = whiteNoise(duration, 0.2);
  // Quantize noise for digital artifacts
  const numSamples = noise.length;
  const quantized = new Float64Array(numSamples);
  const stepSize = 4; // quantize to every 4 samples for stepped effect
  for (let i = 0; i < numSamples; i++) {
    quantized[i] = noise[Math.floor(i / stepSize) * stepSize];
  }
  return applyFade(mix(swp, applyExpDecay(quantized, 12)), 0.005, 0.03);
}

/**
 * pop.wav — 0.1s
 * 800Hz sine burst, exp decay 25
 */
function generatePop(): Float64Array {
  return applyExpDecay(sine(800, 0.1, 0.6), 25);
}

/**
 * deep-boom.wav — 0.3s
 * 40Hz + 80Hz sub-bass, exp decay 5
 */
function generateDeepBoom(): Float64Array {
  const duration = 0.3;
  const sub1 = applyExpDecay(sine(40, duration, 0.7), 5);
  const sub2 = applyExpDecay(sine(80, duration, 0.5), 5);
  return applyFade(mix(sub1, sub2), 0.001, 0.05);
}

/**
 * blip.wav — 0.1s
 * 1200Hz sine, exp decay 30
 */
function generateBlip(): Float64Array {
  return applyExpDecay(sine(1200, 0.1, 0.5), 30);
}

/**
 * hit.wav — 0.1s
 * 150Hz sine + noise burst, exp decay 20
 */
function generateHit(): Float64Array {
  const duration = 0.1;
  const bass = applyExpDecay(sine(150, duration, 0.6), 20);
  const noise = applyExpDecay(whiteNoise(duration, 0.3), 20);
  return mix(bass, noise);
}

// ---------------------------------------------------------------------------
// Generate all SFX
// ---------------------------------------------------------------------------

const sfxMap: Record<string, () => Float64Array> = {
  'whoosh-in': generateWhooshIn,
  'whoosh-out': generateWhooshOut,
  'impact-soft': generateImpactSoft,
  'impact-hard': generateImpactHard,
  'click': generateClick,
  'reveal': generateReveal,
  'transition': generateTransition,
  'keyboard-clack': generateKeyboardClack,
  'pen-scratch': generatePenScratch,
  'record-scratch': generateRecordScratch,
  'digital-scan': generateDigitalScan,
  'pop': generatePop,
  'deep-boom': generateDeepBoom,
  'blip': generateBlip,
  'hit': generateHit,
};

console.log('Generating SFX...\n');

for (const [name, generator] of Object.entries(sfxMap)) {
  const samples = generator();
  const pcm = samplesToBuffer(samples);
  const wav = createWavBuffer(pcm);
  const durationSec = (samples.length / SAMPLE_RATE).toFixed(2);

  // Save to asset-library/sfx/
  const assetPath = join(sfxDir, `${name}.wav`);
  writeFileSync(assetPath, wav);

  // Save to video-studio/public/audio/sfx/
  const publicPath = join(publicSfxDir, `${name}.wav`);
  writeFileSync(publicPath, wav);

  console.log(`  ${name}.wav: ${wav.length} bytes (${durationSec}s)`);
}

console.log(`\nAll ${Object.keys(sfxMap).length} SFX generated in:\n  ${sfxDir}\n  ${publicSfxDir}`);
