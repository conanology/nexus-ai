/**
 * Render test script — validates the audio stitching pipeline
 *
 * Generates synthetic mono WAV audio (matching TTS output format),
 * runs it through stitchAudio(), and validates the output WAV header
 * has the correct channel count and duration.
 *
 * Usage: npx tsx scripts/render-test.ts
 */

import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stitchAudio } from '../packages/tts/src/audio-quality.js';
import { parseWavHeader, calculateWavDuration } from '../packages/core/src/utils/wav-utils.js';
import type { AudioSegment } from '../packages/tts/src/types.js';

/**
 * Generate a synthetic mono WAV buffer (44100Hz, 16-bit PCM, 1 channel)
 * matching the format returned by Google TTS providers.
 */
function createMonoTestWAV(durationSec: number, sampleRate: number = 44100): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(durationSec * sampleRate);
  const pcmDataSize = numSamples * numChannels * (bitsPerSample / 8);

  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF header
  header.write('RIFF', offset); offset += 4;
  header.writeUInt32LE(36 + pcmDataSize, offset); offset += 4;
  header.write('WAVE', offset); offset += 4;

  // fmt chunk
  header.write('fmt ', offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4;
  header.writeUInt16LE(1, offset); offset += 2; // PCM
  header.writeUInt16LE(numChannels, offset); offset += 2;
  header.writeUInt32LE(sampleRate, offset); offset += 4;
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); offset += 4;
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;
  header.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(pcmDataSize, offset);

  // Generate a 440Hz sine wave
  const pcmData = Buffer.alloc(pcmDataSize);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.floor(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 10000);
    pcmData.writeInt16LE(sample, i * 2);
  }

  return Buffer.concat([header, pcmData]);
}

async function main() {
  console.log('=== NEXUS-AI Audio Pipeline Test ===\n');

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexus-render-test-'));
  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Validate synthetic mono WAV
    console.log('Test 1: Synthetic mono WAV generation');
    const monoWav = createMonoTestWAV(5); // 5 seconds
    const wavInfo = parseWavHeader(monoWav);

    if (wavInfo.numChannels !== 1) {
      console.log(`  FAIL: Expected 1 channel, got ${wavInfo.numChannels}`);
      failed++;
    } else if (wavInfo.sampleRate !== 44100) {
      console.log(`  FAIL: Expected 44100Hz, got ${wavInfo.sampleRate}`);
      failed++;
    } else {
      const duration = calculateWavDuration(wavInfo);
      console.log(`  PASS: Mono WAV, ${wavInfo.sampleRate}Hz, ${duration.toFixed(2)}s`);
      passed++;
    }

    // Test 2: Stitch two mono segments — output should remain mono
    console.log('\nTest 2: Stitch mono segments -> mono output');
    const seg1 = createMonoTestWAV(5);
    const seg2 = createMonoTestWAV(5);
    const segments: AudioSegment[] = [
      { index: 0, audioBuffer: seg1, durationSec: 5 },
      { index: 1, audioBuffer: seg2, durationSec: 5 },
    ];
    const stitched = stitchAudio(segments, 200);
    const stitchedInfo = parseWavHeader(stitched);

    if (stitchedInfo.numChannels !== 1) {
      console.log(`  FAIL: Expected 1 channel after stitching, got ${stitchedInfo.numChannels}`);
      console.log('  This is the chipmunk bug — stereo header on mono data!');
      failed++;
    } else {
      const stitchedDuration = calculateWavDuration(stitchedInfo);
      console.log(`  PASS: Stitched output is mono, ${stitchedDuration.toFixed(2)}s`);
      passed++;
    }

    // Test 3: Verify stitched duration is correct
    console.log('\nTest 3: Stitched duration matches expected');
    const expectedDuration = 5 + 5 + 0.2; // 2 segments + 200ms silence
    const actualDuration = calculateWavDuration(stitchedInfo);
    const durationDiff = Math.abs(actualDuration - expectedDuration);

    if (durationDiff > 0.01) {
      console.log(`  FAIL: Expected ~${expectedDuration.toFixed(2)}s, got ${actualDuration.toFixed(2)}s (diff: ${durationDiff.toFixed(3)}s)`);
      failed++;
    } else {
      console.log(`  PASS: Duration ${actualDuration.toFixed(2)}s (expected ${expectedDuration.toFixed(2)}s)`);
      passed++;
    }

    // Test 4: Verify WAV header byte-level correctness
    console.log('\nTest 4: WAV header byte-level validation');
    const sampleRate = stitched.readUInt32LE(24);
    const channels = stitched.readUInt16LE(22);
    const bitsPerSample = stitched.readUInt16LE(34);
    const audioFormat = stitched.readUInt16LE(20);
    const byteRate = stitched.readUInt32LE(28);
    const expectedByteRate = sampleRate * channels * (bitsPerSample / 8);

    if (audioFormat !== 1) {
      console.log(`  FAIL: Audio format ${audioFormat}, expected 1 (PCM)`);
      failed++;
    } else if (byteRate !== expectedByteRate) {
      console.log(`  FAIL: Byte rate ${byteRate}, expected ${expectedByteRate}`);
      failed++;
    } else {
      console.log(`  PASS: PCM, ${sampleRate}Hz, ${channels}ch, ${bitsPerSample}bit, ${byteRate} bytes/sec`);
      passed++;
    }

    // Test 5: Multiple segments (simulate a real TTS pipeline)
    console.log('\nTest 5: Stitch 5 mono segments (simulating real pipeline)');
    const multiSegments: AudioSegment[] = [];
    for (let i = 0; i < 5; i++) {
      multiSegments.push({
        index: i,
        audioBuffer: createMonoTestWAV(2), // 2 seconds each
        durationSec: 2,
      });
    }
    const multiStitched = stitchAudio(multiSegments, 200);
    const multiInfo = parseWavHeader(multiStitched);
    const multiDuration = calculateWavDuration(multiInfo);
    const expectedMultiDuration = 5 * 2 + 4 * 0.2; // 5 segments + 4 gaps

    if (multiInfo.numChannels !== 1) {
      console.log(`  FAIL: Expected mono, got ${multiInfo.numChannels} channels`);
      failed++;
    } else if (Math.abs(multiDuration - expectedMultiDuration) > 0.01) {
      console.log(`  FAIL: Duration ${multiDuration.toFixed(2)}s, expected ${expectedMultiDuration.toFixed(2)}s`);
      failed++;
    } else {
      console.log(`  PASS: 5 segments stitched, mono, ${multiDuration.toFixed(2)}s`);
      passed++;
    }

    // Write test output for manual inspection if needed
    const outputPath = join(tmpDir, 'test-stitched.wav');
    await writeFile(outputPath, stitched);
    console.log(`\nTest WAV written to: ${outputPath}`);

    // Summary
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFATAL:', error);
    process.exit(1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main();
