/**
 * @nexus-ai/script-gen
 * Multi-agent script generation stage for NEXUS-AI pipeline
 */

// Export main stage function
export { executeScriptGen } from './script-gen.js';

// Export types
export type {
  ScriptGenInput,
  ScriptGenOutput,
  AgentProviderInfo,
  AgentDraft,
  MultiAgentResult,
} from './types.js';

// Export prompts (for testing)
export {
  buildWriterPrompt,
  buildCriticPrompt,
  buildOptimizerPrompt,
  buildWordCountAdjustmentPrompt,
} from './prompts.js';
