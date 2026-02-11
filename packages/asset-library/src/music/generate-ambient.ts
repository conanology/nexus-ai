#!/usr/bin/env tsx
/**
 * Ambient Music Generator — creates a 60-second loopable background track.
 *
 * Run: npx tsx packages/asset-library/src/music/generate-ambient.ts
 *
 * Output: packages/asset-library/music/ambient-tech-01.wav
 *         apps/video-studio/public/audio/music/ambient-tech-01.wav
 *
 * Format: 44100 Hz, 16-bit, mono WAV
 *
 * Layers:
 *   1. Base: 55 Hz sine drone (A1), volume 0.3
 *   2. Pad: 220/277/330 Hz chord with slow LFO breathing, volume 0.15
 *   3. Texture: filtered white noise with slow bandpass sweep, volume 0.05
 *   4. Sparkle: random short high-pitched pings, volume 0.08
 *
 * The track crossfades the last 0.5s into the first 0.5s for seamless looping.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SAMPLE_RATE,
  createWavBuffer,
  samplesToBuffer,
  bandpassFilter,
  mix,
} from '../wav-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Output directories
// ---------------------------------------------------------------------------

const musicDir = join(__dirname, '../../music');
const publicMusicDir = join(__dirname, '../../../../apps/video-studio/public/audio/music');

for (const dir of [musicDir, publicMusicDir]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Seeded RNG (deterministic output)
// ---------------------------------------------------------------------------

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a number in [0, 1) */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  /** Returns a number in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_SEC = 60;
const CROSSFADE_SEC = 0.5;
const EXTRA_SEC = CROSSFADE_SEC; // generate extra for crossfade
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * (DURATION_SEC + EXTRA_SEC));
const OUTPUT_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);
const CROSSFADE_SAMPLES = Math.floor(SAMPLE_RATE * CROSSFADE_SEC);

// ---------------------------------------------------------------------------
// Layer 1: Base drone (55 Hz, volume 0.3)
// ---------------------------------------------------------------------------

function generateBaseDrone(): Float64Array {
  const samples = new Float64Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = 0.3 * Math.sin((2 * Math.PI * 55 * i) / SAMPLE_RATE);
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Layer 2: Pad chord (220/277/330 Hz with LFO breathing, volume 0.15)
// ---------------------------------------------------------------------------

function generatePadChord(): Float64Array {
  const samples = new Float64Array(TOTAL_SAMPLES);
  const freqs = [220, 277, 330]; // A3, C#4, E4

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    for (const freq of freqs) {
      // Each voice has slow volume oscillation (LFO at 0.05 Hz)
      // Offset each voice's LFO phase for organic movement
      const lfoPhase = (freq - 220) * 0.1; // different offset per voice
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.05 * t + lfoPhase);
      sample += lfo * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
    }

    samples[i] = 0.15 * (sample / freqs.length);
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Layer 3: Texture — filtered white noise with slow bandpass sweep (volume 0.05)
// ---------------------------------------------------------------------------

function generateTexture(): Float64Array {
  const rng = new SeededRandom(42);
  const samples = new Float64Array(TOTAL_SAMPLES);

  // Generate raw white noise
  const noise = new Float64Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    noise[i] = rng.next() * 2 - 1;
  }

  // Process in 0.5-second chunks with sweeping center frequency
  // Sweep 200 Hz → 800 Hz over 10 seconds, repeating
  const chunkSize = Math.floor(SAMPLE_RATE * 0.5);
  const sweepPeriod = 10; // seconds

  for (let start = 0; start < TOTAL_SAMPLES; start += chunkSize) {
    const end = Math.min(start + chunkSize, TOTAL_SAMPLES);
    const chunk = noise.subarray(start, end);

    const timeSec = start / SAMPLE_RATE;
    const sweepT = (timeSec % sweepPeriod) / sweepPeriod;
    // Triangle wave sweep: 0→1→0 over the period
    const sweepPos = sweepT < 0.5 ? sweepT * 2 : 2 - sweepT * 2;
    const centerFreq = 200 + 600 * sweepPos;

    const filtered = bandpassFilter(chunk, centerFreq, 2);

    for (let i = 0; i < filtered.length; i++) {
      samples[start + i] = 0.05 * filtered[i];
    }
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Layer 4: Sparkle — random short high-pitched pings (volume 0.08)
// ---------------------------------------------------------------------------

function generateSparkle(): Float64Array {
  const rng = new SeededRandom(123);
  const samples = new Float64Array(TOTAL_SAMPLES);

  const pingSamples = Math.floor(SAMPLE_RATE * 0.05); // 50ms per ping
  let nextPingTime = rng.range(2, 5); // first ping at 2-5 seconds

  while (nextPingTime < DURATION_SEC + EXTRA_SEC) {
    const startSample = Math.floor(nextPingTime * SAMPLE_RATE);
    const freq = rng.range(1000, 4000);

    for (let i = 0; i < pingSamples && startSample + i < TOTAL_SAMPLES; i++) {
      const t = i / pingSamples;
      const envelope = Math.exp(-8 * t); // fast decay
      samples[startSample + i] +=
        0.08 * envelope * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
    }

    // Next ping in 2-5 seconds
    nextPingTime += rng.range(2, 5);
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Mix all layers + crossfade for seamless loop
// ---------------------------------------------------------------------------

console.log('Generating 60-second ambient track...\n');
console.log('  Layer 1: Base drone (55 Hz)...');
const baseDrone = generateBaseDrone();

console.log('  Layer 2: Pad chord (A-C#-E)...');
const padChord = generatePadChord();

console.log('  Layer 3: Texture (filtered noise)...');
const texture = generateTexture();

console.log('  Layer 4: Sparkle (random pings)...');
const sparkle = generateSparkle();

// Mix all layers
console.log('\n  Mixing layers...');
let finalMix = mix(baseDrone, padChord);
finalMix = mix(finalMix, texture);
finalMix = mix(finalMix, sparkle);

// Apply seamless crossfade: blend the "extra" tail into the beginning
console.log('  Applying crossfade for seamless loop...');
const output = new Float64Array(OUTPUT_SAMPLES);

for (let i = 0; i < OUTPUT_SAMPLES; i++) {
  output[i] = finalMix[i];
}

// Crossfade: the tail (last CROSSFADE_SAMPLES of the extra section)
// blends into the beginning
for (let i = 0; i < CROSSFADE_SAMPLES; i++) {
  const t = i / CROSSFADE_SAMPLES;
  const tailIdx = OUTPUT_SAMPLES + i;
  // Fade in the beginning, fade out the tail
  output[i] = output[i] * t + finalMix[tailIdx] * (1 - t);
  // Also fade out the very end to match
  const endIdx = OUTPUT_SAMPLES - CROSSFADE_SAMPLES + i;
  output[endIdx] = output[endIdx] * (1 - t) + finalMix[i] * t;
}

// Convert to WAV
const pcm = samplesToBuffer(output);
const wav = createWavBuffer(pcm);

// Save to asset-library/music/
const assetPath = join(musicDir, 'ambient-tech-01.wav');
writeFileSync(assetPath, wav);

// Save to video-studio/public/audio/music/
const publicPath = join(publicMusicDir, 'ambient-tech-01.wav');
writeFileSync(publicPath, wav);

const sizeMB = (wav.length / (1024 * 1024)).toFixed(1);
console.log(`\n  ambient-tech-01.wav: ${wav.length} bytes (${sizeMB} MB, ${DURATION_SEC}s)`);
console.log(`\nSaved to:\n  ${assetPath}\n  ${publicPath}`);
