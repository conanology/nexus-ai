#!/usr/bin/env tsx
/**
 * Nexus AI — Local Pipeline Runner (Production Stages)
 *
 * Orchestrates the FULL Nexus AI pipeline using actual production stage
 * packages, with local-mode storage delegation so no GCP billing is needed.
 * Only requires a Google AI Studio API key (NEXUS_GEMINI_API_KEY).
 *
 * Steps:
 *   1.  Validate environment
 *   2.  News sourcing  (HN, HuggingFace, arXiv)
 *   3.  Research brief  (Gemini LLM via @nexus-ai/research)
 *   4.  Script generation  (Writer → Critic → Optimizer via @nexus-ai/script-gen)
 *   5.  Pronunciation  (try-catch — needs Firestore, skipped locally)
 *   6.  TTS audio  (AI Studio TTS → edge-tts → silent fallback)
 *   7.  Timestamp estimation  (character-weighted fallback from @nexus-ai/timestamp-extraction)
 *   8.  Director Agent  (scene classification via Gemini)
 *   9.  Visual enrichment  (logos, images, screenshots, overlays, annotations, memes)
 *   10. Remotion render
 *   11. Chapters + summary
 *
 * Usage:
 *   npx tsx scripts/run-local.ts                           (auto-discover topic)
 *   npx tsx scripts/run-local.ts "fallback topic"          (use if sourcing fails)
 *   npx tsx scripts/run-local.ts --script path/to/script.txt
 *
 * @module scripts/run-local
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Resolve project paths
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Resolve Remotion from render-service's deps (pnpm strict mode)
const _require = createRequire(
  path.join(PROJECT_ROOT, 'apps', 'render-service', 'package.json'),
);
const { bundle } = _require('@remotion/bundler') as typeof import('@remotion/bundler');
const { renderMedia, selectComposition } = _require(
  '@remotion/renderer',
) as typeof import('@remotion/renderer');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VIDEO_STUDIO_ENTRY = path.resolve(
  PROJECT_ROOT, 'apps', 'video-studio', 'src', 'index.ts',
);
const FPS = 30;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Retry a fetch request with exponential backoff on 429 (rate limit) errors.
 * Parses the Retry-After / retryDelay from the response when available.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { maxRetries = 4, label = 'API' }: { maxRetries?: number; label?: string } = {},
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.status !== 429) return response;

    // Rate limited — extract delay
    let delaySec = Math.min(15 * Math.pow(2, attempt), 120); // default: 15s, 30s, 60s, 120s
    try {
      const body = await response.clone().json() as any;
      const retryInfo = body?.error?.details?.find(
        (d: any) => d['@type']?.includes('RetryInfo'),
      );
      if (retryInfo?.retryDelay) {
        const parsed = parseFloat(retryInfo.retryDelay);
        if (!isNaN(parsed)) delaySec = Math.ceil(parsed) + 2; // add 2s buffer
      }
    } catch { /* use default */ }

    if (attempt === maxRetries) {
      console.log(`  ${label}: Rate limited after ${maxRetries + 1} attempts. Giving up.`);
      return response; // return the 429 so caller can handle
    }

    console.log(`  ${label}: Rate limited (429). Waiting ${delaySec}s before retry ${attempt + 1}/${maxRetries}...`);
    await new Promise(r => setTimeout(r, delaySec * 1000));
  }

  // Should never reach here
  throw new Error('fetchWithRetry: unexpected exit');
}

function header(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Get today's date in YYYY-MM-DD format for pipelineId */
function getPipelineId(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Step 1: Validate Environment
// ---------------------------------------------------------------------------
function validateEnvironment(): void {
  header('Step 1: Environment Validation');

  // Load .env.local if it exists
  const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
  if (existsSync(envLocalPath)) {
    const envContent = require('fs').readFileSync(envLocalPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    console.log('  Loaded .env.local');
  }

  // Force local storage mode
  process.env.STORAGE_MODE = 'local';

  const apiKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const hasVideoStudio = existsSync(VIDEO_STUDIO_ENTRY);
  let hasFfmpeg = false;
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    hasFfmpeg = true;
  } catch { /* not available */ }

  let hasFfprobe = false;
  try {
    execSync('ffprobe -version', { stdio: 'pipe' });
    hasFfprobe = true;
  } catch { /* not available */ }

  let hasEdgeTts = false;
  try {
    execSync('edge-tts --version', { stdio: 'pipe' });
    hasEdgeTts = true;
  } catch { /* not available */ }

  console.log(`  NEXUS_GEMINI_API_KEY: ${apiKey ? 'SET' : 'NOT SET — FATAL'}`);
  console.log(`  Video Studio entry:  ${hasVideoStudio ? 'FOUND' : 'NOT FOUND — FATAL'}`);
  console.log(`  ffmpeg:              ${hasFfmpeg ? 'AVAILABLE' : 'NOT FOUND — may be needed for audio'}`);
  console.log(`  ffprobe:             ${hasFfprobe ? 'AVAILABLE' : 'NOT FOUND — skip metadata validation'}`);
  console.log(`  edge-tts:            ${hasEdgeTts ? 'AVAILABLE (fallback TTS)' : 'NOT INSTALLED (optional)'}`);
  console.log(`  STORAGE_MODE:        local`);
  console.log('');

  if (!apiKey) {
    console.error('  FATAL: NEXUS_GEMINI_API_KEY or GEMINI_API_KEY must be set.');
    console.error('  Get one from https://aistudio.google.com/apikey');
    process.exit(1);
  }

  if (!hasVideoStudio) {
    console.error(`  FATAL: Video Studio entry not found at: ${VIDEO_STUDIO_ENTRY}`);
    process.exit(1);
  }

  console.log('  Running Nexus AI in LOCAL MODE (Production Stages)');
}

// ---------------------------------------------------------------------------
// Step 2: News Sourcing
// ---------------------------------------------------------------------------
async function runNewsSourcing(
  pipelineId: string,
  fallbackTopic: string,
): Promise<{ title: string; url: string; source: string }> {
  header('Step 2: News Sourcing');

  console.log('  Fetching trending topics from HN, HuggingFace, arXiv...');

  try {
    const { executeNewsSourcing } = await import(
      '../packages/news-sourcing/src/index.js'
    );

    const output = await executeNewsSourcing({
      pipelineId,
      previousStage: null,
      data: {
        // Only use sources that don't require authentication
        enabledSources: ['hacker-news', 'huggingface', 'arxiv'],
      },
      config: { timeout: 60000, retries: 2 },
    });

    const result = output.data;

    if (result.selected) {
      console.log(`  Selected: "${result.selected.title}"`);
      console.log(`  Source:   ${result.selected.source}`);
      console.log(`  URL:      ${result.selected.url}`);
      console.log(`  Candidates considered: ${result.candidates.length}`);
      return {
        title: result.selected.title,
        url: result.selected.url,
        source: result.selected.source,
      };
    }

    // Fallback triggered (< 3 fresh candidates)
    console.log(`  News sourcing found ${result.candidates.length} fresh candidates (need 3)`);

    // If there are deep-dive candidates, use the top one
    if (result.deepDiveCandidates?.length) {
      const deepDive = result.deepDiveCandidates[0];
      console.log(`  Using deep-dive candidate: "${deepDive.title}"`);
      return { title: deepDive.title, url: deepDive.url, source: deepDive.source };
    }

    // If there are any candidates at all, use the best one
    if (result.candidates.length > 0) {
      const best = result.candidates[0];
      console.log(`  Using best available candidate: "${best.title}"`);
      return { title: best.title, url: best.url, source: best.source };
    }

    if (fallbackTopic) {
      console.log(`  Using provided fallback topic: "${fallbackTopic}"`);
      return { title: fallbackTopic, url: '', source: 'manual' };
    }

    throw new Error('News sourcing found no topics and no fallback topic was provided');
  } catch (error) {
    console.log(`  News sourcing failed: ${error instanceof Error ? error.message : String(error)}`);
    if (fallbackTopic) {
      console.log(`  Using provided fallback topic: "${fallbackTopic}"`);
      return { title: fallbackTopic, url: '', source: 'manual' };
    }
    throw new Error(`News sourcing failed and no fallback topic provided: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Research
// ---------------------------------------------------------------------------
async function runResearch(
  pipelineId: string,
  topic: { title: string; url: string; source: string },
): Promise<{ researchBrief: string; topicData: any }> {
  header('Step 3: Research Brief Generation');

  console.log(`  Topic: "${topic.title}"`);
  console.log('  Generating ~2000-word research brief via Gemini...');

  try {
    const { executeResearch } = await import(
      '../packages/research/src/index.js'
    );

    const output = await executeResearch({
      pipelineId,
      previousStage: 'news-sourcing',
      data: {
        topic: {
          url: topic.url,
          title: topic.title,
          source: topic.source,
        },
      },
      config: { timeout: 120000, retries: 2 },
    });

    const result = output.data;
    console.log(`  Research brief: ${result.wordCount} words`);
    console.log(`  Provider: ${result.provider.name} (${result.provider.tier})`);

    return {
      researchBrief: result.researchBrief || result.brief,
      topicData: result.topicData || {
        title: topic.title,
        url: topic.url,
        source: topic.source,
        publishedAt: new Date().toISOString(),
        viralityScore: 0,
      },
    };
  } catch (error) {
    console.log(`  Research failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Step 4: Script Generation (Multi-Agent)
// ---------------------------------------------------------------------------
async function runScriptGen(
  pipelineId: string,
  researchBrief: string,
  topicData: any,
): Promise<{ scriptGenOutput: any; scriptText: string; directionDocument: any }> {
  header('Step 4: Script Generation (Writer → Critic → Optimizer)');

  console.log('  Running multi-agent script generation...');

  try {
    const { executeScriptGen, getScriptText, isV2Output } = await import(
      '../packages/script-gen/src/index.js'
    );

    const output = await executeScriptGen({
      pipelineId,
      previousStage: 'research',
      data: {
        researchBrief,
        topicData,
      },
      config: { timeout: 300000, retries: 2 },
    });

    const result = output.data;
    const scriptText = getScriptText(result);
    // Access directionDocument directly — getDirectionDocument() requires audioDurationSec
    // which we don't have yet (TTS hasn't run). For V2 it's already on the output object.
    const directionDoc = isV2Output(result) ? result.directionDocument : null;
    const wordCount = scriptText.split(/\s+/).length;

    console.log(`  Script: ${wordCount} words`);
    console.log(`  V2 output: ${isV2Output(result) ? 'yes (with direction document)' : 'no (V1 legacy)'}`);
    if (directionDoc) {
      console.log(`  Direction segments: ${directionDoc.segments.length}`);
    }
    if (output.warnings?.length) {
      console.log(`  Warnings: ${output.warnings.join('; ')}`);
    }

    return {
      scriptGenOutput: result,
      scriptText,
      directionDocument: directionDoc,
    };
  } catch (error) {
    console.log(`  Script generation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Step 5: Pronunciation (try-catch — Firestore dependency)
// ---------------------------------------------------------------------------
async function runPronunciation(
  pipelineId: string,
  scriptGenOutput: any,
  topicData: any,
  directionDocument: any,
): Promise<{ ssmlScript: string | null; scriptText: string }> {
  header('Step 5: Pronunciation Dictionary');

  try {
    const { executePronunciation } = await import(
      '../packages/pronunciation/src/index.js'
    );
    const { getScriptText } = await import(
      '../packages/script-gen/src/index.js'
    );

    const output = await executePronunciation({
      pipelineId,
      previousStage: 'script-gen',
      data: {
        script: scriptGenOutput,
        topicData,
        directionDocument,
      },
      config: { timeout: 30000, retries: 1 },
    });

    const result = output.data;
    console.log(`  SSML script generated`);
    console.log(`  Flagged terms: ${result.flaggedTerms.length}`);
    if (result.flaggedTerms.length > 0) {
      console.log(`    ${result.flaggedTerms.slice(0, 5).join(', ')}${result.flaggedTerms.length > 5 ? '...' : ''}`);
    }

    return {
      ssmlScript: result.ssmlScript,
      scriptText: getScriptText(scriptGenOutput),
    };
  } catch (error) {
    console.log(`  Pronunciation stage skipped: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  (Expected in local mode — Firestore dictionary unavailable)');

    const { getScriptText } = await import(
      '../packages/script-gen/src/index.js'
    );
    return {
      ssmlScript: null,
      scriptText: getScriptText(scriptGenOutput),
    };
  }
}

// ---------------------------------------------------------------------------
// Step 6: TTS Audio Generation (local — production TTS needs GCP SA)
// ---------------------------------------------------------------------------
async function generateAudio(
  scriptText: string,
  outputPath: string,
): Promise<{ durationSec: number; source: string }> {
  header('Step 6: TTS Audio Generation');

  // Use SSML or plain text for TTS
  const ttsInput = scriptText;

  // Try AI Studio TTS first
  const apiKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log('  Trying AI Studio TTS (gemini-2.5-flash-preview-tts)...');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ttsInput }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        }),
      }, { label: 'TTS' });

      if (response.ok) {
        const data = await response.json() as any;
        const audioPart = data.candidates?.[0]?.content?.parts?.find(
          (p: any) => p.inlineData?.mimeType?.startsWith('audio/')
        );

        if (audioPart?.inlineData) {
          console.log('  AI Studio TTS succeeded!');
          const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

          // Wrap PCM in WAV header (24kHz, 16-bit, mono)
          const audioBuffer = wrapPcmAsWav(rawBuffer, 24000, 1, 16);
          await fs.writeFile(outputPath, audioBuffer);

          const durationSec = rawBuffer.length / (24000 * 2); // 16-bit = 2 bytes per sample
          console.log(`  Audio: ${durationSec.toFixed(1)}s, ${formatBytes(audioBuffer.length)}`);
          return { durationSec, source: 'AI Studio TTS (Gemini)' };
        }
      }
      const errText = await response.text().catch(() => '');
      console.log(`  AI Studio TTS not available (${response.status}), trying fallback...`);
      if (errText.length < 200) console.log(`  Reason: ${errText}`);
    } catch (err) {
      console.log(`  AI Studio TTS error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Try edge-tts fallback
  try {
    execSync('edge-tts --version', { stdio: 'pipe' });
    console.log('  Trying edge-tts (Microsoft Neural TTS)...');

    const tmpMp3 = path.join(os.tmpdir(), `nexus-tts-${Date.now()}.mp3`);
    execSync(
      `edge-tts --voice en-US-JennyNeural --rate +0% --text "${ttsInput.replace(/"/g, '\\"')}" --write-media "${tmpMp3}"`,
      { stdio: 'pipe', timeout: 120000 },
    );

    // Convert to WAV
    execSync(
      `ffmpeg -i "${tmpMp3}" -acodec pcm_s16le -ar 44100 -ac 1 -y "${outputPath}"`,
      { stdio: 'pipe', timeout: 60000 },
    );

    await fs.unlink(tmpMp3).catch(() => {});
    const stats = statSync(outputPath);
    const durationSec = (stats.size - 44) / (44100 * 2); // rough estimate
    console.log(`  edge-tts: ${durationSec.toFixed(1)}s, ${formatBytes(stats.size)}`);
    return { durationSec, source: 'edge-tts (Microsoft Neural)' };
  } catch {
    console.log('  edge-tts not available, using silent audio fallback...');
  }

  // Silent audio fallback
  const wordCount = ttsInput.split(/\s+/).length;
  const durationSec = Math.max(30, Math.ceil(wordCount / 2.5)); // ~2.5 words/sec
  console.log(`  Generating ${durationSec}s silent WAV (${wordCount} words at 2.5 words/sec)...`);

  const audioBuffer = generateSilentWav(durationSec);
  await fs.writeFile(outputPath, audioBuffer);
  console.log(`  Silent audio: ${durationSec}s, ${formatBytes(audioBuffer.length)}`);
  return { durationSec, source: 'silent fallback' };
}

function generateSilentWav(durationSec: number): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function wrapPcmAsWav(pcm: Buffer, sampleRate: number, channels: number, bits: number): Buffer {
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bits / 8), 28);
  buffer.writeUInt16LE(channels * (bits / 8), 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);

  return buffer;
}

// ---------------------------------------------------------------------------
// Step 7: Timestamp Estimation
// ---------------------------------------------------------------------------
async function runTimestampEstimation(
  directionDocument: any,
  audioDurationSec: number,
): Promise<{ wordTimings: any[]; enrichedDocument: any }> {
  header('Step 7: Timestamp Estimation');

  if (!directionDocument) {
    console.log('  No direction document — using simple word timings');
    return { wordTimings: [], enrichedDocument: null };
  }

  try {
    const { applyEstimatedTimings } = await import(
      '../packages/timestamp-extraction/src/index.js'
    );

    console.log(`  Estimating word timings for ${directionDocument.segments.length} segments...`);
    console.log(`  Audio duration: ${audioDurationSec.toFixed(1)}s`);

    const result = applyEstimatedTimings(directionDocument, audioDurationSec);

    console.log(`  Word timings: ${result.wordTimings.length} words`);
    console.log(`  Method: character-weighted estimation`);

    return {
      wordTimings: result.wordTimings,
      enrichedDocument: result.document,
    };
  } catch (error) {
    console.log(`  Timestamp estimation failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  Continuing without word timings...');
    return { wordTimings: [], enrichedDocument: directionDocument };
  }
}

/**
 * Generate simple uniform word timings as a last-resort fallback
 * (used when no direction document is available)
 */
function generateSimpleWordTimings(
  script: string,
  durationSec: number,
): Array<{ word: string; startTime: number; endTime: number; confidence: number }> {
  const words = script.split(/\s+/).filter(w => w.length > 0);
  const wordDuration = durationSec / words.length;

  return words.map((word, i) => ({
    word,
    startTime: +(i * wordDuration).toFixed(4),
    endTime: +((i + 1) * wordDuration).toFixed(4),
    confidence: 0.95,
  }));
}

// ---------------------------------------------------------------------------
// Step 8: Director Agent (Scene Classification)
// ---------------------------------------------------------------------------
async function runDirectorAgent(
  scriptText: string,
  durationSec: number,
  topic: string,
): Promise<{ scenes: any[]; warnings: string[] }> {
  header('Step 8: Director Agent (Scene Classification)');

  const totalFrames = Math.ceil(durationSec * FPS);
  console.log(`  Script: ${scriptText.split(/\s+/).length} words`);
  console.log(`  Duration: ${durationSec.toFixed(1)}s (${totalFrames} frames)`);
  console.log('  Classifying scenes via Gemini...');

  try {
    const { generateSceneDirection } = await import(
      '../packages/director-agent/src/index.js'
    );

    const result = await generateSceneDirection({
      script: scriptText,
      totalDurationFrames: totalFrames,
      fps: FPS,
      metadata: { topic, title: topic },
    });

    const typeCounts: Record<string, number> = {};
    for (const scene of result.scenes) {
      typeCounts[scene.type] = (typeCounts[scene.type] ?? 0) + 1;
    }

    console.log(`  Scenes: ${result.scenes.length}`);
    console.log(`  Types: ${Object.entries(typeCounts).map(([t, n]) => `${t} x${n}`).join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.join('; ')}`);
    }

    return { scenes: result.scenes, warnings: result.warnings };
  } catch (error) {
    console.log(`  Director Agent failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  Using manual fallback scenes...');
    return { scenes: buildFallbackScenes(scriptText, totalFrames), warnings: ['director-agent-fallback'] };
  }
}

function buildFallbackScenes(script: string, totalFrames: number): any[] {
  const paragraphs = script.split(/\n\n/).filter(p => p.trim());
  const framesPerScene = Math.floor(totalFrames / (paragraphs.length + 2)); // +2 for intro/outro

  const scenes: any[] = [];
  let frame = 0;

  // Intro
  scenes.push({
    id: 'scene-0-intro',
    type: 'intro',
    startFrame: frame,
    endFrame: frame + 90,
    content: paragraphs[0]?.split('.')[0] || 'Tech Explainer',
    visualData: { episodeNumber: 1, episodeTitle: paragraphs[0]?.split('.')[0] || 'Tech Explainer' },
    transition: 'cut',
  });
  frame = 90;

  // Content scenes
  for (let i = 0; i < paragraphs.length; i++) {
    const end = Math.min(frame + framesPerScene, totalFrames - 90);
    scenes.push({
      id: `scene-${i + 1}-narration`,
      type: i === 0 ? 'text-emphasis' : 'narration-default',
      startFrame: frame,
      endFrame: end,
      content: paragraphs[i],
      visualData: i === 0
        ? { phrase: paragraphs[i].split('.')[0], highlightWords: [], style: 'slam' }
        : {},
      transition: 'fade',
    });
    frame = end;
  }

  // Outro
  scenes.push({
    id: `scene-${paragraphs.length + 1}-outro`,
    type: 'outro',
    startFrame: frame,
    endFrame: totalFrames,
    content: 'Subscribe for more',
    visualData: { nextTopicTeaser: 'More coming soon' },
    transition: 'cut',
  });

  return scenes;
}

// ---------------------------------------------------------------------------
// Step 9: Visual Enrichment
// ---------------------------------------------------------------------------
async function enrichScenes(
  scenes: any[],
  sourceUrls?: Array<{ url: string; title: string }>,
): Promise<any[]> {
  header('Step 9: Visual Enrichment');

  try {
    const { enrichScenesWithAssets } = await import(
      '../packages/visual-gen/src/asset-fetcher.js'
    );

    console.log('  Running enrichment pipeline:');
    console.log('    logos -> audio -> geo -> images -> SOURCE SCREENSHOTS -> company screenshots -> STOCK -> overlays -> annotations -> memes');

    if (sourceUrls && sourceUrls.length > 0) {
      console.log(`  Source URLs available: ${sourceUrls.length}`);
      for (const s of sourceUrls.slice(0, 5)) {
        console.log(`    - ${s.title} (${s.url})`);
      }
    }

    const enriched = await enrichScenesWithAssets(scenes, { sourceUrls });
    console.log(`  Enrichment complete: ${enriched.length} scenes`);
    return enriched;
  } catch (error) {
    console.log(`  Enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  Continuing with un-enriched scenes...');
    return scenes;
  }
}

// ---------------------------------------------------------------------------
// Step 10: Remotion Render
// ---------------------------------------------------------------------------
async function renderVideo(
  scenes: any[],
  audioUrl: string,
  totalFrames: number,
  outputPath: string,
): Promise<{ durationSec: number; fileSize: number }> {
  header('Step 10: Remotion Render');

  console.log(`  Entry point: ${VIDEO_STUDIO_ENTRY}`);
  console.log('  Bundling video studio (1-3 minutes)...');

  const bundled = await bundle({
    entryPoint: VIDEO_STUDIO_ENTRY,
    publicDir: path.resolve(PROJECT_ROOT, 'apps', 'video-studio', 'public'),
    webpackOverride: (config: any) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          '.js': ['.ts', '.tsx', '.js', '.jsx'],
          '.mjs': ['.mts', '.mjs'],
        },
        alias: {
          ...config.resolve?.alias,
          '@nexus-ai/core': false,
          '@nexus-ai/notifications': false,
          '@nexus-ai/config': false,
          '@google-cloud/firestore': false,
          '@google-cloud/storage': false,
          '@google-cloud/secret-manager': false,
          'google-gax': false,
          'gaxios': false,
          'google-auth-library': false,
          '@grpc/grpc-js': false,
          '@grpc/proto-loader': false,
          'pino': false,
          'pino-pretty': false,
          'playwright': false,
          'playwright-core': false,
          '@playwright/test': false,
        },
        fallback: {
          ...config.resolve?.fallback,
          assert: false, buffer: false, child_process: false, cluster: false,
          constants: false, crypto: false, dgram: false, dns: false,
          events: false, fs: false, http: false, http2: false, https: false,
          module: false, net: false, os: false, path: false, perf_hooks: false,
          process: false, punycode: false, querystring: false, readline: false,
          repl: false, stream: false, string_decoder: false, sys: false,
          timers: false, tls: false, tty: false, url: false, util: false,
          v8: false, vm: false, worker_threads: false, zlib: false,
        },
      },
    }),
  });

  console.log('  Bundle complete');

  const inputProps = {
    scenes,
    totalDurationFrames: totalFrames,
    audioUrl,
    // wordTimings intentionally omitted — YouTube auto-captions are sufficient
  };

  console.log('  Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'TechExplainer',
    inputProps,
  });

  console.log(`  Composition: ${composition.durationInFrames} frames, ${composition.fps}fps, ${composition.width}x${composition.height}`);
  console.log(`  Output: ${outputPath}`);
  console.log('  Rendering...');

  const renderStart = Date.now();
  let lastLoggedPct = 0;

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 30 * 60 * 1000, // 30 minutes
    onProgress: ({ progress }: { progress: number }) => {
      const pct = Math.round(progress * 100);
      if (pct >= lastLoggedPct + 10) {
        const elapsed = ((Date.now() - renderStart) / 1000).toFixed(0);
        console.log(`  Render: ${pct}% (${elapsed}s elapsed)`);
        lastLoggedPct = pct;
      }
    },
  });

  const totalElapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
  const stats = statSync(outputPath);
  const durationSec = composition.durationInFrames / composition.fps;

  console.log(`  Render complete in ${totalElapsed}s`);
  console.log(`  File size: ${formatBytes(stats.size)}`);

  return { durationSec, fileSize: stats.size };
}

// ---------------------------------------------------------------------------
// Step 11: Generate Chapters
// ---------------------------------------------------------------------------
async function generateChapters(
  scenes: any[],
  outputDir: string,
): Promise<number> {
  const chapters: Array<{ time: string; title: string }> = [];
  let chapterNumber = 0;

  for (const scene of scenes) {
    if (['intro', 'chapter-break', 'outro'].includes(scene.type)) {
      chapterNumber++;
      const timeSec = scene.startFrame / FPS;
      const mins = Math.floor(timeSec / 60);
      const secs = Math.floor(timeSec % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      let title = 'Chapter';
      if (scene.type === 'intro') title = scene.visualData?.episodeTitle || 'Introduction';
      else if (scene.type === 'chapter-break') title = scene.visualData?.title || `Chapter ${chapterNumber}`;
      else if (scene.type === 'outro') title = 'Outro';

      chapters.push({ time: timeStr, title });
    }
  }

  // chapters.txt (YouTube format)
  const chaptersTxt = chapters.map(c => `${c.time} ${c.title}`).join('\n');
  await fs.writeFile(path.join(outputDir, 'chapters.txt'), chaptersTxt);

  // chapters.json
  await fs.writeFile(
    path.join(outputDir, 'chapters.json'),
    JSON.stringify(chapters, null, 2),
  );

  // chapters.vtt (WebVTT format)
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i].time + ':00.000';
    const end = i + 1 < chapters.length
      ? chapters[i + 1].time + ':00.000'
      : '99:59:59.000';
    vtt += `${start} --> ${end}\n${chapters[i].title}\n\n`;
  }
  await fs.writeFile(path.join(outputDir, 'chapters.vtt'), vtt);

  return chapters.length;
}

// ---------------------------------------------------------------------------
// Local File Server (Remotion needs HTTP URLs for audio)
// ---------------------------------------------------------------------------
function startFileServer(
  dir: string,
): Promise<{ url: string; port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // CORS headers for Remotion's headless browser (different origin)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const urlPath = decodeURIComponent((req.url || '').replace(/^\/assets\//, ''));
      const filePath = path.join(dir, urlPath);

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const stat = statSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.wav': 'audio/wav', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
        });
        createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
        });
        createReadStream(filePath).pipe(res);
      }
    });

    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`,
        port: addr.port,
        close: () => server.close(),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Materialize data-URI images → disk files served via HTTP
// ---------------------------------------------------------------------------
async function materializeImages(
  scenes: any[],
  localStorageDir: string,
  serverUrl: string,
): Promise<number> {
  const imagesDir = path.join(localStorageDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  let count = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // backgroundImage
    if (scene.backgroundImage && scene.backgroundImage.startsWith('data:')) {
      const match = scene.backgroundImage.match(
        /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/,
      );
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `bg-${i}.${ext}`;
        await fs.writeFile(
          path.join(imagesDir, filename),
          Buffer.from(match[2], 'base64'),
        );
        scene.backgroundImage = `${serverUrl}/assets/images/${filename}`;
        count++;
      }
    }

    // screenshotImage
    if (scene.screenshotImage && scene.screenshotImage.startsWith('data:')) {
      const match = scene.screenshotImage.match(
        /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/,
      );
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `ss-${i}.${ext}`;
        await fs.writeFile(
          path.join(imagesDir, filename),
          Buffer.from(match[2], 'base64'),
        );
        scene.screenshotImage = `${serverUrl}/assets/images/${filename}`;
        count++;
      }
    }

    // gifSrc (meme-reaction scenes) — GIFs must be served via HTTP for @remotion/gif
    const vd = scene.visualData as Record<string, unknown> | undefined;
    if (vd?.gifSrc && typeof vd.gifSrc === 'string' && vd.gifSrc.startsWith('data:image/gif')) {
      const gifMatch = vd.gifSrc.match(/^data:image\/gif;base64,(.+)$/);
      if (gifMatch) {
        const filename = `meme-${i}.gif`;
        await fs.writeFile(
          path.join(imagesDir, filename),
          Buffer.from(gifMatch[1], 'base64'),
        );
        vd.gifSrc = `${serverUrl}/assets/images/${filename}`;
        count++;
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// --script flag: build synthetic ScriptGenOutput from raw narration
// ---------------------------------------------------------------------------
async function buildSyntheticScriptOutput(
  scriptText: string,
  topic: string,
): Promise<{ scriptGenOutput: any; scriptText: string; directionDocument: any }> {
  try {
    const { generateSegmentsFromNarration } = await import(
      '../packages/script-gen/src/index.js'
    );

    const wordCount = scriptText.split(/\s+/).length;
    const estimatedDurationSec = Math.ceil(wordCount / 2.5);

    const segments = generateSegmentsFromNarration(scriptText, estimatedDurationSec);

    const directionDocument = {
      version: '2.0' as const,
      metadata: {
        title: topic,
        slug: slugify(topic),
        estimatedDurationSec,
        fps: FPS,
        resolution: { width: 1920, height: 1080 },
        generatedAt: new Date().toISOString(),
      },
      segments,
      globalAudio: {
        defaultMood: 'neutral' as const,
        musicTransitions: 'crossfade' as const,
      },
    };

    // Build a synthetic V2 ScriptGenOutput
    const scriptGenOutput = {
      version: '2.0',
      script: scriptText,
      scriptText,
      wordCount,
      artifactUrl: '',
      scriptUrl: '',
      directionDocument,
      directionUrl: '',
      draftUrls: { writer: '', critic: '', optimizer: '' },
      regenerationAttempts: 0,
      providers: {
        writer: { name: 'manual', tier: 'primary' as const, attempts: 0 },
        critic: { name: 'manual', tier: 'primary' as const, attempts: 0 },
        optimizer: { name: 'manual', tier: 'primary' as const, attempts: 0 },
      },
    };

    console.log(`  Built synthetic direction document: ${segments.length} segments`);
    return { scriptGenOutput, scriptText, directionDocument };
  } catch (error) {
    console.log(`  generateSegmentsFromNarration failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  Continuing without direction document');
    return { scriptGenOutput: { script: scriptText }, scriptText, directionDocument: null };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n  Nexus AI — Local Pipeline Runner (Production Stages)');
  console.log('  ====================================================\n');

  const startTime = Date.now();
  const pipelineId = getPipelineId();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let topic = '';
  let scriptPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--script' && args[i + 1]) {
      scriptPath = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      topic = args[i];
    }
  }

  if (!topic && !scriptPath) {
    // No topic provided — news sourcing will discover one automatically
    console.log('  No topic provided — will auto-discover from trending news\n');
  }

  // Step 1: Validate
  validateEnvironment();

  process.env.LOCAL_STORAGE_PATH = path.join(PROJECT_ROOT, 'local-storage');

  // -----------------------------------------------------------------------
  // --script path: skip news-sourcing, research, script-gen
  // -----------------------------------------------------------------------
  let scriptText: string;
  let directionDocument: any = null;
  let scriptGenOutput: any = null;
  let topicData: any = null;

  if (scriptPath) {
    header('Loading Pre-Written Script');
    scriptText = await fs.readFile(scriptPath, 'utf-8');
    topic = topic || scriptText.split('\n')[0].slice(0, 60);
    console.log(`  Loaded script from: ${scriptPath}`);
    console.log(`  Words: ${scriptText.split(/\s+/).length}`);

    // Build synthetic ScriptGenOutput with direction segments
    const synth = await buildSyntheticScriptOutput(scriptText, topic);
    scriptGenOutput = synth.scriptGenOutput;
    scriptText = synth.scriptText;
    directionDocument = synth.directionDocument;

    topicData = {
      title: topic,
      url: '',
      source: 'manual',
      publishedAt: new Date().toISOString(),
      viralityScore: 0,
    };

    // Step 5: Pronunciation (still try on pre-written scripts)
    const pronResult = await runPronunciation(pipelineId, scriptGenOutput, topicData, directionDocument);
    if (pronResult.ssmlScript) {
      scriptText = pronResult.ssmlScript;
    }
  } else {
    // Full pipeline: news-sourcing → research → script-gen → pronunciation

    // Step 2: News Sourcing (discovers topic automatically)
    const selectedTopic = await runNewsSourcing(pipelineId, topic);
    topic = selectedTopic.title;

    // Step 3: Research
    const research = await runResearch(pipelineId, selectedTopic);

    // Step 4: Script Generation
    const scriptResult = await runScriptGen(pipelineId, research.researchBrief, research.topicData);
    scriptGenOutput = scriptResult.scriptGenOutput;
    scriptText = scriptResult.scriptText;
    directionDocument = scriptResult.directionDocument;
    topicData = research.topicData;

    // Step 5: Pronunciation
    const pronResult = await runPronunciation(pipelineId, scriptGenOutput, topicData, directionDocument);
    if (pronResult.ssmlScript) {
      // Use SSML script for TTS if pronunciation succeeded
      scriptText = pronResult.ssmlScript;
    }
  }

  // Setup directories (after topic is known — may have been discovered by news sourcing)
  const topicSlug = slugify(topic || path.basename(scriptPath, path.extname(scriptPath)));
  const outputDir = path.join(PROJECT_ROOT, 'output', topicSlug);
  const localStorageDir = path.join(PROJECT_ROOT, 'local-storage', topicSlug);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(localStorageDir, { recursive: true });

  // Save script locally
  await fs.writeFile(path.join(localStorageDir, 'script.txt'), scriptText);
  if (directionDocument) {
    await fs.writeFile(
      path.join(localStorageDir, 'direction-document.json'),
      JSON.stringify(directionDocument, null, 2),
    );
  }

  // Step 6: TTS Audio
  const audioPath = path.join(localStorageDir, 'audio.wav');
  const { durationSec: audioDuration, source: ttsSource } = await generateAudio(scriptText, audioPath);

  // Step 7: Timestamp Estimation
  const timestampResult = await runTimestampEstimation(directionDocument, audioDuration);
  const wordTimings = timestampResult.wordTimings.length > 0
    ? timestampResult.wordTimings
    : generateSimpleWordTimings(scriptText, audioDuration);
  if (timestampResult.enrichedDocument) {
    directionDocument = timestampResult.enrichedDocument;
  }

  // Step 8: Director Agent
  const { scenes, warnings } = await runDirectorAgent(scriptText, audioDuration, topic);

  // Save raw scenes
  const totalFrames = Math.ceil(audioDuration * FPS);
  const rawPayload = {
    version: 'v2-director',
    totalDurationFrames: totalFrames,
    scenes,
  };
  await fs.writeFile(
    path.join(localStorageDir, 'scenes-raw.json'),
    JSON.stringify(rawPayload, null, 2),
  );

  // Step 9: Visual Enrichment
  // Build source URLs array from topic data for source screenshot enrichment
  const sourceUrls: Array<{ url: string; title: string }> = [];
  if (topicData?.url && topicData.url.length > 0) {
    sourceUrls.push({ url: topicData.url, title: topicData.title || topic });
  }
  const enrichedScenes = await enrichScenes(scenes, sourceUrls);

  // Save enriched scenes
  const enrichedPayload = {
    version: 'v2-director',
    totalDurationFrames: totalFrames,
    scenes: enrichedScenes,
  };
  await fs.writeFile(
    path.join(localStorageDir, 'scenes-enriched.json'),
    JSON.stringify(enrichedPayload, null, 2),
  );

  // Step 10: Start file server, materialize images, & render
  const server = await startFileServer(localStorageDir);
  const audioUrl = `${server.url}/assets/audio.wav`;
  console.log(`\n  File server: ${server.url}`);
  console.log(`  Audio URL: ${audioUrl}`);

  // Verify audio is accessible before render
  try {
    const testRes = await fetch(audioUrl);
    if (!testRes.ok) {
      console.error(`  WARNING: Audio URL not accessible: HTTP ${testRes.status}`);
    } else {
      console.log(`  Audio verified: ${testRes.headers.get('content-length')} bytes`);
    }
  } catch (err: any) {
    console.error(`  WARNING: Audio URL unreachable: ${err.message}`);
  }

  // Materialize data-URI images → disk files served via HTTP
  const imageCount = await materializeImages(enrichedScenes, localStorageDir, server.url);
  console.log(`  Materialized ${imageCount} images to disk (HTTP URLs)`);

  const videoPath = path.join(outputDir, 'video.mp4');

  try {
    const { durationSec, fileSize } = await renderVideo(
      enrichedScenes,
      audioUrl,
      totalFrames,
      videoPath,
    );

    // Step 11: Generate chapters
    header('Step 11: Generating Chapters');
    const chapterCount = await generateChapters(enrichedScenes, outputDir);
    console.log(`  Generated ${chapterCount} chapters`);

    // Copy script to output
    await fs.writeFile(path.join(outputDir, 'script.txt'), scriptText);

    // Save research brief if available
    if (topicData) {
      await fs.writeFile(
        path.join(outputDir, 'topic.json'),
        JSON.stringify(topicData, null, 2),
      );
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const words = scriptText.split(/\s+/).length;
    const paragraphs = scriptText.split(/\n\n/).filter(p => p.trim()).length;

    const typeCounts: Record<string, number> = {};
    for (const scene of enrichedScenes) {
      typeCounts[scene.type] = (typeCounts[scene.type] ?? 0) + 1;
    }

    header('Pipeline Complete');
    console.log(`  Mode:       LOCAL (Production Stages)`);
    console.log(`  Pipeline:   ${pipelineId}`);
    console.log(`  Topic:      "${topic}"`);
    console.log(`  Script:     ${paragraphs} paragraphs, ~${words} words`);
    console.log(`  TTS:        ${ttsSource}`);
    console.log(`  Timestamps: ${wordTimings.length} word timings`);
    console.log(`  Scenes:     ${enrichedScenes.length} scenes`);
    for (const [type, count] of Object.entries(typeCounts).sort()) {
      console.log(`    - ${type} x${count}`);
    }
    console.log(`  Render:     1920x1080 @ ${FPS}fps, h264+aac`);
    console.log(`  Duration:   ${durationSec.toFixed(1)}s`);
    console.log(`  File size:  ${formatBytes(fileSize)}`);
    console.log(`  Chapters:   ${chapterCount}`);
    console.log(`  Elapsed:    ${elapsed}s`);
    console.log(`  Output:     ${videoPath}`);

    if (warnings.length > 0) {
      console.log(`  Warnings:   ${warnings.join('; ')}`);
    }

    console.log(`\n  Video ready: ${videoPath}`);
    console.log('');

  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(`\n${'='.repeat(60)}`);
  console.error('  LOCAL PIPELINE FAILED');
  console.error('='.repeat(60));
  console.error(err);
  process.exit(1);
});
