/**
 * @nexus-ai/broll-engine
 *
 * B-Roll generation engine for the NEXUS-AI pipeline.
 * Generates rendering props for code snippets, browser demos, and other B-Roll types.
 */

// Types
export type {
  BRollSpec,
  BRollBase,
  BRollType,
  BRollPosition,
  CodeBRoll,
  BrowserBRoll,
  DiagramBRoll,
  AnimationBRoll,
  StaticBRoll,
  CodeBRollConfig,
  BrowserBRollConfig,
  DiagramBRollConfig,
  AnimationBRollConfig,
  StaticBRollConfig,
  BrowserAction,
  BrowserActionType,
  BrowserTemplateId,
  CodeSnippetProps,
  BrowserDemoProps,
  BrowserStyle,
  BRollEngineInput,
  BRollEngineOutput,
} from './types.js';

// Functions
export { generateCodeSnippetProps } from './code-renderer.js';
export { generateBrowserDemoProps } from './browser-demo.js';
