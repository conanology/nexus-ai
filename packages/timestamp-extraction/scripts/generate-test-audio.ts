/**
 * Generate synthetic test audio WAV files with ground-truth annotations.
 *
 * Uses wavefile to create WAV files with tone bursts (words) and silence
 * gaps (pauses). Annotations are generated programmatically alongside
 * the audio, guaranteeing 100% accuracy.
 *
 * Usage: npx tsx scripts/generate-test-audio.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import wavefile from 'wavefile';
const { WaveFile } = wavefile as unknown as { WaveFile: typeof wavefile.WaveFile };

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SAMPLE_RATE = 24000; // 24kHz to match STT config
const BIT_DEPTH = 16;
const NUM_CHANNELS = 1; // Mono
const TONE_FREQUENCY = 440; // A4 note for word tones

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '..', 'src', '__tests__', 'fixtures');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WordSpec {
  word: string;
  durationMs: number;
  pauseAfterMs: number;
}

interface AudioSpec {
  id: string;
  durationSec: number;
  pace: 'normal' | 'fast' | 'slow' | 'mixed';
  wpm: number;
  description: string;
  words: WordSpec[];
}

interface AnnotationWord {
  word: string;
  startMs: number;
  endMs: number;
}

// -----------------------------------------------------------------------------
// Audio Generation Helpers
// -----------------------------------------------------------------------------

/**
 * Generate a sine wave tone at the given frequency.
 */
function generateTone(
  durationMs: number,
  frequency: number,
  sampleRate: number
): number[] {
  const numSamples = Math.round((durationMs / 1000) * sampleRate);
  const samples: number[] = [];
  const amplitude = 0.7 * 32767; // 70% max amplitude for 16-bit

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Apply fade in/out envelope (10ms) to avoid clicks
    const fadeLen = Math.min(0.01, durationMs / 1000 / 4);
    let envelope = 1.0;
    if (t < fadeLen) {
      envelope = t / fadeLen;
    } else if (t > durationMs / 1000 - fadeLen) {
      envelope = (durationMs / 1000 - t) / fadeLen;
    }
    samples.push(Math.round(amplitude * envelope * Math.sin(2 * Math.PI * frequency * t)));
  }
  return samples;
}

/**
 * Generate silence samples.
 */
function generateSilence(durationMs: number, sampleRate: number): number[] {
  const numSamples = Math.round((durationMs / 1000) * sampleRate);
  return new Array(numSamples).fill(0);
}

// -----------------------------------------------------------------------------
// Word List Generators
// -----------------------------------------------------------------------------

const NORMAL_WORDS = [
  'the', 'latest', 'advancements', 'in', 'artificial', 'intelligence',
  'have', 'transformed', 'how', 'we', 'interact', 'with', 'technology',
  'every', 'day', 'from', 'voice', 'assistants', 'to', 'autonomous',
  'vehicles', 'these', 'systems', 'are', 'becoming', 'more', 'capable',
  'and', 'reliable', 'researchers', 'continue', 'to', 'push', 'the',
  'boundaries', 'of', 'what', 'machines', 'can', 'accomplish', 'in',
  'fields', 'like', 'natural', 'language', 'processing', 'computer',
  'vision', 'and', 'robotics', 'the', 'impact', 'on', 'society',
  'is', 'profound', 'creating', 'new', 'opportunities', 'and',
  'challenges', 'for', 'everyone', 'involved', 'in', 'this',
  'rapidly', 'evolving', 'landscape', 'we', 'must', 'carefully',
  'consider', 'the', 'ethical', 'implications',
];

const TECHNICAL_WORDS = [
  'the', 'TypeScript', '5.0', 'release', 'introduced', 'new', 'features',
  'for', 'API', 'development', 'including', 'OAuth', '2.0', 'integration',
  'with', 'HTTPS', 'endpoints', 'developers', 'can', 'now', 'use',
  'REST', 'APIs', 'more', 'efficiently', 'the', 'Node.js', 'runtime',
  'version', '20', 'supports', 'ESM', 'modules', 'natively', 'JSON',
  'parsing', 'is', '15', 'percent', 'faster', 'WebSocket', 'connections',
  'handle', '10000', 'concurrent', 'users', 'the', 'CI', 'CD', 'pipeline',
  'runs', '3', 'stages', 'build', 'test', 'and', 'deploy', 'Docker',
  'containers', 'use', 'Alpine', 'Linux', 'with', '256', 'megabytes',
  'of', 'RAM', 'the', 'GraphQL', 'schema', 'defines', '42', 'types',
  'MongoDB', 'stores', '1.5', 'million', 'documents', 'Redis', 'cache',
  'achieves', '99.9', 'percent', 'hit', 'rate', 'Kubernetes', 'clusters',
  'scale', 'to', '100', 'pods', 'automatically', 'the', 'TCP',
  'handshake', 'completes', 'in', '50', 'milliseconds', 'SSH',
  'tunnels', 'encrypt', 'all', 'traffic', 'between', 'services',
  'PostgreSQL', 'handles', '5000', 'transactions', 'per', 'second',
];

function generateWordSpec(
  pace: 'normal' | 'fast' | 'slow' | 'mixed',
  targetDurationSec: number,
  wordList: string[]
): WordSpec[] {
  const specs: WordSpec[] = [];
  let totalMs = 0;

  const getTimings = (wordIndex: number): { durationMs: number; pauseMs: number } => {
    switch (pace) {
      case 'normal':
        return { durationMs: 280, pauseMs: 120 };
      case 'fast':
        return { durationMs: 220, pauseMs: 80 };
      case 'slow':
        return { durationMs: 360, pauseMs: 160 };
      case 'mixed': {
        // Alternate between fast and slow sections with pauses
        const section = Math.floor(wordIndex / 8);
        if (section % 3 === 0) {
          return { durationMs: 220, pauseMs: 80 }; // Fast section
        } else if (section % 3 === 1) {
          return { durationMs: 360, pauseMs: 160 }; // Slow section
        } else {
          // Pause section - add extra silence
          return { durationMs: 300, pauseMs: 500 };
        }
      }
    }
  };

  const targetMs = targetDurationSec * 1000;

  for (let i = 0; totalMs < targetMs - 200; i++) {
    const word = wordList[i % wordList.length];
    const { durationMs, pauseMs } = getTimings(i);

    // Adjust last word to fit duration
    const remaining = targetMs - totalMs;
    const wordDur = Math.min(durationMs, remaining - 50);
    if (wordDur <= 50) break;

    const pauseDur = Math.min(pauseMs, targetMs - totalMs - wordDur);

    specs.push({
      word,
      durationMs: Math.max(wordDur, 50),
      pauseAfterMs: Math.max(pauseDur, 0),
    });
    totalMs += wordDur + Math.max(pauseDur, 0);
  }

  return specs;
}

// -----------------------------------------------------------------------------
// Audio Spec Definitions
// -----------------------------------------------------------------------------

function createAudioSpecs(): AudioSpec[] {
  return [
    {
      id: 'test-audio-01',
      durationSec: 30,
      pace: 'normal',
      wpm: 150,
      description: '30s normal pace narration about AI advancements',
      words: generateWordSpec('normal', 30, NORMAL_WORDS),
    },
    {
      id: 'test-audio-02',
      durationSec: 30,
      pace: 'fast',
      wpm: 180,
      description: '30s fast pace narration about AI advancements',
      words: generateWordSpec('fast', 30, NORMAL_WORDS),
    },
    {
      id: 'test-audio-03',
      durationSec: 30,
      pace: 'slow',
      wpm: 120,
      description: '30s slow pace narration about AI advancements',
      words: generateWordSpec('slow', 30, NORMAL_WORDS),
    },
    {
      id: 'test-audio-04',
      durationSec: 60,
      pace: 'mixed',
      wpm: 150,
      description: '60s mixed pace with deliberate pauses',
      words: generateWordSpec('mixed', 60, NORMAL_WORDS),
    },
    {
      id: 'test-audio-05',
      durationSec: 60,
      pace: 'normal',
      wpm: 150,
      description: '60s technical terms and numbers',
      words: generateWordSpec('normal', 60, TECHNICAL_WORDS),
    },
  ];
}

// -----------------------------------------------------------------------------
// WAV Generation
// -----------------------------------------------------------------------------

function generateWavAndAnnotations(spec: AudioSpec): {
  wavBuffer: Buffer;
  annotations: {
    words: AnnotationWord[];
    metadata: {
      duration: number;
      pace: string;
      wpm: number;
      description: string;
    };
  };
} {
  const allSamples: number[] = [];
  const annotationWords: AnnotationWord[] = [];
  let currentMs = 0;

  // Add small initial silence (100ms)
  allSamples.push(...generateSilence(100, SAMPLE_RATE));
  currentMs += 100;

  for (const wordSpec of spec.words) {
    const startMs = currentMs;

    // Generate tone for word
    const toneSamples = generateTone(wordSpec.durationMs, TONE_FREQUENCY, SAMPLE_RATE);
    allSamples.push(...toneSamples);
    currentMs += wordSpec.durationMs;

    const endMs = currentMs;

    annotationWords.push({
      word: wordSpec.word,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
    });

    // Generate silence for pause
    if (wordSpec.pauseAfterMs > 0) {
      allSamples.push(...generateSilence(wordSpec.pauseAfterMs, SAMPLE_RATE));
      currentMs += wordSpec.pauseAfterMs;
    }
  }

  // Pad to exact target duration
  const targetSamples = spec.durationSec * SAMPLE_RATE;
  while (allSamples.length < targetSamples) {
    allSamples.push(0);
  }

  // Trim to exact target duration
  const finalSamples = allSamples.slice(0, targetSamples);

  // Create WAV file
  const wav = new WaveFile();
  const int16Samples = new Int16Array(finalSamples);
  wav.fromScratch(NUM_CHANNELS, SAMPLE_RATE, `${BIT_DEPTH}` as '16', int16Samples);

  // Calculate actual WPM
  const actualDurationMin = spec.durationSec / 60;
  const actualWpm = Math.round(annotationWords.length / actualDurationMin);

  return {
    wavBuffer: Buffer.from(wav.toBuffer()),
    annotations: {
      words: annotationWords,
      metadata: {
        duration: spec.durationSec,
        pace: spec.pace,
        wpm: actualWpm,
        description: spec.description,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

function main(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const specs = createAudioSpecs();

  for (const spec of specs) {
    process.stdout.write(`Generating ${spec.id}...`);

    const { wavBuffer, annotations } = generateWavAndAnnotations(spec);

    // Write WAV file
    const wavPath = join(FIXTURES_DIR, `${spec.id}.wav`);
    writeFileSync(wavPath, wavBuffer);

    // Write annotation JSON
    const jsonPath = join(FIXTURES_DIR, `${spec.id}.annotations.json`);
    writeFileSync(jsonPath, JSON.stringify(annotations, null, 2) + '\n');

    const sizeMB = (wavBuffer.length / 1024 / 1024).toFixed(2);
    process.stdout.write(
      ` done (${sizeMB} MB, ${annotations.words.length} words, ${annotations.metadata.wpm} WPM)\n`
    );
  }

  process.stdout.write('\nAll test audio fixtures generated successfully.\n');
}

main();
