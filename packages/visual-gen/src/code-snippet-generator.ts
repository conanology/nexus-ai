/**
 * Code Snippet Generator — uses Gemini to generate satirical/funny code snippets
 * for narration-default scenes that mention tech concepts without existing visuals.
 *
 * Converts eligible narration-default scenes to code-block scenes with
 * AI-generated 4-6 line satirical code (Fireship-style humor).
 *
 * @module @nexus-ai/visual-gen/code-snippet-generator
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gemini-2.5-flash';
const TEMPERATURE = 0.7; // Higher for creative/funny output
const MAX_OUTPUT_TOKENS = 4096;

/** Max code-block conversions per video — don't overdo it */
const MAX_SNIPPETS = 3;

/** Keywords that suggest a scene could benefit from a code visualization */
const CODE_TRIGGER_KEYWORDS = new Set([
  'function', 'algorithm', 'code', 'implementation', 'library',
  'framework', 'api', 'sdk', 'module', 'package', 'method',
  'class', 'interface', 'deploy', 'pipeline', 'docker',
  'kubernetes', 'terraform', 'config', 'script', 'compiler',
  'runtime', 'dependency', 'refactor', 'debug', 'import',
  'endpoint', 'middleware', 'hook', 'component', 'render',
  'server', 'client', 'database', 'query', 'schema',
  'model', 'training', 'inference', 'token', 'embedding',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnippetResult {
  code: string;
  language: string;
  filename: string;
  highlightLines: number[];
}

// ---------------------------------------------------------------------------
// JSON repair (minimal — same pattern as scene-classifier)
// ---------------------------------------------------------------------------

function repairJson(text: string): string {
  // Strip markdown code fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();

  // Try direct parse first
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Attempt to close unclosed brackets
    const opens = (cleaned.match(/\[/g) ?? []).length;
    const closes = (cleaned.match(/\]/g) ?? []).length;
    if (opens > closes) {
      // Find last complete object and close
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        cleaned = cleaned.slice(0, lastBrace + 1) + ']';
      }
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// enrichScenesWithCodeSnippets
// ---------------------------------------------------------------------------

/**
 * Scan narration-default scenes for code-related keywords and convert
 * eligible ones to code-block scenes with Gemini-generated satirical snippets.
 *
 * Only targets scenes that:
 * 1. Are type 'narration-default'
 * 2. Have no existing visual (no screenshotImage, no backgroundImage)
 * 3. Mention code-related tech keywords
 *
 * @param scenes - Scene array (mutated in place)
 */
export async function enrichScenesWithCodeSnippets(
  scenes: Scene[],
): Promise<void> {
  const apiKey = process.env.NEXUS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  // Find eligible scenes
  const candidates: Array<{ index: number; content: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.type !== 'narration-default') continue;
    if (s.screenshotImage || s.backgroundImage) continue;

    const words = s.content.toLowerCase().split(/\s+/);
    const hasCodeKeyword = words.some((w) =>
      CODE_TRIGGER_KEYWORDS.has(w.replace(/[^a-z]/g, '')),
    );
    if (!hasCodeKeyword) continue;

    candidates.push({ index: i, content: s.content });
    if (candidates.length >= MAX_SNIPPETS) break;
  }

  if (candidates.length === 0) return;

  console.log(
    `Code snippet generation: ${candidates.length} candidate scenes found`,
  );

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

    const prompt = `You generate short, FUNNY code snippets for a tech YouTube video (Fireship style). Each snippet should be 4-6 lines of real, syntactically valid code but with humorous variable names, satirical comments, or absurd logic that relates to the topic.

Examples of the tone:
- if (ai.mood === "sassy") { deleteRepo(); }
- const productivity = mass * acceleration_of_meetings;
- while (!weekend) { pretendToWork(); }

For each narration segment below, generate ONE code snippet:

${candidates.map((c, i) => `${i}. "${c.content.slice(0, 300)}"`).join('\n\n')}

Respond as a JSON array. Each entry: { "code": "...", "language": "typescript", "filename": "...", "highlightLines": [line_numbers_to_emphasize] }
Use language "typescript" unless the topic clearly fits another language (python, rust, go, etc).
Filenames should be funny/relevant (e.g., "deploy-or-die.ts", "ai-overlord.py").`;

    const result = await model.generateContent(prompt);
    const text = repairJson(result.response.text());
    const snippets = JSON.parse(text) as SnippetResult[];

    let converted = 0;
    for (let i = 0; i < Math.min(snippets.length, candidates.length); i++) {
      const { index } = candidates[i];
      const snippet = snippets[i];
      if (!snippet?.code) continue;

      const scene = scenes[index];

      // Convert narration-default → code-block
      scene.type = 'code-block' as Scene['type'];
      scene.visualData = {
        code: snippet.code,
        language: snippet.language || 'typescript',
        filename: snippet.filename || 'snippet.ts',
        highlightLines: snippet.highlightLines || [],
      };
      scene.transition = 'slide-left';
      converted++;
    }

    console.log(
      `Code snippet generation: converted ${converted} scenes to code-block`,
    );
  } catch (err) {
    console.log(
      `Code snippet generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    // Non-fatal — scenes remain as narration-default
  }
}
