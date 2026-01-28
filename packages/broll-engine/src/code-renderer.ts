import type { CodeBRollConfig } from '@nexus-ai/script-gen';
import type { CodeSnippetProps } from './types.js';

// TODO: Full implementation in Story 6-28
export function generateCodeSnippetProps(
  config: CodeBRollConfig,
  _durationFrames: number,
): CodeSnippetProps {
  return {
    code: config.content,
    language: config.language,
    visibleChars: config.content.length,
    highlightLines: config.highlightLines ?? [],
    showCursor: false,
    theme: config.theme,
    showLineNumbers: config.showLineNumbers,
  };
}
