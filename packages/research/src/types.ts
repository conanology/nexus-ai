/**
 * Research stage types
 * @module @nexus-ai/research/types
 */

/**
 * Input data for the research stage
 */
export interface ResearchInput {
  /** Selected topic metadata */
  topic: {
    /** Topic URL */
    url: string;
    /** Topic title */
    title: string;
    /** Topic description/snippet */
    description?: string;
    /** Source of the topic (e.g., 'github-trending', 'hackernews') */
    source?: string;
    /** Additional metadata from the news sourcing stage */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Output data from the research stage
 */
export interface ResearchOutput {
  /** Generated research brief (markdown format) */
  brief: string;
  /** Alias for brief - used by script-gen stage */
  researchBrief: string;
  /** Word count of the brief */
  wordCount: number;
  /** GCS URL where the brief is stored */
  artifactUrl: string;
  /** Provider information */
  provider: {
    name: string;
    tier: 'primary' | 'fallback';
    attempts: number;
  };
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Research prompt configuration
 */
export interface ResearchPromptConfig {
  /** Topic URL */
  url: string;
  /** Topic title */
  title: string;
  /** Topic description */
  description?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}
