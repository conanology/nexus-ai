import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW_ENTRANCE_FRAMES = 15;
const LINE_STAGGER = 3;
const LINE_FADE_FRAMES = 8;
const MAX_DISPLAY_LINES = 15;
const CURSOR_PERIOD = 30; // frames per blink cycle

const EDITOR_BG = '#1e1e2e';
const TITLE_BAR_BG = '#2d2d3d';
const DOT_RED = '#ff5f57';
const DOT_YELLOW = '#febc2e';
const DOT_GREEN = '#28c840';

// Syntax colors
const COLOR_KEYWORD = COLORS.accentSecondary; // #8b5cf6
const COLOR_STRING = '#a5d6a7';
const COLOR_NUMBER = '#f48fb1';
const COLOR_COMMENT = COLORS.textMuted;
const COLOR_OPERATOR = COLORS.textSecondary;
const COLOR_DEFAULT = COLORS.textPrimary;

// ---------------------------------------------------------------------------
// Syntax Highlighting
// ---------------------------------------------------------------------------

interface Token {
  text: string;
  color: string;
  italic?: boolean;
}

const KEYWORD_SET = new Set([
  'const', 'let', 'var', 'function', 'return', 'import', 'from', 'export',
  'default', 'if', 'else', 'class', 'new', 'async', 'await', 'interface',
  'type', 'for', 'while', 'switch', 'case', 'break', 'continue', 'throw',
  'try', 'catch', 'finally', 'typeof', 'instanceof', 'in', 'of', 'void',
  'null', 'undefined', 'true', 'false', 'this', 'super', 'extends',
  'implements', 'static', 'readonly', 'enum', 'abstract', 'private',
  'protected', 'public', 'declare', 'module', 'require', 'yield', 'delete',
]);

const TOKEN_REGEX = new RegExp(
  [
    '(?<string>`[^`]*`|"[^"]*"|\'[^\']*\')',       // strings (template, double, single)
    '(?<number>\\b\\d+(?:\\.\\d+)?\\b)',             // numbers
    '(?<keyword>\\b(?:' + Array.from(KEYWORD_SET).join('|') + ')\\b)', // keywords
    '(?<operator>[{}()\\[\\]=<>+\\-*/&|!;:,.])',    // operators/brackets
    '(?<word>\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)',      // identifiers
    '(?<space>\\s+)',                                 // whitespace
    '(?<other>.)',                                    // anything else
  ].join('|'),
  'g',
);

function tokenizeLine(line: string): Token[] {
  const trimmed = line.trimStart();

  // Full-line comment detection
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return [{ text: line, color: COLOR_COMMENT, italic: true }];
  }

  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    const groups = match.groups!;
    if (groups.string !== undefined) {
      tokens.push({ text: groups.string, color: COLOR_STRING });
    } else if (groups.number !== undefined) {
      tokens.push({ text: groups.number, color: COLOR_NUMBER });
    } else if (groups.keyword !== undefined) {
      tokens.push({ text: groups.keyword, color: COLOR_KEYWORD });
    } else if (groups.operator !== undefined) {
      tokens.push({ text: groups.operator, color: COLOR_OPERATOR });
    } else if (groups.word !== undefined) {
      tokens.push({ text: groups.word, color: COLOR_DEFAULT });
    } else if (groups.space !== undefined) {
      tokens.push({ text: groups.space, color: COLOR_DEFAULT });
    } else {
      tokens.push({ text: match[0], color: COLOR_DEFAULT });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TitleBarDots: React.FC = () => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    {[DOT_RED, DOT_YELLOW, DOT_GREEN].map((color) => (
      <div
        key={color}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
    ))}
  </div>
);

interface CodeLineProps {
  lineNumber: number;
  tokens: Token[];
  highlighted: boolean;
  fontSize: number;
  opacity: number;
  slideX: number;
}

const CodeLine: React.FC<CodeLineProps> = ({
  lineNumber,
  tokens,
  highlighted,
  fontSize,
  opacity,
  slideX,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      opacity,
      transform: `translateX(${slideX}px)`,
      backgroundColor: highlighted ? withOpacity(COLORS.accentPrimary, 0.1) : 'transparent',
      borderLeft: highlighted ? `3px solid ${COLORS.accentPrimary}` : '3px solid transparent',
      paddingLeft: highlighted ? 5 : 8,
      minHeight: fontSize * 1.6,
    }}
  >
    {/* Line number */}
    <span
      style={{
        width: 40,
        textAlign: 'right',
        fontSize,
        fontFamily: THEME.fonts.mono,
        color: COLORS.textMuted,
        marginRight: 16,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {lineNumber}
    </span>

    {/* Code tokens */}
    <span style={{ fontSize, fontFamily: THEME.fonts.mono, whiteSpace: 'pre', textShadow: highlighted ? '0 0 8px rgba(0,212,255,0.3)' : 'none' }}>
      {tokens.map((token, j) => (
        <span
          key={j}
          style={{
            color: token.color,
            fontStyle: token.italic ? 'italic' : 'normal',
          }}
        >
          {token.text}
        </span>
      ))}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const CodeBlock: React.FC<SceneComponentProps<'code-block'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { code, language, highlightLines, filename } = visualData;
  const highlightSet = new Set(highlightLines ?? []);
  const hasHighlights = highlightSet.size > 0;

  // Split and optionally truncate lines
  let lines = code.split('\n');
  let truncated = false;
  if (lines.length > MAX_DISPLAY_LINES) {
    lines = lines.slice(0, MAX_DISPLAY_LINES);
    truncated = true;
  }

  // Font sizing based on line count — large enough to read at 1080p
  let fontSize = 42;
  if (lines.length > 12) fontSize = 36;
  if (truncated) fontSize = 32;

  // Tokenize all lines
  const tokenizedLines = lines.map((line) => tokenizeLine(line));

  // Window entrance (0-15): scale + opacity via spring
  const windowProgress = spring({
    frame,
    fps,
    config: { damping: 100, mass: 0.5, stiffness: 120 },
    durationInFrames: WINDOW_ENTRANCE_FRAMES,
  });
  const windowScale = interpolate(windowProgress, [0, 1], [0.97, 1.0]);

  // Title bar label
  const label = filename || language || '';

  // Blinking cursor: visible on the last visible line
  const lastLineStart = WINDOW_ENTRANCE_FRAMES + (lines.length - 1) * LINE_STAGGER;
  const lastLineVisible = frame >= lastLineStart + LINE_FADE_FRAMES;
  const cursorVisible = lastLineVisible && (frame % CURSOR_PERIOD < CURSOR_PERIOD / 2);

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="cool" grid gridOpacity={0.03} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 120,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Editor window */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            backgroundColor: EDITOR_BG,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            opacity: windowProgress,
            transform: `scale(${windowScale})`,
          }}
        >
          {/* Title bar */}
          <div
            style={{
              height: 36,
              backgroundColor: TITLE_BAR_BG,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              paddingRight: 12,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <TitleBarDots />
            {label && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 24,
                  fontFamily: THEME.fonts.mono,
                  color: COLORS.textSecondary,
                  pointerEvents: 'none',
                }}
              >
                {label}
              </div>
            )}
          </div>

          {/* Code area */}
          <div
            style={{
              flex: 1,
              padding: 24,
              overflow: 'hidden',
            }}
          >
            {tokenizedLines.map((tokens, i) => {
              const lineStart = WINDOW_ENTRANCE_FRAMES + i * LINE_STAGGER;

              const lineOpacity = interpolate(
                frame,
                [lineStart, lineStart + LINE_FADE_FRAMES],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              const lineSlideX = interpolate(
                frame,
                [lineStart, lineStart + LINE_FADE_FRAMES],
                [10, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              // Dim non-highlighted lines when highlights exist
              const isHighlighted = highlightSet.has(i + 1);
              const dimFactor = hasHighlights && !isHighlighted ? 0.5 : 1.0;

              return (
                <CodeLine
                  key={i}
                  lineNumber={i + 1}
                  tokens={tokens}
                  highlighted={isHighlighted}
                  fontSize={fontSize}
                  opacity={lineOpacity * dimFactor}
                  slideX={lineSlideX}
                />
              );
            })}

            {/* Truncation indicator */}
            {truncated && (
              <div
                style={{
                  fontSize,
                  fontFamily: THEME.fonts.mono,
                  color: COLORS.textMuted,
                  paddingLeft: 64,
                  marginTop: 4,
                  opacity: interpolate(
                    frame,
                    [
                      WINDOW_ENTRANCE_FRAMES + lines.length * LINE_STAGGER,
                      WINDOW_ENTRANCE_FRAMES + lines.length * LINE_STAGGER + LINE_FADE_FRAMES,
                    ],
                    [0, 1],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                  ),
                }}
              >
                ...
              </div>
            )}

            {/* Blinking cursor */}
            {cursorVisible && (
              <span
                style={{
                  fontSize,
                  fontFamily: THEME.fonts.mono,
                  color: COLORS.accentPrimary,
                  fontWeight: 300,
                  position: 'relative',
                  top: -(fontSize * 1.6),
                  marginLeft: 64 + tokenizedLines[lines.length - 1]
                    .reduce((len, t) => len + t.text.length, 0) * fontSize * 0.6,
                }}
              >
                |
              </span>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
