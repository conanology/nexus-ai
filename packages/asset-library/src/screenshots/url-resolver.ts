/**
 * URL Resolver — maps company/product names to visually interesting URLs.
 *
 * Used by the screenshot enricher to determine which websites to capture
 * for scene backgrounds.
 *
 * @module @nexus-ai/asset-library/screenshots/url-resolver
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UrlEntry {
  url: string;
  darkModeUrl?: string;
  waitForSelector?: string;
  clip?: { x: number; y: number; width: number; height: number };
}

// ---------------------------------------------------------------------------
// URL Map (25+ companies)
// ---------------------------------------------------------------------------

export const URL_MAP: Record<string, UrlEntry> = {
  klarna: { url: 'https://www.klarna.com', waitForSelector: 'main' },
  salesforce: { url: 'https://www.salesforce.com' },
  slack: { url: 'https://slack.com' },
  openai: { url: 'https://openai.com' },
  github: { url: 'https://github.com' },
  notion: { url: 'https://www.notion.so' },
  figma: { url: 'https://www.figma.com' },
  stripe: { url: 'https://stripe.com' },
  shopify: { url: 'https://www.shopify.com' },
  nvidia: { url: 'https://www.nvidia.com' },
  google: { url: 'https://about.google' },
  microsoft: { url: 'https://www.microsoft.com' },
  meta: { url: 'https://about.meta.com' },
  amazon: { url: 'https://aws.amazon.com' },
  apple: { url: 'https://www.apple.com' },
  atlassian: { url: 'https://www.atlassian.com' },
  hubspot: { url: 'https://www.hubspot.com' },
  zendesk: { url: 'https://www.zendesk.com' },
  servicenow: { url: 'https://www.servicenow.com' },
  workday: { url: 'https://www.workday.com' },
  chatgpt: { url: 'https://chatgpt.com' },
  anthropic: { url: 'https://www.anthropic.com' },
  midjourney: { url: 'https://www.midjourney.com' },
  vercel: { url: 'https://vercel.com' },
  supabase: { url: 'https://supabase.com' },
  databricks: { url: 'https://www.databricks.com' },
  snowflake: { url: 'https://www.snowflake.com' },
  twilio: { url: 'https://www.twilio.com' },
  datadog: { url: 'https://www.datadoghq.com' },
  mongodb: { url: 'https://www.mongodb.com' },
};

// ---------------------------------------------------------------------------
// Alternative name aliases
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  'chat gpt': 'chatgpt',
  'chat-gpt': 'chatgpt',
  aws: 'amazon',
  'amazon web services': 'amazon',
  'google cloud': 'google',
  gcp: 'google',
  azure: 'microsoft',
  fb: 'meta',
  facebook: 'meta',
  ig: 'meta',
  instagram: 'meta',
  whatsapp: 'meta',
  'github copilot': 'github',
  copilot: 'github',
  claude: 'anthropic',
  'mid journey': 'midjourney',
  'next.js': 'vercel',
  nextjs: 'vercel',
  'gpt-4': 'openai',
  'gpt-4o': 'openai',
  'dall-e': 'openai',
  dalle: 'openai',
  mongo: 'mongodb',
};

// ---------------------------------------------------------------------------
// resolveScreenshotUrl
// ---------------------------------------------------------------------------

/**
 * Resolve a company or product name to a URL entry for screenshotting.
 *
 * Uses case-insensitive matching with alias support.
 * Returns null if no mapping exists.
 */
export function resolveScreenshotUrl(companyOrProduct: string): UrlEntry | null {
  const normalized = companyOrProduct.toLowerCase().trim();

  // Direct match
  if (URL_MAP[normalized]) {
    return URL_MAP[normalized];
  }

  // Alias match
  const aliasKey = ALIASES[normalized];
  if (aliasKey && URL_MAP[aliasKey]) {
    return URL_MAP[aliasKey];
  }

  // Fuzzy: check if the input contains a known key or vice versa
  for (const key of Object.keys(URL_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return URL_MAP[key];
    }
  }

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return URL_MAP[target] ?? null;
    }
  }

  return null;
}
