/**
 * Stock Query Builder — maps scene content to effective Pexels search queries.
 *
 * Only generates queries for real-world, tangible concepts where stock
 * photos/videos will look better than AI-generated abstractions.
 * Returns null for abstract/conceptual content.
 *
 * @module @nexus-ai/asset-library/stock/stock-query-builder
 */

// ---------------------------------------------------------------------------
// Concept → Query Mappings
// ---------------------------------------------------------------------------

/**
 * Maps content keywords/phrases to effective stock search queries.
 * Each entry: [regex pattern, pexels query string, domain tag]
 *
 * Domain tags are used for topic-relevance filtering — a match is skipped
 * if its domain is completely unrelated to the video's topic.
 */
const CONCEPT_QUERIES: Array<[RegExp, string, string]> = [
  // Workforce / Office
  [/workforce|employees?|workers?|staff|hiring|layoff|fired|replaced/i, 'office workers technology', 'workforce'],
  [/remote work|work from home|hybrid|coworking/i, 'remote work laptop', 'workforce'],
  [/\bmeeting\b|conference|presentation|boardroom/i, 'business meeting technology', 'business'],

  // Data / Infrastructure
  [/data center|server farm|server rack|cloud computing|hosting provider/i, 'server room data center', 'infrastructure'],
  [/network infrastructure|internet backbone|bandwidth|5g network/i, 'network cables technology', 'infrastructure'],
  [/\bdatabase\b|data storage|backup system/i, 'data storage technology', 'infrastructure'],

  // Manufacturing / Hardware
  [/\brobot\b|factory|manufacturing|assembly line|industrial automation/i, 'robot arm factory', 'manufacturing'],
  [/semiconductor|processor chip|gpu chip|computer hardware|silicon wafer/i, 'computer chip closeup', 'hardware'],
  [/\bdrone\b|uav|unmanned aerial/i, 'drone technology', 'aviation'],

  // Finance / Economy
  [/stock market|trading floor|wall street|stock exchange/i, 'stock market trading floor', 'finance'],
  [/revenue growth|profit margin|quarterly earnings|market valuation/i, 'business growth chart', 'finance'],
  [/startup funding|venture capital|seed round|series [a-z]/i, 'startup office team', 'finance'],
  [/cryptocurrency|bitcoin|blockchain|defi/i, 'cryptocurrency digital', 'crypto'],

  // Security
  [/cybersecurity|hacking attack|data breach|ransomware|malware/i, 'cybersecurity computer code', 'security'],
  [/privacy violation|surveillance system|monitoring/i, 'security camera surveillance', 'security'],
  [/encryption|password security|authentication system/i, 'digital security lock', 'security'],

  // Healthcare / Science
  [/healthcare|medical device|hospital|patient care|diagnosis/i, 'medical technology hospital', 'healthcare'],
  [/research lab|laboratory|scientist|experiment/i, 'science laboratory research', 'science'],
  [/genome|dna sequencing|biotech|pharmaceutical/i, 'dna biotechnology', 'biotech'],

  // Transportation
  [/self-driving car|autonomous vehicle|tesla autopilot|waymo/i, 'autonomous car technology', 'transport'],
  [/electric vehicle|electric car|ev charging station|ev battery/i, 'electric car charging', 'transport'],
  [/logistics company|shipping container|supply chain|warehouse automation/i, 'warehouse logistics', 'transport'],

  // Education
  [/education system|school|university|student|classroom learning/i, 'students technology classroom', 'education'],
  [/online course|e-learning platform|training program/i, 'online learning laptop', 'education'],

  // Energy / Environment
  [/solar panel|renewable energy|wind farm|clean energy/i, 'solar panels renewable energy', 'energy'],
  [/climate change|environment|sustainability|carbon emission/i, 'nature technology sustainability', 'energy'],

  // Urban / Smart City
  [/smart city|urban planning|metropolis/i, 'smart city night aerial', 'urban'],
  [/traffic congestion|public transportation|daily commute/i, 'city traffic technology', 'urban'],

  // Developer / Code
  [/software developer|programmer|coding bootcamp|software engineer/i, 'software developer coding', 'dev'],
  [/open source project|github repository|code repository/i, 'programmer code screen', 'dev'],

  // Customer / Commerce
  [/customer service|customer support|chatbot|call center/i, 'customer service technology', 'commerce'],
  [/e-commerce|online shopping|marketplace/i, 'ecommerce shopping technology', 'commerce'],
  [/delivery service|last mile delivery|doorstep/i, 'delivery technology package', 'commerce'],
];

/**
 * Domain tags that are related to software/compiler topics.
 * Used to allow only relevant stock queries for dev-focused videos.
 */
const SOFTWARE_DOMAINS = new Set(['dev', 'infrastructure', 'security', 'hardware']);

/**
 * Map topic keywords to their relevant domain tags.
 * If the video topic matches these, only stock queries with matching domains are allowed.
 */
const TOPIC_DOMAIN_MAP: Array<[RegExp, Set<string>]> = [
  [/compiler|compiler|linker|assembler|programming language|code gen|parser|lexer/i, SOFTWARE_DOMAINS],
  [/ai\b|artificial intelligence|machine learning|neural|llm|gpt|model training/i, new Set(['dev', 'infrastructure', 'hardware', 'science'])],
  [/crypto|bitcoin|blockchain|web3|defi/i, new Set(['crypto', 'finance', 'dev'])],
  [/healthcare|medical|hospital|drug|pharma/i, new Set(['healthcare', 'biotech', 'science'])],
  [/electric vehicle|ev\b|tesla|automotive|car/i, new Set(['transport', 'manufacturing', 'energy'])],
  [/education|school|university|learning/i, new Set(['education', 'dev'])],
];

/**
 * Patterns that indicate content is too abstract for stock imagery.
 * When these match, return null — let AI backgrounds handle it.
 */
const ABSTRACT_PATTERNS: RegExp[] = [
  /\bimagine\b.*\bworld\b/i,
  /\bfuture of\b/i,
  /\bphilosoph/i,
  /\bparadigm shift\b/i,
  /\bfundamental\b.*\bquestion/i,
  /\bwhat if\b/i,
  /\blet's think about\b/i,
  /\bthe big picture\b/i,
  /\bexistential\b/i,
  /\bmetaphor/i,
  /\banalogy\b/i,
];

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

/**
 * Generate a Pexels search query from scene content.
 *
 * Returns null if the content is too abstract — AI-generated backgrounds
 * handle abstract concepts better than stock photos.
 *
 * @param content - Scene narration text
 * @param sceneType - Scene type for additional context
 * @param videoTopic - Overall video topic for relevance filtering
 * @returns Pexels search query string, or null if content is too abstract
 */
export function buildStockQuery(
  content: string,
  _sceneType?: string,
  videoTopic?: string,
): string | null {
  // Skip abstract content
  for (const pattern of ABSTRACT_PATTERNS) {
    if (pattern.test(content)) return null;
  }

  // Determine allowed domains based on video topic
  let allowedDomains: Set<string> | null = null;
  if (videoTopic) {
    for (const [topicPattern, domains] of TOPIC_DOMAIN_MAP) {
      if (topicPattern.test(videoTopic)) {
        allowedDomains = domains;
        break;
      }
    }
  }

  // Try to match content to a concrete concept
  for (const [pattern, query, domain] of CONCEPT_QUERIES) {
    if (pattern.test(content)) {
      // If topic restricts domains, only allow matching domains
      if (allowedDomains && !allowedDomains.has(domain)) {
        continue; // Skip — this query is irrelevant to the video topic
      }
      return query;
    }
  }

  // No match — content is too abstract or generic for stock imagery
  return null;
}
