import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { CodeHighlightProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

const DEFAULT_TYPING_SPEED = 30;
const CURSOR_BLINK_FRAMES = 15;

export const CodeHighlight: React.FC<CodeHighlightProps> = ({
  title = 'Code',
  code = 'console.log("Hello World");',
  language = 'javascript',
  typingEffect,
  typingSpeed,
  visibleChars: visibleCharsProp,
  data,
  style,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const codeContent = data?.code ?? code;
  const codeLang = data?.language ?? language;
  const highlightLines = data?.highlightLines ?? [];

  const fontSize = style?.fontSize ?? THEME.fontSizes.lg;

  // Typing effect calculation (guards match broll-engine/code-renderer.ts)
  const isTyping = typingEffect === true;
  const speed = typingSpeed ?? DEFAULT_TYPING_SPEED;
  const safeFps = fps > 0 ? fps : 30;
  const safeFrame = Math.max(0, frame);
  const effectiveVisibleChars = isTyping
    ? visibleCharsProp ?? Math.min(Math.floor(safeFrame * (speed / safeFps)), codeContent.length)
    : codeContent.length;

  // The code to display: sliced when typing, full otherwise
  const displayCode = isTyping ? codeContent.slice(0, effectiveVisibleChars) : codeContent;
  const typingComplete = effectiveVisibleChars >= codeContent.length;

  // Split display code into lines
  const lines = displayCode.split('\n');

  // Filter highlightLines to only visible, non-empty lines during typing
  // Note: data.highlightLines uses 0-based indices (video-studio convention)
  const activeHighlightLines = isTyping
    ? highlightLines.filter((lineIdx) => lineIdx < lines.length && lines[lineIdx].length > 0)
    : highlightLines;

  // Animation progress
  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  // Syntax highlighting colors (simplified)
  const syntaxColors = {
    keyword: THEME.colors.chart.purple,
    string: THEME.colors.chart.green,
    function: THEME.colors.chart.blue,
    comment: THEME.colors.textMuted,
    number: THEME.colors.chart.yellow,
  };

  // Cursor visibility: only in typing mode
  // Discrete toggle matching broll-engine: on/off every CURSOR_BLINK_FRAMES (~2Hz at 30fps)
  const cursorOpacity = isTyping
    ? typingComplete
      ? (Math.floor(safeFrame / CURSOR_BLINK_FRAMES) % 2 === 0 ? 1 : 0)
      : 1
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: THEME.spacing['2xl'],
          left: THEME.spacing['2xl'],
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['4xl'],
          color: THEME.colors.text,
          fontWeight: 700,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {title}
      </div>

      {/* Language badge */}
      <div
        style={{
          position: 'absolute',
          top: THEME.spacing['2xl'] + 60,
          left: THEME.spacing['2xl'],
          padding: `${THEME.spacing.sm}px ${THEME.spacing.md}px`,
          backgroundColor: THEME.colors.primary,
          borderRadius: THEME.borderRadius.sm,
          fontFamily: THEME.fonts.mono,
          fontSize: THEME.fontSizes.sm,
          color: THEME.colors.text,
          fontWeight: 600,
          textTransform: 'uppercase',
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {codeLang}
      </div>

      {/* Code block */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 200,
          right: 200,
          bottom: 150,
          backgroundColor: THEME.colors.backgroundDark,
          borderRadius: THEME.borderRadius.lg,
          border: `2px solid ${THEME.colors.primary}40`,
          padding: THEME.spacing.xl,
          overflow: 'hidden',
          opacity: progress,
          boxShadow: THEME.shadows.xl,
          ...motionStyles.emphasisStyle,
          transform: `scale(${progress}) ${motionStyles.emphasisStyle.transform === 'none' ? '' : motionStyles.emphasisStyle.transform}`.trim(),
        }}
      >
        {/* Code content */}
        <div
          style={{
            fontFamily: THEME.fonts.mono,
            fontSize: fontSize,
            lineHeight: 1.6,
            color: THEME.colors.text,
          }}
        >
          {lines.map((line, index) => {
            // In typing mode: all visible lines shown at full opacity
            // In non-typing mode: staggered line-by-line fade-in
            const lineDelay = index * 2;
            const lineOpacity = isTyping
              ? 1
              : interpolate(
                  frame - lineDelay,
                  [0, 15],
                  [0, 1],
                  { extrapolateRight: 'clamp' }
                );

            const isHighlighted = activeHighlightLines.includes(index);

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: THEME.spacing.xs,
                  backgroundColor: isHighlighted
                    ? `${THEME.colors.primary}20`
                    : 'transparent',
                  borderLeft: isHighlighted
                    ? `3px solid ${THEME.colors.primary}`
                    : '3px solid transparent',
                  paddingLeft: THEME.spacing.md,
                  opacity: lineOpacity,
                }}
              >
                {/* Line number */}
                <span
                  style={{
                    width: 40,
                    flexShrink: 0,
                    color: THEME.colors.textMuted,
                    fontSize: fontSize * 0.85,
                    marginRight: THEME.spacing.md,
                  }}
                >
                  {index + 1}
                </span>

                {/* Code line with basic syntax highlighting */}
                <span
                  style={{
                    whiteSpace: 'pre',
                    color: THEME.colors.text,
                  }}
                >
                  {highlightSyntax(line, syntaxColors)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cursor - only visible in typing mode */}
        <div
          data-testid="typing-cursor"
          style={{
            position: 'absolute',
            bottom: THEME.spacing.xl,
            left: THEME.spacing.xl + 40 + THEME.spacing.md,
            width: 2,
            height: fontSize * 1.4,
            backgroundColor: THEME.colors.primary,
            opacity: cursorOpacity,
          }}
        />
      </div>
      </div>
    </AbsoluteFill>
  );
};

// Basic syntax highlighting helper
function highlightSyntax(
  line: string,
  colors: Record<string, string>
): React.ReactNode {
  // Simple regex-based highlighting
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g;
  const strings = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/g;
  const numbers = /\b\d+(\.\d+)?\b/g;

  let parts: Array<{ text: string; color?: string }> = [{ text: line }];

  // Apply syntax highlighting rules
  const rules = [
    { pattern: comments, color: colors.comment },
    { pattern: strings, color: colors.string },
    { pattern: keywords, color: colors.keyword },
    { pattern: numbers, color: colors.number },
  ];

  rules.forEach(({ pattern, color }) => {
    const newParts: typeof parts = [];
    parts.forEach((part) => {
      if (part.color) {
        newParts.push(part);
        return;
      }

      let lastIndex = 0;
      const matches = Array.from(part.text.matchAll(pattern));

      matches.forEach((match) => {
        const matchIndex = match.index!;
        if (matchIndex > lastIndex) {
          newParts.push({ text: part.text.slice(lastIndex, matchIndex) });
        }
        newParts.push({ text: match[0], color });
        lastIndex = matchIndex + match[0].length;
      });

      if (lastIndex < part.text.length) {
        newParts.push({ text: part.text.slice(lastIndex) });
      }
    });
    parts = newParts.length > 0 ? newParts : parts;
  });

  return (
    <>
      {parts.map((part, i) => (
        <span key={i} style={{ color: part.color || 'inherit' }}>
          {part.text}
        </span>
      ))}
    </>
  );
}
