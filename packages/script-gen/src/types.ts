/**
 * Script generation stage types
 * @module @nexus-ai/script-gen/types
 */

/**
 * Input data for the script generation stage
 */
export interface ScriptGenInput {
  /** Research brief (markdown format) from research stage */
  researchBrief: string;
  /** Target word count range (defaults to 1200-1800) */
  targetWordCount?: {
    min: number;
    max: number;
  };
}

/**
 * Output data from the script generation stage
 */
export interface ScriptGenOutput {
  /** Final optimized script (markdown with visual cues and pronunciation hints) */
  script: string;
  /** Word count of the final script */
  wordCount: number;
  /** GCS URL where the final script is stored */
  artifactUrl: string;
  /** GCS URLs for all drafts (v1-writer, v2-critic, v3-optimizer) */
  draftUrls: {
    writer: string;
    critic: string;
    optimizer: string;
  };
  /** Number of regeneration attempts (max 3) */
  regenerationAttempts: number;
  /** Provider information for each agent */
  providers: {
    writer: AgentProviderInfo;
    critic: AgentProviderInfo;
    optimizer: AgentProviderInfo;
  };
}

/**
 * Provider info for a single agent execution
 */
export interface AgentProviderInfo {
  name: string;
  tier: 'primary' | 'fallback';
  attempts: number;
}

/**
 * Agent draft result
 */
export interface AgentDraft {
  /** Draft content */
  content: string;
  /** Word count */
  wordCount: number;
  /** Provider info */
  provider: AgentProviderInfo;
}

/**
 * Multi-agent execution result
 */
export interface MultiAgentResult {
  /** Writer draft */
  writerDraft: AgentDraft;
  /** Critic draft (includes critique + revised script) */
  criticDraft: AgentDraft;
  /** Optimizer draft (final optimized script) */
  optimizerDraft: AgentDraft;
}
