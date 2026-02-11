/**
 * Image Prompt Engine — sophisticated prompt engineering for cinematic AI images.
 *
 * Produces consistently stunning, cohesive visuals by combining a master style
 * guide, concept-to-visual-metaphor mapping, scene-type-specific direction,
 * mood modifiers, and visual continuity references.
 *
 * @module @nexus-ai/asset-library/image-gen/prompt-engine
 */

// ---------------------------------------------------------------------------
// 1. Master Style Guide
// ---------------------------------------------------------------------------

export const IMAGE_STYLE_GUIDE = `VISUAL STYLE REQUIREMENTS — STRICT:

Art direction: Hyper-modern digital concept art. Think: Blade Runner meets Bloomberg Terminal meets Apple keynote.
Color palette: MUST use deep navy/midnight backgrounds (#0a0e1a to #111827). Primary accent: electric cyan (#00d4ff). Secondary accent: soft violet (#8b5cf6). Warm accents sparingly: amber (#f59e0b) for warnings/old things, emerald (#10b981) for positive/new things.
Lighting: Cinematic volumetric lighting. Rim lighting on subjects in cyan or violet. Subtle lens flare or bloom on light sources. Light always feels like it's coming from screens or holographic displays.
Composition: Rule of thirds. Strong foreground/midground/background separation. Depth of field — sharp subject, soft background. Leave visual breathing room (don't overcrowd the frame).
Texture: Subtle noise grain overlay feel. Matte surfaces, not glossy. Metal and glass materials when showing objects.
Mood: Authoritative, forward-looking, slightly ominous but ultimately optimistic. Like a documentary about the future.
ABSOLUTELY NO: Text, words, letters, numbers, watermarks, signatures, UI elements with readable text, or any written language in the image. The image must be purely visual.
ABSOLUTELY NO: Cartoon style, clip art, flat design, stock photo look, overly saturated colors, white backgrounds, or bright/cheerful aesthetics.
Aspect ratio: 16:9 landscape (1920x1080 framing).
Quality: Photorealistic rendering quality with stylized art direction. Sharp details, no artifacts, no deformation.`;

// ---------------------------------------------------------------------------
// 2. Concept → Visual Language
// ---------------------------------------------------------------------------

export const SCENE_VISUAL_LANGUAGE: Record<string, string> = {
  scale_and_numbers:
    'Vast cityscapes, towering data structures, infinite corridors of server racks, birds-eye views of massive networks, particle clouds forming shapes',
  disruption_and_change:
    'Shattering glass, tectonic plates shifting, old structures crumbling while new ones emerge from light, phoenix imagery, metamorphosis',
  ai_and_automation:
    'Humanoid robots in sleek environments, neural network visualizations as glowing 3D structures, autonomous machines in sterile facilities, holographic AI interfaces',
  business_and_saas:
    'Futuristic corporate environments, holographic dashboards floating in dark rooms, abstract representations of subscriptions (streams of light flowing to users), office spaces transforming',
  competition_and_comparison:
    'Split environments (warm/analog left, cool/digital right), ancient vs futuristic architecture side by side, evolution sequences, before/after transformations',
  people_and_workforce:
    'Silhouettes of workers in vast spaces, crowds viewed from above transitioning to empty automated spaces, human hands reaching toward robotic hands',
  technology_and_infrastructure:
    'Circuit board landscapes, fiber optic highways, quantum computing cores glowing, satellite views of connected networks, holographic server rooms',
  money_and_economics:
    'Abstract flowing currency streams, golden/amber elements dissolving into digital cyan, market visualization as 3D terrain, treasure vaults opening to reveal data',
  time_and_history:
    'Clock mechanisms dissolving, timeline corridors, archaeological layers revealing technology at each level, aged/weathered objects next to pristine future tech',
  quotes_and_philosophy:
    'Contemplative spaces — vast empty rooms with single sources of light, horizons at dusk/dawn, lone figures in expansive landscapes, cathedral-like tech spaces',
};

// ---------------------------------------------------------------------------
// 3. Concept Keyword Mapping
// ---------------------------------------------------------------------------

const CONCEPT_KEYWORDS: Record<string, RegExp[]> = {
  scale_and_numbers: [
    /\b\d{3,}\b/,
    /million/i,
    /billion/i,
    /trillion/i,
    /percent/i,
    /\breplace[ds]?\b/i,
    /\bscale[ds]?\b/i,
    /\bmassive\b/i,
    /\bhuge\b/i,
    /\bvast\b/i,
  ],
  disruption_and_change: [
    /disrupt/i,
    /\bchange[ds]?\b/i,
    /\bshift/i,
    /transform/i,
    /revolution/i,
    /end of/i,
    /\bshatter/i,
    /\boverhaul/i,
    /upheaval/i,
  ],
  ai_and_automation: [
    /\bAI\b/,
    /\bagent[s]?\b/i,
    /automat/i,
    /machine/i,
    /robot/i,
    /\bmodel[s]?\b/i,
    /neural/i,
    /deep learning/i,
    /artificial intelligence/i,
  ],
  business_and_saas: [
    /SaaS/i,
    /subscription/i,
    /software/i,
    /platform/i,
    /\bcloud\b/i,
    /\bservice[s]?\b/i,
    /\bstartup/i,
    /enterprise/i,
    /\bB2B\b/i,
  ],
  competition_and_comparison: [
    /\bvs\b/i,
    /versus/i,
    /compared/i,
    /traditional/i,
    /\bold\b/i,
    /\bnew\b/i,
    /legacy/i,
    /modern/i,
    /better than/i,
  ],
  people_and_workforce: [
    /\bteam[s]?\b/i,
    /employee/i,
    /worker/i,
    /\bpeople\b/i,
    /\bhire[ds]?\b/i,
    /replace[ds]?\b/i,
    /workforce/i,
    /\bjob[s]?\b/i,
    /labor/i,
    /staff/i,
  ],
  technology_and_infrastructure: [
    /infrastructure/i,
    /server/i,
    /\bdata\b/i,
    /compute/i,
    /network/i,
    /hardware/i,
    /system/i,
    /architect/i,
  ],
  money_and_economics: [
    /price/i,
    /\bcost[s]?\b/i,
    /revenue/i,
    /\bmoney\b/i,
    /billion/i,
    /funding/i,
    /valuation/i,
    /\$\d/,
    /invest/i,
    /profit/i,
  ],
  time_and_history: [
    /\byear[s]?\b/i,
    /decade/i,
    /history/i,
    /\bsince\b/i,
    /\bera\b/i,
    /century/i,
    /\b(19|20)\d{2}\b/,
    /timeline/i,
    /evolution/i,
  ],
  quotes_and_philosophy: [
    /\bsaid\b/i,
    /\bquote[ds]?\b/i,
    /imagine/i,
    /think about/i,
    /consider/i,
    /\bwisdom\b/i,
    /philosopher/i,
    /\bvision\b/i,
  ],
};

// ---------------------------------------------------------------------------
// 4. classifySceneConcept
// ---------------------------------------------------------------------------

/**
 * Analyze scene text and return 1-3 matching concept keys from SCENE_VISUAL_LANGUAGE.
 * Ranked by keyword match count. Defaults to ['technology_and_infrastructure'].
 */
export function classifySceneConcept(text: string): string[] {
  const scores: Array<{ concept: string; count: number }> = [];

  for (const [concept, patterns] of Object.entries(CONCEPT_KEYWORDS)) {
    let count = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) count++;
    }
    if (count > 0) {
      scores.push({ concept, count });
    }
  }

  if (scores.length === 0) {
    return ['technology_and_infrastructure'];
  }

  scores.sort((a, b) => b.count - a.count);
  return scores.slice(0, 3).map((s) => s.concept);
}

// ---------------------------------------------------------------------------
// 5. determineMood
// ---------------------------------------------------------------------------

export type Mood = 'dramatic' | 'contemplative' | 'energetic' | 'neutral';

/**
 * Determine the visual mood based on scene type and text content.
 */
export function determineMood(sceneType: string, text: string): Mood {
  // Scene-type overrides
  if (sceneType === 'stat-callout' || sceneType === 'chapter-break') {
    return 'dramatic';
  }
  if (sceneType === 'quote') {
    return 'contemplative';
  }
  if (sceneType === 'comparison' || sceneType === 'list-reveal') {
    return 'energetic';
  }

  // Text-content overrides
  const lowerText = text.toLowerCase();
  if (/staggering|massive|unprecedented|shocking|incredible/.test(lowerText)) {
    return 'dramatic';
  }
  if (/imagine|think about|consider|future|ponder|reflect/.test(lowerText)) {
    return 'contemplative';
  }
  if (/versus|battle|race|compete|rapidly|explosive|surge/.test(lowerText)) {
    return 'energetic';
  }

  return 'neutral';
}

// ---------------------------------------------------------------------------
// 6. Scene-Type-Specific Direction
// ---------------------------------------------------------------------------

const SCENE_TYPE_DIRECTIONS: Record<string, string> = {
  'stat-callout':
    'This is a DRAMATIC MOMENT. The image should convey SCALE and IMPACT. Go bold — this is the visual equivalent of a drumbeat. Use extreme perspective (looking up at something massive, or looking down from great height). The image should make the viewer feel the weight of the number being presented.',
  'text-emphasis':
    'This is a KEY STATEMENT moment. The image should be ATMOSPHERIC and create GRAVITAS behind the text. Keep the center relatively simple/dark (text will overlay there). Push visual interest to the edges and corners. Think cinematic establishing shot.',
  'full-screen-text':
    'The viewer will read a full sentence over this image. The image needs to be MOODY and EVOCATIVE but not distracting. Dark enough in the center for white text to be perfectly readable. Think: out-of-focus background in a movie dialogue scene.',
  comparison:
    'This is a SPLIT CONCEPT. The image should have a natural left/right division. Left side: warmer, older, more analog feeling. Right side: cooler, futuristic, more digital. A clear visual boundary between the two halves.',
  'narration-default':
    'This is a BREATHING MOMENT between key scenes. The image should be subtle, atmospheric, almost abstract. Think: ambient texture rather than a specific subject. Soft focus, gentle movement implied, meditative.',
  'chapter-break':
    'This is a TRANSITION moment. The image should be BOLD and WIDE — like a movie chapter card. Strong horizontal composition, dramatic lighting, minimal subject matter, maximum atmosphere. Think: IMAX establishing shot.',
  timeline:
    'This shows a CHRONOLOGICAL PROGRESSION. The image should convey PASSAGE OF TIME or EVOLUTION. Left-to-right visual flow. Perhaps: old/analog elements on the left transitioning to futuristic/digital on the right.',
  quote:
    'This accompanies a NOTABLE QUOTE. The image should be CONTEMPLATIVE and ELEGANT. A single powerful subject or an expansive quiet landscape. Think: the visual equivalent of a thoughtful pause.',
  'list-reveal':
    'This scene lists MULTIPLE ITEMS. The image should suggest VARIETY and ORGANIZATION without being specific. Abstract patterns, grid-like structures, or multiple distinct elements arranged harmoniously.',
  diagram:
    'This is a TECHNICAL EXPLANATION. The image should feel PRECISE and STRUCTURED. Blueprint aesthetics, schematic patterns, or architectural visualization. Clean lines, geometric order.',
};

const MOOD_MODIFIERS: Record<Mood, string> = {
  dramatic:
    'Push the contrast. Deep blacks, bright highlights. Dramatic shadows. This moment should feel IMPORTANT.',
  contemplative:
    'Softer lighting. More space. Let the image breathe. Quiet power rather than loud energy.',
  energetic:
    'Dynamic composition. Diagonal lines. Sense of motion and speed. Things happening.',
  neutral:
    'Balanced. Neither dramatic nor quiet. Professional and polished.',
};

// ---------------------------------------------------------------------------
// 7. ImagePromptParams & buildMasterPrompt
// ---------------------------------------------------------------------------

export interface ImagePromptParams {
  sceneType: string;
  sceneText: string;
  topic: string;
  mood: Mood;
  concepts: string[];
  previousImagePrompt?: string;
}

/**
 * Build the final master prompt that drives Gemini image generation.
 */
export function buildMasterPrompt(params: ImagePromptParams): string {
  const { sceneType, sceneText, topic, mood, concepts, previousImagePrompt } = params;

  const parts: string[] = [];

  // NO-TEXT PREAMBLE — must be the very first instruction
  parts.push(
    '[CRITICAL CONSTRAINT — READ FIRST]\nThis image must contain ABSOLUTELY ZERO text, numbers, letters, words, labels, captions, watermarks, statistics, brand names, or ANY form of written language. If the image contains any readable characters at all, it is REJECTED. The image must be PURELY VISUAL — only shapes, colors, objects, lighting, and scenes. No text. No numbers. No letters. None.',
  );

  // ROLE
  parts.push(
    '[ROLE]\nYou are a cinematic concept artist creating a single background illustration for a high-end tech documentary video.',
  );

  // SCENE CONTEXT
  parts.push(
    `[SCENE CONTEXT]\nThis image will appear behind text overlays in a video about: ${topic}\nThe narrator is currently discussing: ${sceneText}\nScene mood: ${mood}\nCRITICAL: The scene description above is for THEMATIC CONTEXT ONLY. Do NOT render any words, numbers, labels, statistics, brand names, or readable text in the image. The image must contain ZERO readable text or numbers of any kind.`,
  );

  // VISUAL DIRECTION
  const visualLines: string[] = [];
  if (concepts[0] && SCENE_VISUAL_LANGUAGE[concepts[0]]) {
    visualLines.push(`Primary visual concept: ${SCENE_VISUAL_LANGUAGE[concepts[0]]}`);
  }
  if (concepts[1] && SCENE_VISUAL_LANGUAGE[concepts[1]]) {
    visualLines.push(`Secondary visual element: ${SCENE_VISUAL_LANGUAGE[concepts[1]]}`);
  }
  if (concepts[2] && SCENE_VISUAL_LANGUAGE[concepts[2]]) {
    visualLines.push(`Subtle background detail: ${SCENE_VISUAL_LANGUAGE[concepts[2]]}`);
  }
  if (visualLines.length > 0) {
    parts.push(`[VISUAL DIRECTION]\n${visualLines.join('\n')}`);
  }

  // SCENE-SPECIFIC DIRECTION
  const sceneDir = SCENE_TYPE_DIRECTIONS[sceneType];
  const moodMod = MOOD_MODIFIERS[mood];
  if (sceneDir) {
    parts.push(`[SCENE-SPECIFIC DIRECTION]\n${sceneDir}\n${moodMod}`);
  } else {
    parts.push(`[SCENE-SPECIFIC DIRECTION]\n${moodMod}`);
  }

  // CONTINUITY
  if (previousImagePrompt) {
    parts.push(
      `[CONTINUITY]\nThe previous scene's image showed: ${previousImagePrompt}. This image should feel like a natural visual progression — same world, different perspective.`,
    );
  }

  // STYLE GUIDE
  parts.push(`[STYLE GUIDE]\n${IMAGE_STYLE_GUIDE}`);

  // FINAL INSTRUCTION — repeat no-text constraint
  parts.push('[FINAL INSTRUCTION]\nREMINDER: The image must contain ZERO readable text, numbers, letters, or words of any kind. Pure visual art only. No exceptions.\n\nGenerate a single stunning image.');

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// 8. buildPromptForScene
// ---------------------------------------------------------------------------

/** Scene types that should NOT receive generated background images */
const EXCLUDED_SCENE_TYPES = new Set<string>([
  'intro',
  'outro',
  'logo-showcase',
  'code-block',
  'map-animation',
]);

interface SceneLike {
  type: string;
  content: string;
  visualData: Record<string, unknown>;
}

/**
 * Strip numbers, brand names, and literal content from text, returning
 * only thematic/mood descriptors suitable for image generation.
 *
 * The goal is to give Gemini *visual scene descriptions* rather than raw
 * text content that it might try to render as letters/numbers in the image.
 */
function extractSceneText(scene: SceneLike): string {
  const vd = scene.visualData;

  switch (scene.type) {
    case 'stat-callout': {
      // Instead of "4 decades" → a thematic description of the stat
      const label = (vd.label as string) ?? '';
      return describeStatTheme(label, scene.content);
    }

    case 'text-emphasis':
      // Instead of the literal phrase → a mood description
      return describeTextTheme((vd.phrase as string) ?? scene.content);

    case 'full-screen-text':
      return describeTextTheme((vd.text as string) ?? scene.content);

    case 'comparison': {
      // Instead of "GCC vs CCC" → a conceptual description
      const left = vd.left as { title?: string } | undefined;
      const right = vd.right as { title?: string } | undefined;
      return describeComparisonTheme(left?.title, right?.title, scene.content);
    }

    case 'chapter-break':
      return describeTextTheme((vd.title as string) ?? scene.content);

    case 'timeline': {
      const events = vd.events as Array<{ description?: string; label?: string }> | undefined;
      if (events && events.length > 0) {
        const themes = events
          .slice(0, 3)
          .map((e) => stripLiterals(e.description ?? e.label ?? ''))
          .filter(Boolean);
        return themes.length > 0
          ? `a timeline showing progression through ${themes.join(', ')}`
          : 'a timeline showing technological evolution and progression';
      }
      return describeTextTheme(scene.content);
    }

    case 'quote':
      return describeTextTheme((vd.text as string) ?? scene.content);

    case 'list-reveal': {
      const title = (vd.title as string) ?? '';
      return describeTextTheme(title || scene.content);
    }

    case 'diagram': {
      const nodes = vd.nodes as Array<{ label?: string }> | undefined;
      if (nodes && nodes.length > 0) {
        const themes = nodes
          .slice(0, 3)
          .map((n) => stripLiterals(n.label ?? ''))
          .filter(Boolean);
        return themes.length > 0
          ? `a technical diagram connecting ${themes.join(', ')}`
          : 'a technical diagram showing system architecture';
      }
      return describeTextTheme(scene.content);
    }

    case 'narration-default':
      return describeTextTheme(scene.content);

    default:
      return describeTextTheme(scene.content);
  }
}

// ---------------------------------------------------------------------------
// Text-to-theme helpers (prevent literal text from reaching the image model)
// ---------------------------------------------------------------------------

/** Remove numbers, percentages, dollar signs, brand names, and short acronyms. */
function stripLiterals(text: string): string {
  return text
    .replace(/\$[\d,.]+[BMKbmk]?/g, '')             // dollar amounts
    .replace(/\b\d[\d,.]*%?\b/g, '')                  // numbers / percentages
    .replace(/\b[A-Z]{2,5}\b/g, (m) =>               // short all-caps acronyms
      SAFE_ACRONYMS.has(m) ? m.toLowerCase() : '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Acronyms that are safe to keep as conceptual words. */
const SAFE_ACRONYMS = new Set(['AI', 'API', 'SaaS', 'IoT', 'VR', 'AR', 'ML', 'NLP']);

/** Convert a stat label into a visual theme description. */
function describeStatTheme(label: string, content: string): string {
  const combined = `${label} ${content}`.toLowerCase();

  if (/revenue|dollar|cost|price|funding|valuation|profit/i.test(combined))
    return 'a dramatic visualization of financial scale and economic magnitude';
  if (/year|decade|century|month|day/i.test(combined))
    return 'a dramatic representation of the passage of time and historical significance';
  if (/user|customer|employee|people|worker|team/i.test(combined))
    return 'a dramatic visualization of vast numbers of people and human scale';
  if (/percent|growth|increase|rate/i.test(combined))
    return 'a dramatic depiction of exponential growth and rapid acceleration';
  if (/country|nation|global|worldwide/i.test(combined))
    return 'a dramatic aerial view of global reach and worldwide scale';
  if (/line|code|token|parameter/i.test(combined))
    return 'a dramatic visualization of massive computational scale and data processing';
  if (/second|minute|hour|fast|slow|speed|latency|benchmark/i.test(combined))
    return 'a dramatic visualization of speed, velocity, and racing against time';
  if (/compile|compiler|build|binary|executable|instruction/i.test(combined))
    return 'a dramatic visualization of complex machinery, gears, and precision engineering';

  // Generic fallback: use the cleaned content for mood
  const cleaned = stripLiterals(combined);
  return cleaned.length > 10
    ? `a dramatic visualization evoking the concept of ${cleaned}`
    : 'a dramatic visualization conveying immense scale and impact';
}

/** Convert a text phrase or sentence into a thematic visual description. */
function describeTextTheme(text: string): string {
  const cleaned = stripLiterals(text);
  if (cleaned.length < 10) {
    return 'an atmospheric, contemplative technological landscape';
  }
  // Wrap in visual framing to prevent Gemini from interpreting as text to render
  return `an atmospheric visual evoking the concept of: ${cleaned}`;
}

/** Convert a comparison into a conceptual visual description. */
function describeComparisonTheme(
  leftTitle: string | undefined,
  rightTitle: string | undefined,
  content: string,
): string {
  const left = stripLiterals(leftTitle ?? '');
  const right = stripLiterals(rightTitle ?? '');
  if (left && right) {
    return `a visual comparison between a traditional approach and a modern approach in the context of ${left} versus ${right}`;
  }
  const cleaned = stripLiterals(content);
  return cleaned.length > 10
    ? `a split visual comparison about ${cleaned}`
    : 'a split visual comparison between an old and new technological approach';
}

/**
 * Build an image generation prompt for a scene, or return null if the scene
 * type should not receive a generated image.
 */
export function buildPromptForScene(
  scene: SceneLike,
  topic: string,
  previousPrompt?: string,
): string | null {
  if (EXCLUDED_SCENE_TYPES.has(scene.type)) {
    return null;
  }

  const sceneText = extractSceneText(scene);
  if (!sceneText) return null;

  const concepts = classifySceneConcept(sceneText);
  const mood = determineMood(scene.type, sceneText);

  return buildMasterPrompt({
    sceneType: scene.type,
    sceneText,
    topic,
    mood,
    concepts,
    previousImagePrompt: previousPrompt,
  });
}
