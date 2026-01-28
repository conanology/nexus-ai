import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { BrowserFrameProps } from '../types';
import type { BrowserDemoContent, BrowserDemoElement } from '@nexus-ai/broll-engine';
import { useMotion } from '../hooks/useMotion.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const CURSOR_SIZE = 16;
const WINDOW_DOT_SIZE = 12;
const WINDOW_DOT_GAP = 8;
const ADDRESS_BAR_HEIGHT = 36;
const TAB_BAR_HEIGHT = 36;
const WINDOW_DOT_COLORS = {
  close: '#FF5F57',
  minimize: '#FEBC2E',
  maximize: '#28C840',
} as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

const WindowControls: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: WINDOW_DOT_GAP }}>
    {Object.values(WINDOW_DOT_COLORS).map((color, i) => (
      <div
        key={i}
        data-testid={`window-dot-${i}`}
        style={{
          width: WINDOW_DOT_SIZE,
          height: WINDOW_DOT_SIZE,
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
    ))}
  </div>
);

const TabBar: React.FC<{ url: string; theme: 'light' | 'dark' }> = ({ url, theme }) => {
  const tabBg = theme === 'dark' ? THEME.colors.backgroundDark : '#e5e7eb';
  const tabText = theme === 'dark' ? THEME.colors.text : '#1f2937';
  // Extract page title from URL
  const title = url.replace(/^https?:\/\//, '').split('/')[0] || 'New Tab';

  return (
    <div
      data-testid="tab-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: TAB_BAR_HEIGHT,
        paddingLeft: WINDOW_DOT_SIZE * 3 + WINDOW_DOT_GAP * 2 + 16,
      }}
    >
      <div
        data-testid="tab"
        style={{
          backgroundColor: tabBg,
          color: tabText,
          padding: `${THEME.spacing.xs}px ${THEME.spacing.md}px`,
          borderRadius: `${THEME.borderRadius.sm}px ${THEME.borderRadius.sm}px 0 0`,
          fontSize: THEME.fontSizes.sm,
          fontFamily: THEME.fonts.body,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>
    </div>
  );
};

const AddressBar: React.FC<{ url: string; theme: 'light' | 'dark' }> = ({ url, theme }) => {
  const barBg = theme === 'dark' ? THEME.colors.backgroundLight : '#f3f4f6';
  const textColor = theme === 'dark' ? THEME.colors.textSecondary : '#4b5563';
  const iconColor = theme === 'dark' ? THEME.colors.textMuted : '#9ca3af';

  return (
    <div
      data-testid="address-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ADDRESS_BAR_HEIGHT,
        gap: THEME.spacing.sm,
        padding: `0 ${THEME.spacing.md}px`,
      }}
    >
      {/* Navigation buttons (decorative) */}
      <div data-testid="nav-buttons" style={{ display: 'flex', gap: THEME.spacing.xs, color: iconColor, fontSize: THEME.fontSizes.base }}>
        <span>{'◀'}</span>
        <span>{'▶'}</span>
        <span>{'⟳'}</span>
      </div>

      {/* URL bar */}
      <div
        data-testid="url-bar"
        style={{
          flex: 1,
          backgroundColor: barBg,
          borderRadius: THEME.borderRadius.full,
          padding: `${THEME.spacing.xs}px ${THEME.spacing.md}px`,
          display: 'flex',
          alignItems: 'center',
          gap: THEME.spacing.xs,
          fontSize: THEME.fontSizes.sm,
          fontFamily: THEME.fonts.body,
          color: textColor,
        }}
      >
        <span style={{ color: iconColor }}>{'🔒'}</span>
        <span data-testid="url-text">{url}</span>
      </div>
    </div>
  );
};

// ── Element Renderer ───────────────────────────────────────────────────────────

const DemoElement: React.FC<{ element: BrowserDemoElement; theme: 'light' | 'dark' }> = ({ element, theme }) => {
  const textColor = theme === 'dark' ? THEME.colors.text : '#1f2937';
  const displayContent = element.visibleChars !== undefined
    ? element.content.slice(0, element.visibleChars)
    : element.content;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.position.x,
    top: element.position.y,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: textColor,
  };

  switch (element.type) {
    case 'button':
      return (
        <div
          data-testid={`element-${element.id}`}
          style={{
            ...baseStyle,
            backgroundColor: THEME.colors.primary,
            color: THEME.colors.text,
            padding: `${THEME.spacing.xs}px ${THEME.spacing.md}px`,
            borderRadius: THEME.borderRadius.sm,
            fontWeight: 600,
          }}
        >
          {displayContent}
        </div>
      );
    case 'input':
      return (
        <div
          data-testid={`element-${element.id}`}
          style={{
            ...baseStyle,
            backgroundColor: theme === 'dark' ? THEME.colors.backgroundDark : '#f9fafb',
            border: `1px solid ${theme === 'dark' ? THEME.colors.textMuted : '#d1d5db'}`,
            padding: `${THEME.spacing.xs}px ${THEME.spacing.sm}px`,
            borderRadius: THEME.borderRadius.sm,
            minWidth: 160,
          }}
        >
          {displayContent}
        </div>
      );
    case 'code-block':
      return (
        <div
          data-testid={`element-${element.id}`}
          style={{
            ...baseStyle,
            fontFamily: THEME.fonts.mono,
            backgroundColor: theme === 'dark' ? THEME.colors.backgroundDark : '#f3f4f6',
            padding: THEME.spacing.sm,
            borderRadius: THEME.borderRadius.sm,
            whiteSpace: 'pre',
          }}
        >
          {displayContent}
        </div>
      );
    case 'metric':
      return (
        <div
          data-testid={`element-${element.id}`}
          style={{
            ...baseStyle,
            fontSize: THEME.fontSizes.xl,
            fontWeight: 700,
            fontFamily: THEME.fonts.mono,
            color: THEME.colors.primary,
          }}
        >
          {displayContent}
        </div>
      );
    case 'chart':
      return (
        <div
          data-testid={`element-${element.id}`}
          style={{
            ...baseStyle,
            backgroundColor: theme === 'dark' ? THEME.colors.backgroundDark : '#f3f4f6',
            border: `1px solid ${theme === 'dark' ? THEME.colors.textMuted : '#d1d5db'}`,
            padding: THEME.spacing.md,
            borderRadius: THEME.borderRadius.sm,
            minWidth: 200,
            minHeight: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {displayContent}
        </div>
      );
    default:
      return (
        <div data-testid={`element-${element.id}`} style={baseStyle}>
          {displayContent}
        </div>
      );
  }
};

// ── Cursor Component ───────────────────────────────────────────────────────────

const Cursor: React.FC<{
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
}> = ({ x, y, visible, clicking }) => {
  if (!visible) return null;

  // Ripple is data-driven: broll-engine sets clicking=true for the frames
  // where the ripple should be visible. The component renders a fixed-size
  // ripple indicator when clicking is active.
  const showRipple = clicking;
  const rippleProgress = clicking ? 0.5 : 0;

  return (
    <>
      {/* Cursor arrow */}
      <div
        data-testid="browser-cursor"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        {/* Simple arrow cursor using CSS */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: `${CURSOR_SIZE * 0.6}px solid ${THEME.colors.text}`,
            borderTop: '2px solid transparent',
            borderBottom: `${CURSOR_SIZE}px solid transparent`,
          }}
        />
      </div>

      {/* Click ripple */}
      {showRipple && (
        <div
          data-testid="click-ripple"
          style={{
            position: 'absolute',
            left: x - 12 * rippleProgress,
            top: y - 12 * rippleProgress,
            width: 24 * rippleProgress,
            height: 24 * rippleProgress,
            borderRadius: '50%',
            border: `2px solid ${THEME.colors.primary}`,
            opacity: 0.6 * (1 - rippleProgress),
            pointerEvents: 'none',
            zIndex: 99,
          }}
        />
      )}
    </>
  );
};

// ── Highlight Box ──────────────────────────────────────────────────────────────

/** Estimated dimensions per element type for highlight box sizing */
const HIGHLIGHT_DIMENSIONS: Record<BrowserDemoElement['type'], { width: number; height: number }> = {
  text: { width: 180, height: 32 },
  input: { width: 168, height: 36 },
  button: { width: 120, height: 36 },
  'code-block': { width: 240, height: 60 },
  metric: { width: 160, height: 48 },
  chart: { width: 208, height: 108 },
};

const HighlightBox: React.FC<{
  target: string;
  opacity: number;
  elements: BrowserDemoElement[];
}> = ({ target, opacity, elements }) => {
  const targetId = target.replace(/^#/, '');
  const targetEl = elements.find((el) => el.id === targetId);
  if (!targetEl || opacity <= 0) return null;

  const dims = HIGHLIGHT_DIMENSIONS[targetEl.type] ?? { width: 180, height: 40 };

  return (
    <div
      data-testid="highlight-box"
      style={{
        position: 'absolute',
        left: targetEl.position.x - 4,
        top: targetEl.position.y - 4,
        width: dims.width,
        height: dims.height,
        border: `2px solid ${THEME.colors.primary}`,
        borderRadius: THEME.borderRadius.sm,
        opacity,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  url: urlProp,
  content,
  viewport: viewportProp,
  style: styleProp,
  data,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  // Frame safety guards (Story 6-30 learnings)
  const safeFps = fps > 0 ? fps : 30;
  const safeFrame = Math.max(0, frame);

  // data.* takes precedence over top-level props
  const url = data?.url ?? urlProp ?? 'https://example.com';
  const viewport = data?.viewport ?? viewportProp ?? { width: 1920, height: 1080 };
  const themeMode = data?.style?.theme ?? styleProp?.theme ?? 'light';
  const demoContent: BrowserDemoContent | undefined = data?.content ?? undefined;

  // Chrome colors
  const chromeBg = themeMode === 'dark' ? THEME.colors.background : '#dee1e6';
  const contentBg = themeMode === 'dark' ? THEME.colors.backgroundDark : '#ffffff';

  // Entrance animation
  const progress = spring({
    frame: safeFrame,
    fps: safeFps,
    config: { damping: 100 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Browser window */}
        <div
          data-testid="browser-window"
          style={{
            width: viewport.width * 0.8,
            height: viewport.height * 0.8,
            maxWidth: '90%',
            maxHeight: '85%',
            backgroundColor: chromeBg,
            borderRadius: THEME.borderRadius.lg,
            overflow: 'hidden',
            boxShadow: THEME.shadows.xl,
            opacity: progress,
            display: 'flex',
            flexDirection: 'column',
            ...motionStyles.emphasisStyle,
            transform: `scale(${interpolate(progress, [0, 1], [0.95, 1])}) ${motionStyles.emphasisStyle.transform === 'none' ? '' : motionStyles.emphasisStyle.transform}`.trim(),
          }}
        >
          {/* Tab bar with window controls */}
          <div
            data-testid="chrome-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: THEME.spacing.md,
              position: 'relative',
            }}
          >
            <WindowControls />
            <TabBar url={url} theme={themeMode} />
          </div>

          {/* Address bar */}
          <AddressBar url={url} theme={themeMode} />

          {/* Content area */}
          <div
            data-testid="content-area"
            style={{
              flex: 1,
              backgroundColor: contentBg,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content wrapper */}
            <div
              data-testid="content-scroll"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: `translateY(-${demoContent?.scrollY ?? 0}px)`,
              }}
            >
              {/* React children content (when not data-driven) */}
              {!demoContent && content}

              {/* Data-driven demo elements */}
              {demoContent?.elements.map((element) => (
                <DemoElement key={element.id} element={element} theme={themeMode} />
              ))}
            </div>

            {/* Highlight overlay */}
            {demoContent?.activeHighlight && demoContent.elements && (
              <HighlightBox
                target={demoContent.activeHighlight.target}
                opacity={demoContent.activeHighlight.opacity}
                elements={demoContent.elements}
              />
            )}

            {/* Cursor */}
            {demoContent?.cursor && (
              <Cursor
                x={demoContent.cursor.x}
                y={demoContent.cursor.y}
                visible={demoContent.cursor.visible}
                clicking={demoContent.cursor.clicking}
              />
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
