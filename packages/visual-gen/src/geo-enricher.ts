/**
 * Geographic Data Enricher
 *
 * For scenes classified as 'map-animation' by the Director Agent:
 * - Validates ISO country codes in highlightedCountries
 * - Resolves country names from scene text to ISO codes
 * - Chooses animation style based on country count
 * - Sets scene SFX to 'reveal'
 *
 * @module @nexus-ai/visual-gen/geo-enricher
 */

import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Country Name → ISO Code Map (50+ entries)
// ---------------------------------------------------------------------------

export const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  // North America
  'united states': 'US', 'usa': 'US', 'us': 'US', 'america': 'US',
  'canada': 'CA',
  'mexico': 'MX',

  // South America
  'brazil': 'BR',
  'argentina': 'AR',
  'colombia': 'CO',
  'chile': 'CL',
  'peru': 'PE',

  // Western Europe
  'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB', 'england': 'GB',
  'france': 'FR',
  'germany': 'DE',
  'spain': 'ES',
  'italy': 'IT',
  'netherlands': 'NL', 'holland': 'NL',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'ireland': 'IE',
  'portugal': 'PT',

  // Northern Europe
  'sweden': 'SE',
  'norway': 'NO',
  'finland': 'FI',
  'denmark': 'DK',

  // Eastern Europe
  'poland': 'PL',
  'russia': 'RU',
  'ukraine': 'UA',
  'czechia': 'CZ', 'czech republic': 'CZ',
  'hungary': 'HU',
  'romania': 'RO',
  'greece': 'GR',
  'turkey': 'TR',

  // Middle East
  'saudi arabia': 'SA',
  'united arab emirates': 'AE', 'uae': 'AE', 'dubai': 'AE',
  'israel': 'IL',

  // Africa
  'south africa': 'ZA',
  'nigeria': 'NG',
  'egypt': 'EG',

  // South Asia
  'india': 'IN',

  // East Asia
  'china': 'CN',
  'japan': 'JP',
  'south korea': 'KR', 'korea': 'KR',
  'taiwan': 'TW',

  // Southeast Asia
  'singapore': 'SG',
  'indonesia': 'ID',
  'thailand': 'TH',
  'vietnam': 'VN',
  'philippines': 'PH',
  'malaysia': 'MY',

  // Oceania
  'australia': 'AU',
  'new zealand': 'NZ',

  // Regions (map to representative countries)
  'europe': 'GB', // will be expanded in context
  'asia': 'CN',
  'silicon valley': 'US',
  'california': 'US',
};

/** Top 10 tech hub countries — fallback when no countries can be resolved */
const DEFAULT_TECH_HUBS: string[] = ['US', 'GB', 'DE', 'FR', 'NL', 'JP', 'KR', 'SG', 'IN', 'AU'];

/** Known valid ISO 3166-1 alpha-2 codes for countries we have map data for */
const VALID_ISO_CODES = new Set([
  'US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE',
  'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'SE', 'NO', 'FI', 'DK',
  'PL', 'RU', 'UA', 'TR', 'CH', 'AT', 'BE', 'IE', 'PT', 'CZ', 'HU', 'RO', 'GR',
  'SA', 'AE', 'IL',
  'ZA', 'NG', 'EG',
  'IN', 'CN', 'JP', 'KR', 'TW',
  'SG', 'ID', 'TH', 'VN', 'PH', 'MY',
  'AU', 'NZ',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MapAnimationVisualData {
  mapType: 'world' | 'region';
  highlightedCountries: string[];
  highlightColor?: string;
  label?: string;
  animationStyle: 'sequential' | 'pulse' | 'simultaneous';
  centerOn?: string;
}

function isMapAnimationData(data: unknown): data is MapAnimationVisualData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'highlightedCountries' in data &&
    Array.isArray((data as MapAnimationVisualData).highlightedCountries)
  );
}

/**
 * Extract country ISO codes from free text by scanning for country names.
 */
export function resolveCountriesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // Sort entries by key length (longest first) to match "south korea" before "korea"
  const entries = Object.entries(COUNTRY_NAME_TO_ISO)
    .sort(([a], [b]) => b.length - a.length);

  for (const [name, code] of entries) {
    // Word boundary match
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(lower)) {
      found.add(code);
    }
  }

  return Array.from(found);
}

/**
 * Choose animation style based on country count.
 */
function chooseAnimationStyle(count: number): 'sequential' | 'pulse' | 'simultaneous' {
  if (count <= 5) return 'simultaneous';
  if (count <= 15) return 'sequential';
  return 'pulse';
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Enrich map-animation scenes with validated/resolved geographic data.
 *
 * For each scene with type 'map-animation':
 * 1. Validate existing ISO codes
 * 2. If no codes, resolve from scene text
 * 3. If still no codes, use default tech hubs
 * 4. Choose animation style if not set
 * 5. Set SFX to 'reveal'
 *
 * Mutates scenes in place and returns the same array.
 */
export function enrichScenesWithGeoData(scenes: Scene[]): Scene[] {
  let enrichedCount = 0;

  for (const scene of scenes) {
    if (scene.type !== 'map-animation') continue;
    if (!isMapAnimationData(scene.visualData)) continue;

    const vd = scene.visualData;

    // 1. Validate existing ISO codes
    const validCodes = vd.highlightedCountries.filter((c) =>
      VALID_ISO_CODES.has(c.toUpperCase()),
    );

    // 2. If no valid codes, try resolving from text
    let resolvedCodes = validCodes.length > 0 ? validCodes : resolveCountriesFromText(scene.content);

    // Also try resolving from label
    if (resolvedCodes.length === 0 && vd.label) {
      resolvedCodes = resolveCountriesFromText(vd.label);
    }

    // 3. If still no codes, fall back to default tech hubs
    if (resolvedCodes.length === 0) {
      resolvedCodes = [...DEFAULT_TECH_HUBS];
    }

    // Normalize to uppercase and deduplicate
    vd.highlightedCountries = [...new Set(resolvedCodes.map((c) => c.toUpperCase()))];

    // 4. Choose animation style if not explicitly set or if default 'simultaneous'
    // Re-evaluate based on actual count
    vd.animationStyle = chooseAnimationStyle(vd.highlightedCountries.length);

    // 5. Set SFX to reveal
    if (!scene.sfx || scene.sfx.length === 0) {
      scene.sfx = ['reveal'];
    }

    enrichedCount++;
  }

  if (enrichedCount > 0) {
    console.log(`Geo enrichment: enriched ${enrichedCount} map-animation scenes`);
  }

  return scenes;
}
