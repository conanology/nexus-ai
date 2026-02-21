/**
 * Concept Fallback Enricher — screenshots Wikipedia pages for key concepts
 * when no other visual source (screenshot, stock, AI) is available.
 *
 * Extracts 2-3 key concept words from scene content and captures
 * screenshots of the corresponding Wikipedia articles.
 *
 * @module @nexus-ai/visual-gen/concept-fallback-enricher
 */

import {
  captureWebsiteScreenshot,
  closeBrowser,
  screenshotToDataUri,
} from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max concept screenshots per video */
const MAX_CONCEPT_SCREENSHOTS = 15;

/** Concurrency for Playwright captures */
const CONCURRENCY = 3;

/** Scene types that should NEVER get concept screenshots */
const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'code-block',
  'meme-reaction',
  'map-animation',
]);

/** Common stopwords to skip when extracting concepts */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'it', 'its',
  'this', 'that', 'these', 'those', 'they', 'them', 'their', 'we', 'our',
  'you', 'your', 'he', 'she', 'his', 'her', 'my', 'me', 'i', 'not', 'no',
  'so', 'if', 'then', 'than', 'very', 'just', 'also', 'more', 'most',
  'much', 'many', 'some', 'any', 'all', 'each', 'every', 'both', 'few',
  'other', 'new', 'old', 'first', 'last', 'long', 'great', 'little',
  'own', 'same', 'big', 'different', 'small', 'large', 'next', 'early',
  'young', 'important', 'public', 'bad', 'good', 'right', 'best', 'well',
  'about', 'up', 'out', 'over', 'after', 'before', 'between', 'under',
  'since', 'without', 'again', 'still', 'already', 'even', 'now', 'here',
  'there', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom',
  'while', 'during', 'through', 'into', 'because', 'until', 'like', 'use',
  'used', 'using', 'make', 'makes', 'made', 'get', 'gets', 'got', 'take',
  'way', 'need', 'say', 'said', 'says', 'think', 'look', 'want', 'give',
  'going', 'know', 'come', 'see', 'time', 'year', 'people', 'thing',
  'really', 'actually', 'basically', 'literally', 'however', 'means',
]);

// ---------------------------------------------------------------------------
// Gemini concept validation
// ---------------------------------------------------------------------------

const CONCEPT_FILTER_MODEL = 'gemini-2.5-flash';

interface ConceptValidation {
  concept: string;
  isRelevant: boolean;
  bestUrl?: string | null;
}

/**
 * Use Gemini to validate whether extracted concepts are tech-relevant in context.
 * Batches all candidates into a single LLM call for efficiency.
 * Returns validated concepts with optional better URLs (GitHub, docs, etc.).
 * Gracefully falls back to accepting all concepts if Gemini is unavailable.
 */
async function filterConceptsWithGemini(
  candidatesWithContext: Array<{ concepts: string[]; content: string }>,
): Promise<Map<number, ConceptValidation[]>> {
  const apiKey = process.env.NEXUS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No API key — accept all concepts as-is
    const result = new Map<number, ConceptValidation[]>();
    candidatesWithContext.forEach((c, i) => {
      result.set(i, c.concepts.map((concept) => ({ concept, isRelevant: true })));
    });
    return result;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: CONCEPT_FILTER_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `You are a tech video content filter. For each scene below, I've extracted concept words that I plan to screenshot from Wikipedia. Determine if each concept is a SPECIFIC tech/computing term worth showing. Reject general English words, verbs, or ambiguous terms that would lead to wrong Wikipedia pages.

${candidatesWithContext.map((c, i) => `Scene ${i}: "${c.content.slice(0, 200)}"
  Concepts: ${JSON.stringify(c.concepts)}`).join('\n\n')}

For EACH scene, respond with an array of validations:
- concept: the exact concept string
- isRelevant: boolean (is this a specific, identifiable tech concept in this context?)
- bestUrl: string | null (if you know a better URL than Wikipedia — like a GitHub repo, official docs, or product page — provide it; otherwise null)

Respond as a JSON object: { "scenes": { "0": [...], "1": [...], ... } }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text) as { scenes: Record<string, ConceptValidation[]> };

    const validationMap = new Map<number, ConceptValidation[]>();
    for (const [key, validations] of Object.entries(parsed.scenes)) {
      validationMap.set(Number(key), validations);
    }

    const totalConcepts = candidatesWithContext.reduce((sum, c) => sum + c.concepts.length, 0);
    let relevantCount = 0;
    for (const validations of validationMap.values()) {
      relevantCount += validations.filter((v) => v.isRelevant).length;
    }
    console.log(`  Gemini concept filter: ${relevantCount}/${totalConcepts} concepts validated as relevant`);

    return validationMap;
  } catch (err) {
    console.log(`  Gemini concept filter failed: ${err instanceof Error ? err.message : String(err)}`);
    console.log('  Falling back to unfiltered concept extraction');
    // Fallback: accept all concepts
    const result = new Map<number, ConceptValidation[]>();
    candidatesWithContext.forEach((c, i) => {
      result.set(i, c.concepts.map((concept) => ({ concept, isRelevant: true })));
    });
    return result;
  }
}

// ---------------------------------------------------------------------------
// Tech-ambiguous words — prefer _(programming_language) / _(computing) URLs
// ---------------------------------------------------------------------------

const TECH_AMBIGUOUS_WORDS = new Set([
  'python', 'rust', 'swift', 'go', 'ruby', 'dart', 'julia', 'crystal',
  'raspberry', 'sage', 'spark', 'beam', 'flask', 'django', 'spring',
  'react', 'angular', 'vue', 'nest', 'next', 'remix', 'fresh', 'solid', 'lit',
]);

// ---------------------------------------------------------------------------
// Concept extraction
// ---------------------------------------------------------------------------

/**
 * Extract key concepts from scene content.
 *
 * Priority order:
 * 1. Multi-word proper nouns ("Raspberry Pi", "Hugging Face")
 * 2. CamelCase compounds ("OpenAI", "TensorFlow")
 * 3. Tech acronyms ("GGML", "LLM", "GPU")
 * 4. Single capitalized words (fallback)
 */
function extractConcepts(content: string): string[] {
  const seen = new Set<string>();
  const concepts: string[] = [];

  function add(concept: string): boolean {
    const key = concept.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key.length < 2 || seen.has(key) || STOPWORDS.has(key)) return false;
    seen.add(key);
    concepts.push(concept.trim());
    return concepts.length >= 3;
  }

  // 1. Multi-word proper nouns (consecutive capitalized words)
  const bigramRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]*)+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = bigramRegex.exec(content)) !== null) {
    if (add(match[1])) return concepts;
  }

  // 2. CamelCase compound words ("OpenAI", "TensorFlow", "PyTorch")
  const camelRegex = /\b([A-Z][a-z]+[A-Z][a-zA-Z]+)\b/g;
  while ((match = camelRegex.exec(content)) !== null) {
    if (add(match[1])) return concepts;
  }

  // 3. Tech acronyms (2-6 uppercase letters)
  const acronymRegex = /\b([A-Z]{2,6})\b/g;
  while ((match = acronymRegex.exec(content)) !== null) {
    if (add(match[1])) return concepts;
  }

  // 4. Single capitalized words (fallback — only if nothing better found)
  if (concepts.length === 0) {
    const words = content.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9-]/g, ''));
    const capitalized = words.filter(
      (w) => w.length >= 4 && /^[A-Z]/.test(w) && !STOPWORDS.has(w.toLowerCase()),
    );
    const significant = words.filter(
      (w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()),
    );
    for (const w of [...capitalized, ...significant]) {
      if (add(w)) return concepts;
    }
  }

  return concepts;
}

/**
 * Build Wikipedia URL candidates for a concept.
 * Returns multiple variants — the caller tries them in order until one works.
 *
 * For tech-ambiguous words (python, rust, etc.), tries the computing/programming
 * language variant FIRST to avoid getting fruit/material/snake pages.
 */
function buildWikipediaUrls(concepts: string[]): string[] {
  const title = concepts[0].replace(/\s+/g, '_');
  const encoded = encodeURIComponent(title);
  const bare = `https://en.wikipedia.org/wiki/${encoded}`;
  const computing = `https://en.wikipedia.org/wiki/${encoded}_(computing)`;
  const software = `https://en.wikipedia.org/wiki/${encoded}_(software)`;
  const progLang = `https://en.wikipedia.org/wiki/${encoded}_(programming_language)`;

  if (TECH_AMBIGUOUS_WORDS.has(title.toLowerCase())) {
    return [progLang, computing, software, bare];
  }

  return [bare, computing, software];
}

// ---------------------------------------------------------------------------
// enrichScenesWithConceptFallback
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with Wikipedia screenshots for key concepts.
 *
 * Only targets scenes that have NO visual after all other enrichers have run
 * (no screenshotImage, no backgroundImage). Captures Wikipedia articles
 * as a last-resort visual before falling back to gradient-only.
 *
 * @param scenes - Scene array to enrich (mutated in place)
 */
export async function enrichScenesWithConceptFallback(
  scenes: Scene[],
): Promise<void> {
  // Phase 1: Extract concepts from eligible scenes
  const rawCandidates: Array<{ index: number; concepts: string[]; content: string }> = [];
  const usedConcepts = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip excluded types
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    // Only target scenes with NO visual at all
    if (scene.screenshotImage || scene.backgroundImage) continue;

    const concepts = extractConcepts(scene.content);
    if (concepts.length === 0) continue;

    const conceptKey = concepts[0].toLowerCase();
    if (usedConcepts.has(conceptKey)) continue;
    usedConcepts.add(conceptKey);

    rawCandidates.push({ index: i, concepts, content: scene.content });

    if (rawCandidates.length >= MAX_CONCEPT_SCREENSHOTS) break;
  }

  if (rawCandidates.length === 0) {
    console.log('Concept fallback enrichment: no eligible scenes without visuals');
    return;
  }

  // Phase 2: Gemini pre-filter — validate concepts in context, get better URLs
  const validationMap = await filterConceptsWithGemini(
    rawCandidates.map((c) => ({ concepts: c.concepts, content: c.content })),
  );

  // Phase 3: Build final candidate list with validated concepts and URLs
  const candidates: Array<{ index: number; concepts: string[]; urls: string[] }> = [];

  for (let ci = 0; ci < rawCandidates.length; ci++) {
    const raw = rawCandidates[ci];
    const validations = validationMap.get(ci);

    if (!validations) {
      // No validation result — use original concepts
      candidates.push({ index: raw.index, concepts: raw.concepts, urls: buildWikipediaUrls(raw.concepts) });
      continue;
    }

    // Find the first relevant concept
    const relevant = validations.find((v) => v.isRelevant);
    if (!relevant) {
      // Gemini says none of the concepts are tech-relevant — skip this scene
      continue;
    }

    // Build URL list: bestUrl first (if Gemini provided one), then Wikipedia fallbacks
    const conceptForUrls = [relevant.concept];
    const urls: string[] = [];
    if (relevant.bestUrl) {
      urls.push(relevant.bestUrl);
    }
    urls.push(...buildWikipediaUrls(conceptForUrls));

    candidates.push({ index: raw.index, concepts: conceptForUrls, urls });
  }

  if (candidates.length === 0) {
    console.log('Concept fallback enrichment: all concepts filtered out by Gemini');
    return;
  }

  console.log(
    `Concept fallback enrichment: capturing ${candidates.length} screenshots (${rawCandidates.length - candidates.length} concepts filtered out)`,
  );

  let successCount = 0;

  try {
    for (let batchStart = 0; batchStart < candidates.length; batchStart += CONCURRENCY) {
      const batch = candidates.slice(batchStart, batchStart + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async ({ index, concepts, urls }) => {
          // Try each URL variant until one succeeds (non-null)
          for (const url of urls) {
            console.log(`  Capturing: ${concepts.join(', ')} → ${url}`);

            const buffer = await captureWebsiteScreenshot(url, {
              darkMode: true,
              waitMs: 3000,
              width: 1920,
              height: 1080,
            });

            if (buffer) return { index, buffer };
          }
          return { index, buffer: null };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.buffer) {
          const { index, buffer } = result.value;
          const dataUri = screenshotToDataUri(buffer);
          const scene = scenes[index];

          scene.screenshotImage = dataUri;
          scene.visualSource = 'content-screenshot';
          scene.screenshotDisplayMode = 'background';

          successCount++;
        } else if (result.status === 'rejected') {
          console.log(`  ERROR: ${result.reason}`);
        }
      }
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `Concept fallback enrichment: ${successCount}/${candidates.length} screenshots captured`,
  );
}
