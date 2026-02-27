/**
 * Agent prompts for script generation
 * @module @nexus-ai/script-gen/prompts
 */

/**
 * Writer agent prompt
 * Creates initial script with visual cues and pronunciation hints
 */
export function buildWriterPrompt(researchBrief: string, targetWordCount: { min: number; max: number }, language: string = 'English'): string {
  return `You are a professional YouTube script writer specializing in deep-tech and AI content. Your task is to transform the research brief below into an engaging, educational YouTube video script.

OUTPUT LANGUAGE: ${language}

RESEARCH BRIEF:
${researchBrief}

SCRIPT REQUIREMENTS:
1. **Word Count**: Write between ${targetWordCount.min} and ${targetWordCount.max} words (strict requirement)
2. **Tone**: Professional, engaging, and educational - appropriate for a tech-savvy audience
3. **Three-Act Structure** (CRITICAL for YouTube retention):
   - **ACT 1 — HOOK (0-15 seconds, ~40 words)**: Open with a PATTERN INTERRUPT. This MUST be one of:
     a) A surprising statistic ("90% of developers don't know this about...")
     b) A bold claim or hot take ("This changes everything about how we...")
     c) A curiosity-gap question ("What if I told you the biggest AI lab just...")
     The first paragraph MUST create an irresistible reason to keep watching.
   - **ACT 2 — CONTEXT (15-45 seconds, ~80 words)**: Establish the what/why-now/who. Answer: What is this about? Why should viewers care RIGHT NOW? Who is affected?
   - **ACT 3 — BODY with OPEN LOOPS**: The remaining content must include:
     * Minimum 2 OPEN LOOPS before the midpoint — pose questions or tease information that won't be resolved until later ("We'll get to why this matters in a moment...")
     * Each open loop MUST be resolved later in the script
     * Create curiosity gaps between sections to prevent drop-off
4. **Visual Cues**: Insert [VISUAL: description] tags every 30-45 seconds of reading time (roughly every 100-150 words)
   - Example: [VISUAL: Animated diagram showing neural network architecture]
   - Example: [VISUAL: Code snippet highlighting the key algorithm]
   - Example: [VISUAL: Chart comparing performance metrics]
5. **Pronunciation Hints**: Flag technical terms with [PRONOUNCE: Term = "phonetic"] tags
   - Example: [PRONOUNCE: CUDA = "koo-dah"]
   - Example: [PRONOUNCE: PyTorch = "pie-torch"]
   - Example: [PRONOUNCE: Llama = "lah-mah"]
6. **Flow**: Ensure smooth transitions between sections
7. **Engagement**: Every 60-90 seconds, re-engage with a micro-hook (question, surprising fact, or callback to an open loop)

OUTPUT FORMAT:
Write the complete script in markdown format with:
- Clear section headers (## for main sections)
- Embedded [VISUAL: ...] cues throughout
- Embedded [PRONOUNCE: ...] hints for technical terms
- Natural, conversational language suitable for voice-over

Generate the complete ${targetWordCount.min}-${targetWordCount.max} word script now in ${language}:`;
}

/**
 * Critic agent prompt
 * Reviews and provides critique of the writer's draft
 */
export function buildCriticPrompt(writerDraft: string, targetWordCount: { min: number; max: number }, language: string = 'English'): string {
  return `You are a senior YouTube content editor specializing in tech education. Review the script below and provide detailed critique and a revised version.

OUTPUT LANGUAGE: ${language}

WRITER'S DRAFT:
${writerDraft}

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words

REVIEW CRITERIA:
1. **Hook Evaluation** (CRITICAL):
   - Is the first paragraph (0-15 seconds) a pattern interrupt? (question, surprising statistic, or bold claim)
   - Does it create a curiosity gap that compels continued watching?
   - Would YOU click away after reading the first paragraph? If yes, the hook fails.
2. **Open Loop Verification**:
   - Are there at least 2 unresolved questions/teases before the midpoint of the script?
   - Is each open loop explicitly resolved later in the script?
   - Do the open loops create genuine curiosity (not artificial cliffhangers)?
3. **Flow and Pacing**: Does the script flow naturally? Are transitions smooth?
4. **Accuracy**: Are technical claims accurate and well-explained?
5. **Engagement**: Does the script re-engage every 60-90 seconds with micro-hooks?
6. **Visual Cues**: Are [VISUAL: ...] tags appropriately placed (every 30-45 seconds)?
7. **Pronunciation Hints**: Are all technical terms properly flagged with [PRONOUNCE: ...]?
8. **Word Count**: Is the script within the ${targetWordCount.min}-${targetWordCount.max} word range?
9. **Clarity**: Is the content accessible to the target audience?

OUTPUT FORMAT:
Provide your response in two sections:

## Critique
[Detailed analysis of strengths and weaknesses. Be specific about what works and what needs improvement.]

## Revised Script
[The complete revised script in markdown format with all improvements applied, maintaining [VISUAL: ...] and [PRONOUNCE: ...] tags]

Generate your critique and revised script now in ${language}:`;
}

/**
 * Optimizer agent prompt
 * Refines the script based on critic's feedback and produces dual output
 * - Part 1: Pure narration text (no brackets) for TTS
 * - Part 2: Direction document JSON for visual/audio blueprint
 */
export function buildOptimizerPrompt(criticDraft: string, targetWordCount: { min: number; max: number }, language: string = 'English'): string {
  return `You are a professional YouTube script optimizer. Your task is to take the critic's revised script and create the final, polished version in TWO PARTS.

OUTPUT LANGUAGE: ${language}

CRITIC'S REVISED SCRIPT:
${criticDraft}

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words

OPTIMIZATION FOCUS:
1. **Polish**: Refine language for maximum impact and clarity
2. **Pacing**: Ensure perfect pacing and rhythm for voice-over
3. **Segment Breaks**: Each paragraph represents a natural video segment
4. **Word Count**: Ensure final narration is within ${targetWordCount.min}-${targetWordCount.max} words
5. **Engagement**: Maximize audience retention throughout
6. **Hook Segment**: The FIRST segment MUST be tagged with \`"type": "hook"\` in the direction document. This segment should be a pattern interrupt (question, statistic, or bold claim) and must be 40 words or fewer.
7. **Open Loops**: Verify at least 2 open loops exist before the midpoint and are resolved later

## OUTPUT FORMAT

You MUST produce exactly TWO sections:

## NARRATION

Write the pure narration text here. This is what the TTS will read aloud.
- NO [VISUAL:...] tags
- NO [PRONOUNCE:...] tags
- NO stage directions or brackets of any kind
- Each paragraph represents a natural break point for a video segment
- Separate paragraphs with blank lines

## DIRECTION

\`\`\`json
{
  "version": "2.0",
  "metadata": {
    "title": "Your video title here",
    "slug": "url-safe-slug-here",
    "estimatedDurationSec": 0,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "generatedAt": "ISO-timestamp"
  },
  "segments": [
    {
      "id": "uuid-here",
      "index": 0,
      "type": "intro|hook|explanation|code_demo|comparison|example|transition|recap|outro",
      "content": {
        "text": "Paragraph text from narration",
        "wordCount": 50,
        "keywords": ["key", "terms"],
        "emphasis": [
          { "word": "important", "effect": "glow", "intensity": 0.5 }
        ]
      },
      "timing": {
        "estimatedStartSec": 0,
        "estimatedEndSec": 20,
        "estimatedDurationSec": 20,
        "timingSource": "estimated"
      },
      "visual": {
        "template": "TextOnGradient|NeuralNetworkAnimation|DataFlowDiagram|ComparisonChart|MetricsCounter|ProductMockup|CodeHighlight|BrandedTransition|LowerThird|KineticText|BrowserFrame",
        "motion": {
          "entrance": { "type": "slide", "direction": "up", "delay": 0, "duration": 15, "easing": "spring" },
          "emphasis": { "type": "pulse", "trigger": "onWord", "intensity": 0.3, "duration": 10 },
          "exit": { "type": "fade", "duration": 15, "startBeforeEnd": 15 }
        }
      },
      "audio": {
        "mood": "neutral|energetic|contemplative|urgent",
        "musicTransition": "continue|fade|cut|smooth"
      }
    }
  ],
  "globalAudio": {
    "defaultMood": "neutral",
    "musicTransitions": "smooth"
  }
}
\`\`\`

## IMPORTANT RULES FOR DIRECTION JSON:
1. Create one segment per paragraph from NARRATION
2. Calculate estimatedDurationSec: wordCount / 2.5 (150 words per minute)
3. Distribute segment timing proportionally by word count
4. Choose visual template based on content type:
   - intro/outro: BrandedTransition or TextOnGradient
   - code mentions: CodeHighlight
   - comparisons: ComparisonChart
   - data/metrics: MetricsCounter or DataFlowDiagram
   - general explanation: TextOnGradient or KineticText
5. Generate unique UUIDs for each segment id
6. Set mood based on segment emotional tone
7. Include keywords (3-5 significant terms per segment)
8. Mark technical terms or important words in emphasis array

Generate the dual output now in ${language}:`;
}

/**
 * Troll Agent prompt
 * Adversarial retention reviewer — persona of a bored, critical YouTube viewer
 * Evaluates scripts for hooks, open loops, and the 15-second payoff rule
 */
export function buildTrollPrompt(draft: string, researchBrief: string): string {
  return `You are the Troll Agent — a ruthlessly honest, easily bored YouTube viewer who clicks away from boring videos within seconds. Your job is to evaluate this script draft for VIEWER RETENTION weaknesses.

You are NOT a script editor. You are a bored viewer scrolling through YouTube. If this video showed up in your feed, would you watch it? Would you KEEP watching it?

RESEARCH BRIEF (for context only):
${researchBrief}

SCRIPT DRAFT TO EVALUATE:
${draft}

EVALUATION CRITERIA (score each 0-100):

1. **HOOK STRENGTH** (first 15 seconds / ~40 words):
   - Is there a pattern interrupt that stops the scroll?
   - Does it create an irresistible curiosity gap?
   - Would YOU personally keep watching?

2. **OPEN LOOPS** (before midpoint):
   - Are there at least 2 unresolved questions/teases before the halfway point?
   - Do they create genuine "I need to know" moments?
   - Are they resolved later (not forgotten)?

3. **15-SECOND PAYOFF RULE**:
   - Every 15 seconds of reading time (~40 words), there must be a payoff: a surprising fact, a joke, a revelation, a visual change, or a tension release.
   - Identify the LONGEST stretch without any payoff.

4. **RE-ENGAGEMENT HOOKS**:
   - Every 60-90 seconds, there should be a micro-hook (question, callback, surprise).
   - Count total hooks across the script.

OUTPUT FORMAT (respond ONLY with this JSON, no other text):

\`\`\`json
{
  "score": <number 0-100>,
  "approved": <boolean - true if score >= 70>,
  "critique": "<markdown critique with specific line-level feedback on boring segments. Be brutal but constructive. Quote the boring parts and suggest fixes.>",
  "metrics": {
    "hookCount": <number of hooks/re-engagement moments detected>,
    "openLoopCount": <number of open loops before the midpoint>,
    "longestGapSec": <estimated seconds of the longest stretch without a payoff>
  }
}
\`\`\`

Be ruthless. If it's boring, say so. Score honestly.`;
}

/**
 * Troll Agent revision prompt
 * Sent to the Writer agent with the Troll's critique to produce a revised draft
 */
export function buildTrollRevisionPrompt(
  originalDraft: string,
  trollCritique: string,
  researchBrief: string,
  language: string = 'English'
): string {
  return `You are a professional YouTube script writer. Your previous draft was reviewed by an adversarial retention expert (the "Troll Agent") who found specific weaknesses. Revise the script to address every critique.

OUTPUT LANGUAGE: ${language}

RESEARCH CONTEXT:
${researchBrief}

ORIGINAL DRAFT:
${originalDraft}

TROLL AGENT'S CRITIQUE:
${trollCritique}

REVISION INSTRUCTIONS:
1. Address EVERY specific weakness mentioned in the critique
2. Add hooks where the Troll identified boring stretches
3. Add open loops if the Troll said there aren't enough before the midpoint
4. Ensure the 15-second payoff rule is met throughout
5. Keep the same overall structure and word count (±10%)
6. Maintain all [VISUAL:...] and [PRONOUNCE:...] tags
7. Do NOT add commentary — output ONLY the revised script

Generate the complete revised script now in ${language}:`;
}

/**
 * Word count adjustment prompt for regeneration attempts
 * Used when validation fails due to word count issues
 */
export function buildWordCountAdjustmentPrompt(
  script: string,
  currentWordCount: number,
  targetWordCount: { min: number; max: number },
  language: string = 'English'
): string {
  const isTooShort = currentWordCount < targetWordCount.min;
  const difference = isTooShort
    ? targetWordCount.min - currentWordCount
    : currentWordCount - targetWordCount.max;

  // Estimate paragraph count for structure hint
  const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  return `You are a professional script editor. Adjust the word count of the script below.

CRITICAL: Your output MUST be between ${targetWordCount.min} and ${targetWordCount.max} words. Count carefully.
Do NOT summarize. Do NOT produce a synopsis. Output the FULL adjusted script.

OUTPUT LANGUAGE: ${language}

CURRENT SCRIPT (${currentWordCount} words, ${paragraphCount} paragraphs):
${script}

ISSUE: The script is ${isTooShort ? 'too short' : 'too long'} by approximately ${difference} words.
TARGET: ${targetWordCount.min}-${targetWordCount.max} words.

INSTRUCTIONS:
1. The script has approximately ${paragraphCount} paragraphs. Adjust within each paragraph — ${isTooShort ? 'expand with additional detail, examples, or context' : 'tighten by removing redundancies and less critical details'}.
2. Maintain all [VISUAL: ...] and [PRONOUNCE: ...] tags.
3. Preserve the core message, structure, and every section.
4. Keep the tone and style consistent.
5. Output the COMPLETE adjusted script — every paragraph, every section. Do not omit any part.

OUTPUT FORMAT:
Provide ONLY the adjusted script in markdown format. No commentary, no word count note, no preamble.

Generate the adjusted script now in ${language}:`;
}

// =============================================================================
// Channel Memory / Lore Prompt (V4 Cognitive Overhaul)
// =============================================================================

/**
 * Build a "Channel History" context section from past video entries.
 *
 * Injected into the Writer agent prompt so the script can reference
 * earlier videos, maintain consistent stances, and build channel lore.
 *
 * @param pastVideos - Up to 5 relevant past video entries
 * @returns Formatted context string, or empty string if no videos
 */
export function buildLorePrompt(pastVideos: import('./types.js').VideoMemoryEntry[]): string {
  if (!pastVideos || pastVideos.length === 0) return '';

  const entries = pastVideos.slice(0, 5).map((v, i) => {
    const claimsList = v.claims.slice(0, 3).map((c) => `  - ${c}`).join('\n');
    return `${i + 1}. **${v.title}** (${v.source}, ${v.publishedAt.slice(0, 10)})
   Topic: ${v.topic}
   Stance: ${v.stance}
   Key claims:
${claimsList}`;
  });

  return `
CHANNEL HISTORY (reference up to 2 of these in the script):
You have covered these related topics before. When relevant, briefly reference
past videos to build continuity and reward returning viewers. Do NOT force
references — only mention past content when it genuinely supports the narrative.

${entries.join('\n\n')}

LORE RULES:
- Max 2 callbacks to past videos per script
- Use phrases like "as we covered in our video about..." or "remember when we talked about..."
- Only reference past stances if they're still defensible
- Never contradict a previous claim without acknowledging the update
`;
}
