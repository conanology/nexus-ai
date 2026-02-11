# Scene Types

Nexus-AI supports 16 scene types. The Director Agent classifies each segment of the narration script into one of these types and generates the corresponding `visualData`.

## Summary

| Scene Type | Purpose | Pacing | Key Visual Data |
|-----------|---------|--------|-----------------|
| `intro` | Episode opening | normal | `episodeNumber?`, `episodeTitle?` |
| `chapter-break` | Section divider | normal | `title`, `subtitle?`, `chapterNumber?` |
| `narration-default` | General narration fallback | normal | `backgroundVariant?` |
| `text-emphasis` | Highlighted phrase with animation | normal | `phrase`, `highlightWords?`, `style` |
| `full-screen-text` | Large text dominating screen | normal | `text`, `alignment?` |
| `stat-callout` | Number + label display | punch | `number`, `label`, `prefix?`, `suffix?`, `countUp?`, `comparison?` |
| `comparison` | Side-by-side layout | dense | `left: {title, items[]}`, `right: {title, items[]}` |
| `diagram` | Node-edge visualization | dense | `nodes[]`, `edges[]`, `layout` |
| `logo-showcase` | Brand/company logos | breathe | `logos[]`, `layout` |
| `timeline` | Chronological events | breathe | `events[]` |
| `quote` | Attribution + quote | breathe | `text`, `attribution`, `role?` |
| `list-reveal` | Bulleted/numbered items | dense | `title?`, `items[]`, `style` |
| `code-block` | Syntax-highlighted code | dense | `code`, `language?`, `highlightLines?`, `filename?` |
| `meme-reaction` | GIF reaction | punch | `gifSrc`, `reactionType`, `description` |
| `map-animation` | Geographic world map | dense | `mapType`, `highlightedCountries[]`, `animationStyle` |
| `outro` | Episode closing | normal | `nextTopicTeaser?` |

## Pacing Modes

| Mode | Speed | Use Case |
|------|-------|----------|
| `normal` | 1.0x | Standard narration |
| `punch` | 1.3x | High-energy moments (stats, reactions) |
| `breathe` | 0.7x | Contemplative scenes (quotes, timelines) |
| `dense` | 1.0x | Information-heavy content (comparisons, code) |

## Enrichment Exclusions

Not all enrichment stages apply to every scene type:

| Scene Type | AI Images | Annotations | Stock Photos | Memes |
|-----------|-----------|-------------|--------------|-------|
| `intro` | Yes | **No** | Yes | **No** |
| `chapter-break` | Yes | **No** | Yes | Yes |
| `narration-default` | Yes | Yes | Yes | Yes |
| `text-emphasis` | Yes | Yes | Yes | Yes |
| `full-screen-text` | Yes | Yes | Yes | Yes |
| `stat-callout` | Yes | Yes | Yes | Yes |
| `comparison` | Yes | Yes | Yes | Yes |
| `diagram` | Yes | Yes | Yes | Yes |
| `logo-showcase` | **No** | Yes | Yes | Yes |
| `timeline` | Yes | Yes | Yes | Yes |
| `quote` | Yes | Yes | Yes | Yes |
| `list-reveal` | Yes | Yes | Yes | Yes |
| `code-block` | Yes | **No** | Yes | **No** |
| `meme-reaction` | Yes | **No** | **No** | **No** |
| `map-animation` | **No** | **No** | **No** | Yes |
| `outro` | Yes | **No** | Yes | **No** |

## Scene Details

### `intro`

Episode opening. Renders the channel branding, episode number, and title with entrance animations.

```typescript
interface IntroVisualData {
  episodeNumber?: number;
  episodeTitle?: string;
}
```

**SFX:** None (music starts here)

### `chapter-break`

Visual divider between major topic sections. Shows chapter number and title.

```typescript
interface ChapterBreakVisualData {
  title: string;
  subtitle?: string;
  chapterNumber?: number;
}
```

### `narration-default`

General-purpose scene used when content doesn't fit a more specific type. Background varies between gradient, particles, and grid.

```typescript
interface NarrationDefaultVisualData {
  backgroundVariant?: 'gradient' | 'particles' | 'grid';
}
```

### `text-emphasis`

Highlights a key phrase with one of three animation styles. Used for important takeaways or dramatic statements.

```typescript
interface TextEmphasisVisualData {
  phrase: string;
  highlightWords?: string[];
  style: 'fade' | 'slam' | 'typewriter';
}
```

**Annotations:** Underline (squiggly if dramatic sentiment, single otherwise)

### `full-screen-text`

Large text taking up the entire screen. Used for topic titles or section headers.

```typescript
interface FullScreenTextVisualData {
  text: string;
  alignment?: 'center' | 'left';
}
```

### `stat-callout`

Displays a statistic with optional count-up animation and before/after comparison.

```typescript
interface StatCalloutVisualData {
  number: string;
  label: string;
  prefix?: string;
  suffix?: string;
  countUp?: boolean;
  comparison?: { number: string; label: string };
}
```

**Annotations:** Circle around main number
**SFX:** `impact-hard`
**Can be cold-open:** Yes (shake effect via `ColdOpen` wrapper)

### `comparison`

Side-by-side comparison of two concepts, technologies, or approaches.

```typescript
interface ComparisonVisualData {
  left: { title: string; items: string[] };
  right: { title: string; items: string[] };
}
```

**Annotations:** Arrow (left→right), x-mark on left if replacement language detected

### `diagram`

Node-edge network visualization for system architectures, data flows, or concept maps.

```typescript
interface DiagramVisualData {
  nodes: Array<{ id: string; label: string; icon?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
  layout: 'horizontal' | 'vertical' | 'hub-spoke';
}
```

### `logo-showcase`

Grid or sequential display of brand/company logos. Used during industry overviews or partnership mentions.

```typescript
interface LogoShowcaseVisualData {
  logos: Array<{ name: string; src?: string }>;
  layout: 'grid' | 'sequential';
}
```

Logo images are fetched automatically via Clearbit/Google during enrichment.

### `timeline`

Chronological display of events. Used for historical context or development milestones.

```typescript
interface TimelineVisualData {
  events: Array<{ year: string; label: string; description?: string }>;
}
```

### `quote`

Displays a quote with attribution. Used for expert opinions or notable statements.

```typescript
interface QuoteVisualData {
  text: string;
  attribution: string;
  role?: string;
}
```

### `list-reveal`

Progressive reveal of list items. Used for feature lists, pros/cons, or step-by-step explanations.

```typescript
interface ListRevealVisualData {
  title?: string;
  items: string[];
  style: 'bullet' | 'numbered' | 'icon';
}
```

**Annotations:** Arrow pointing to first item

### `code-block`

Syntax-highlighted code display with optional line highlighting.

```typescript
interface CodeBlockVisualData {
  code: string;
  language?: string;
  highlightLines?: number[];
  filename?: string;
}
```

Font sizes: 34px (base), 30px (>18 lines), 26px (truncated).

### `meme-reaction`

GIF meme inserted as a reaction to the preceding narration. Added automatically by the meme enricher.

```typescript
interface MemeReactionVisualData {
  gifSrc: string;
  reactionType: string;
  description: string;
}
```

Receives no overlays, no annotations, no images.

### `map-animation`

Animated world map highlighting countries relevant to the topic.

```typescript
interface MapAnimationVisualData {
  mapType: 'world' | 'region';
  highlightedCountries: string[];
  highlightColor?: string;
  label?: string;
  animationStyle: 'sequential' | 'pulse' | 'simultaneous';
  centerOn?: string;
}
```

**Animation style auto-selection:** <=5 countries → simultaneous, 6-15 → sequential, 16+ → pulse
**Supported countries:** 50 (US, CA, MX, BR, AR, CO, CL, PE, GB, FR, DE, ES, IT, NL, SE, NO, FI, DK, PL, RU, UA, TR, CH, AT, BE, IE, PT, CZ, HU, RO, GR, SA, AE, IL, ZA, NG, EG, IN, CN, JP, KR, TW, SG, ID, TH, VN, PH, MY, AU, NZ)
**SFX:** `reveal`

### `outro`

Episode closing with optional teaser for the next topic.

```typescript
interface OutroVisualData {
  nextTopicTeaser?: string;
}
```

## Cold-Open Scenes

Only `stat-callout` and `text-emphasis` can be cold-opens (`isColdOpen: true`). Cold-open scenes are wrapped with the `ColdOpen` component which adds a camera shake effect and uses `cut` transition (no entrance animation).

## Transitions

Each scene has a `transition` field assigned by the Director Agent:

| Transition | Frames | Duration | Style |
|-----------|--------|----------|-------|
| `cut` | 0 | 0s | Instant |
| `crossfade` | 8 | 0.27s | Opacity fade |
| `dissolve` | 20 | 0.67s | Long opacity fade |
| `wipe-left` | 10 | 0.33s | Clip-path reveal from left |
| `slide-up` | 10 | 0.33s | Opacity + translateY |

## Director Classification

The Director Agent uses Gemini (`gemini-2.5-flash`) to classify narration segments. Key classification guidance:

- **Geographic content** (countries, regions, global stats) → `map-animation`
- **Numbers, percentages, metrics** → `stat-callout`
- **Before/after, A vs B** → `comparison`
- **System architecture, data flow** → `diagram`
- **Code samples, API examples** → `code-block`
- **Expert quotes** → `quote`
- **Ordered steps, feature lists** → `list-reveal`
- **Historical events** → `timeline`
- **Company/brand mentions** → `logo-showcase`
- **Key takeaway or emphasis** → `text-emphasis`
- **General narration** → `narration-default` (fallback)

## Related Documentation

- [Visual Layers](VISUAL-LAYERS.md) — How scenes are rendered
- [Pipeline](PIPELINE.md) — When scenes are created (Step 8) and enriched (Step 9)
- [Architecture](ARCHITECTURE.md) — System overview
