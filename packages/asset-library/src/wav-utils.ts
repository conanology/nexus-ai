/**
 * WAV Synthesis Utilities — pure Node.js audio generation.
 *
 * Provides low-level helpers for generating waveforms and writing WAV files.
 * Used by the SFX and ambient music generation scripts.
 *
 * @module @nexus-ai/asset-library/wav-utils
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SAMPLE_RATE = 44100;
export const BIT_DEPTH = 16;
export const NUM_CHANNELS = 1;
const MAX_AMPLITUDE = 32767;

// ---------------------------------------------------------------------------
// WAV File Helpers
// ---------------------------------------------------------------------------

/** Create a complete WAV file buffer from raw PCM data. */
export function createWavBuffer(pcmData: Buffer): Buffer {
  const dataSize = pcmData.length;
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = NUM_CHANNELS * (BIT_DEPTH / 8);

  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF header
  header.write('RIFF', offset); offset += 4;
  header.writeUInt32LE(36 + dataSize, offset); offset += 4;
  header.write('WAVE', offset); offset += 4;

  // fmt chunk
  header.write('fmt ', offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4;
  header.writeUInt16LE(1, offset); offset += 2; // PCM
  header.writeUInt16LE(NUM_CHANNELS, offset); offset += 2;
  header.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset); offset += 4;
  header.writeUInt16LE(blockAlign, offset); offset += 2;
  header.writeUInt16LE(BIT_DEPTH, offset); offset += 2;

  // data chunk
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(dataSize, offset);

  return Buffer.concat([header, pcmData]);
}

/** Convert floating-point samples (−1.0 … +1.0) to 16-bit PCM buffer. */
export function samplesToBuffer(samples: Float64Array): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.round(clamped * MAX_AMPLITUDE);
    buf.writeInt16LE(intSample, i * 2);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Waveform Generators
// ---------------------------------------------------------------------------

/** Generate a sine wave at the given frequency. */
export function sine(
  freq: number,
  duration: number,
  amplitude: number = 1.0,
): Float64Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

/** Generate a frequency sweep (linear interpolation from startFreq to endFreq). */
export function sweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  amplitude: number = 1.0,
): Float64Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    const freq = startFreq + (endFreq - startFreq) * t;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    samples[i] = amplitude * Math.sin(phase);
  }
  return samples;
}

/** Generate white noise. */
export function whiteNoise(
  duration: number,
  amplitude: number = 1.0,
): Float64Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = amplitude * (Math.random() * 2 - 1);
  }
  return samples;
}

/** Generate white noise with a deterministic seed. */
export function seededWhiteNoise(
  duration: number,
  amplitude: number,
  seed: number,
): Float64Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  let s = seed;
  for (let i = 0; i < numSamples; i++) {
    // Simple LCG (Linear Congruential Generator)
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    samples[i] = amplitude * ((s / 0x7fffffff) - 1);
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Envelope / Processing Helpers
// ---------------------------------------------------------------------------

/** Apply linear fade-in and fade-out to samples. */
export function applyFade(
  samples: Float64Array,
  fadeInSec: number,
  fadeOutSec: number,
): Float64Array {
  const fadeInSamples = Math.floor(fadeInSec * SAMPLE_RATE);
  const fadeOutSamples = Math.floor(fadeOutSec * SAMPLE_RATE);
  const result = new Float64Array(samples);

  for (let i = 0; i < fadeInSamples && i < result.length; i++) {
    result[i] *= i / fadeInSamples;
  }
  for (let i = 0; i < fadeOutSamples && i < result.length; i++) {
    const idx = result.length - 1 - i;
    result[idx] *= i / fadeOutSamples;
  }

  return result;
}

/** Apply exponential decay. decayRate is in 1/seconds (higher = faster). */
export function applyExpDecay(
  samples: Float64Array,
  decayRate: number,
): Float64Array {
  const result = new Float64Array(samples);
  for (let i = 0; i < result.length; i++) {
    result[i] *= Math.exp((-decayRate * i) / SAMPLE_RATE);
  }
  return result;
}

/** Mix two sample arrays (additive; arrays may differ in length). */
export function mix(a: Float64Array, b: Float64Array): Float64Array {
  const len = Math.max(a.length, b.length);
  const result = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0);
  }
  return result;
}

/**
 * Simple 2nd-order biquad bandpass filter.
 *
 * @param samples  Input signal
 * @param centerFreq  Center frequency (Hz)
 * @param Q  Quality factor (higher = narrower band)
 */
export function bandpassFilter(
  samples: Float64Array,
  centerFreq: number,
  Q: number,
): Float64Array {
  const w0 = (2 * Math.PI * centerFreq) / SAMPLE_RATE;
  const alpha = Math.sin(w0) / (2 * Q);

  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;

  const result = new Float64Array(samples.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    result[i] =
      (b0 / a0) * x0 +
      (b1 / a0) * x1 +
      (b2 / a0) * x2 -
      (a1 / a0) * y1 -
      (a2 / a0) * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = result[i];
  }

  return result;
}
