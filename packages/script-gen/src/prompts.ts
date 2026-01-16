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
3. **Structure**: Clear introduction, main content sections, and conclusion
4. **Visual Cues**: Insert [VISUAL: description] tags every 30-45 seconds of reading time (roughly every 100-150 words)
   - Example: [VISUAL: Animated diagram showing neural network architecture]
   - Example: [VISUAL: Code snippet highlighting the key algorithm]
   - Example: [VISUAL: Chart comparing performance metrics]
5. **Pronunciation Hints**: Flag technical terms with [PRONOUNCE: Term = "phonetic"] tags
   - Example: [PRONOUNCE: CUDA = "koo-dah"]
   - Example: [PRONOUNCE: PyTorch = "pie-torch"]
   - Example: [PRONOUNCE: Llama = "lah-mah"]
6. **Flow**: Ensure smooth transitions between sections
7. **Engagement**: Hook the audience in the first 15 seconds

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
1. **Flow and Pacing**: Does the script flow naturally? Are transitions smooth?
2. **Accuracy**: Are technical claims accurate and well-explained?
3. **Engagement**: Will this hold the audience's attention? Is the hook strong?
4. **Visual Cues**: Are [VISUAL: ...] tags appropriately placed (every 30-45 seconds)?
5. **Pronunciation Hints**: Are all technical terms properly flagged with [PRONOUNCE: ...]?
6. **Word Count**: Is the script within the ${targetWordCount.min}-${targetWordCount.max} word range?
7. **Clarity**: Is the content accessible to the target audience?

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
 * Refines the script based on critic's feedback
 */
export function buildOptimizerPrompt(criticDraft: string, targetWordCount: { min: number; max: number }, language: string = 'English'): string {
  return `You are a professional YouTube script optimizer. Your task is to take the critic's revised script and create the final, polished version.

OUTPUT LANGUAGE: ${language}

CRITIC'S REVISED SCRIPT:
${criticDraft}

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} words

OPTIMIZATION FOCUS:
1. **Polish**: Refine language for maximum impact and clarity
2. **Pacing**: Ensure perfect pacing and rhythm for voice-over
3. **Visual Alignment**: Verify [VISUAL: ...] cues are optimally placed
4. **Pronunciation**: Confirm all [PRONOUNCE: ...] tags are accurate and complete
5. **Word Count**: Ensure final script is within ${targetWordCount.min}-${targetWordCount.max} words
6. **Engagement**: Maximize audience retention throughout

OUTPUT FORMAT:
Provide ONLY the final optimized script in markdown format. Do NOT include any commentary or explanation - just the polished script with all [VISUAL: ...] and [PRONOUNCE: ...] tags intact.

Generate the final optimized script now in ${language}:`;
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

  return `The script below needs word count adjustment.

OUTPUT LANGUAGE: ${language}

CURRENT SCRIPT:
${script}

ISSUE: The script is ${isTooShort ? 'too short' : 'too long'} (${currentWordCount} words, target: ${targetWordCount.min}-${targetWordCount.max} words)
ADJUSTMENT NEEDED: ${isTooShort ? `Add approximately ${difference} words` : `Remove approximately ${difference} words`}

REQUIREMENTS:
1. Maintain all [VISUAL: ...] and [PRONOUNCE: ...] tags
2. Preserve the core message and structure
3. ${isTooShort ? 'Expand content with additional insights, examples, or explanations' : 'Tighten content by removing redundancies and less critical details'}
4. Keep the tone and style consistent
5. Ensure final word count is between ${targetWordCount.min} and ${targetWordCount.max} words

OUTPUT FORMAT:
Provide ONLY the adjusted script in markdown format.

Generate the adjusted script now in ${language}:`;
}
