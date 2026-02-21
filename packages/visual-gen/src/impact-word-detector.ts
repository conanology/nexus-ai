/**
 * Impact Word Detector — uses Gemini to identify high-impact words in the
 * narration script for visual/audio punctuation in the final render.
 *
 * Detected impact words trigger a brief white flash overlay and optional
 * screen shake in the Remotion composition, adding physical "weight" to
 * dramatic stats, key conclusions, and surprising reveals.
 *
 * @module @nexus-ai/visual-gen/impact-word-detector
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gemini-2.5-flash';
const TEMPERATURE = 0.1; // Low — we want precise, consistent picks
const MAX_OUTPUT_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImpactWord {
  word: string;
  sceneId: string;
  /** Frame offset from scene.startFrame where the word is spoken */
  frameOffset: number;
  intensity: 'low' | 'medium' | 'high';
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

interface DetectedWord {
  word: string;
  intensity: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// JSON repair (minimal)
// ---------------------------------------------------------------------------

function repairJson(text: string): string {
  let cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const opens = (cleaned.match(/\[/g) ?? []).length;
    const closes = (cleaned.match(/\]/g) ?? []).length;
    if (opens > closes) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        cleaned = cleaned.slice(0, lastBrace + 1) + ']';
      }
    }
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// detectImpactWords
// ---------------------------------------------------------------------------

/**
 * Analyze the full script to identify 8-12 high-impact words that deserve
 * visual emphasis (flash/shake) during rendering.
 *
 * Maps detected words to scene positions using word timings from STT/estimation.
 *
 * @param scenes - Scene array (read-only — not mutated)
 * @param wordTimings - Word-level timing data from timestamp extraction
 * @param fps - Frames per second (30 for standard video)
 * @returns Array of impact word positions, empty if Gemini unavailable
 */
export async function detectImpactWords(
  scenes: Scene[],
  wordTimings: WordTiming[],
  fps: number,
): Promise<ImpactWord[]> {
  const apiKey = process.env.NEXUS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey || wordTimings.length === 0) return [];

  const fullScript = scenes
    .filter((s) => s.type !== 'intro' && s.type !== 'outro')
    .map((s) => s.content)
    .join(' ');

  if (fullScript.length < 100) return [];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Identify the 8-12 most impactful words in this tech narration script. These are words that deserve a brief visual flash or camera shake — dramatic stats, key conclusions, surprising reveals, punchlines, or emotional peaks.

Script:
"${fullScript.slice(0, 3000)}"

Rules:
- Pick SINGLE words, not phrases
- Prefer nouns and adjectives over verbs
- "high" intensity = major reveal or shocking stat (max 3)
- "medium" intensity = important conclusion or transition (4-6)
- "low" intensity = minor emphasis (2-4)

Respond as JSON array: [{ "word": "...", "intensity": "low" | "medium" | "high" }]`;

    const result = await model.generateContent(prompt);
    const text = repairJson(result.response.text());
    const detected = JSON.parse(text) as DetectedWord[];

    // Map detected words to scene positions using wordTimings
    const impactWords: ImpactWord[] = [];

    for (const d of detected) {
      // Find this word in wordTimings (case-insensitive, strip punctuation)
      const targetWord = d.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      const timing = wordTimings.find(
        (wt) => wt.word.toLowerCase().replace(/[^a-z0-9]/g, '') === targetWord,
      );
      if (!timing) continue;

      const wordFrame = Math.round(timing.startTime * fps);

      // Find which scene this frame belongs to
      const scene = scenes.find(
        (s) => wordFrame >= s.startFrame && wordFrame < s.endFrame,
      );
      if (!scene) continue;

      impactWords.push({
        word: d.word,
        sceneId: scene.id,
        frameOffset: wordFrame - scene.startFrame,
        intensity: d.intensity,
      });
    }

    console.log(
      `Impact word detection: ${impactWords.length} words mapped to scenes (${detected.length} detected by Gemini)`,
    );

    return impactWords;
  } catch (err) {
    console.log(
      `Impact word detection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
