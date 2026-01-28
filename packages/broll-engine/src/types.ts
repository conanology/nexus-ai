/**
 * B-Roll Engine Types
 *
 * Re-exports B-Roll types from @nexus-ai/script-gen and defines
 * broll-engine-specific interfaces for rendering props.
 */

// Re-export all B-Roll types from script-gen
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
} from '@nexus-ai/script-gen';

import type { BRollSpec, BRollType, BrowserAction } from '@nexus-ai/script-gen';

/** Structured content for browser demo rendering */
export interface BrowserDemoContent {
  /** Template-specific elements to render */
  elements: BrowserDemoElement[];
  /** Current cursor position (if any action is active) */
  cursor?: { x: number; y: number; visible: boolean; clicking: boolean };
  /** Current scroll offset */
  scrollY: number;
  /** Active highlight target (CSS selector) */
  activeHighlight?: { target: string; opacity: number };
}

export interface BrowserDemoElement {
  id: string;
  type: 'text' | 'input' | 'button' | 'code-block' | 'metric' | 'chart';
  content: string;
  /** For type actions: how many chars are visible */
  visibleChars?: number;
  position: { x: number; y: number };
}

/** Props for code snippet Remotion component */
export interface CodeSnippetProps {
  code: string;
  language: string;
  visibleChars: number;
  highlightLines: number[];
  showCursor: boolean;
  theme: 'dark' | 'light';
  showLineNumbers: boolean;
}

/** Style options for browser demo frame */
export interface BrowserStyle {
  theme: 'light' | 'dark';
}

/** Props for browser demo Remotion component */
export interface BrowserDemoProps {
  url: string;
  content: BrowserDemoContent | null;
  actions: BrowserAction[];
  viewport: { width: number; height: number };
  style?: BrowserStyle;
}

/** Input to the B-Roll engine */
export interface BRollEngineInput {
  spec: BRollSpec;
  durationFrames: number;
  fps: number;
}

/** Output from the B-Roll engine (union of component props) */
export interface BRollEngineOutput {
  type: BRollType;
  props: CodeSnippetProps | BrowserDemoProps;
}
