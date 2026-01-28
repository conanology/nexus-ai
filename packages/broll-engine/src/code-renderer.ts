import type { CodeBRollConfig } from '@nexus-ai/script-gen';
import type { CodeSnippetProps } from './types.js';

/** Default typing speed in characters per second */
const DEFAULT_TYPING_SPEED = 30;

/** Cursor blink rate: toggle every 15 frames at 30fps (~500ms) */
const CURSOR_BLINK_FRAMES = 15;

/**
 * Generates frame-aware CodeSnippetProps with progressive typing animation.
 *
 * @param config - B-Roll config for the code snippet
 * @param durationFrames - Total frames allocated for this scene
 * @param currentFrame - Current frame index (0-based)
 * @param fps - Frames per second (e.g., 30)
 * @returns CodeSnippetProps with calculated visibleChars, highlightLines, and cursor state
 */
export function generateCodeSnippetProps(
  config: CodeBRollConfig,
  _durationFrames: number,
  currentFrame: number = 0,
  fps: number = 30,
): CodeSnippetProps {
  const code = config.content;
  const safeFps = fps > 0 ? fps : 30;
  const typingSpeed = config.typingSpeed > 0 ? config.typingSpeed : DEFAULT_TYPING_SPEED;
  const safeFrame = Math.max(0, currentFrame);
  const charsPerFrame = typingSpeed / safeFps;

  // Calculate visible characters clamped to [0, code.length]
  const visibleChars = Math.min(
    Math.max(0, Math.floor(safeFrame * charsPerFrame)),
    code.length,
  );

  // Determine which lines are currently visible
  const visibleText = code.substring(0, visibleChars);
  const visibleLineCount = visibleChars > 0 ? visibleText.split('\n').length : 0;
  const configuredHighlights = config.highlightLines ?? [];
  const highlightLines = configuredHighlights.filter(
    (line) => line <= visibleLineCount,
  );

  // Cursor behavior: no cursor for empty code, show while typing, blink when complete
  let showCursor: boolean;
  if (code.length === 0) {
    showCursor = false;
  } else if (visibleChars < code.length) {
    showCursor = true;
  } else {
    // Blink at ~2Hz (toggle every CURSOR_BLINK_FRAMES)
    showCursor = Math.floor(safeFrame / CURSOR_BLINK_FRAMES) % 2 === 0;
  }

  return {
    code,
    language: config.language,
    visibleChars,
    highlightLines,
    showCursor,
    theme: config.theme,
    showLineNumbers: config.showLineNumbers,
  };
}
