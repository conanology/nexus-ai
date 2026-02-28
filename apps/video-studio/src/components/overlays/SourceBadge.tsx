import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { SourceBadgeOverlay } from '../../types/scenes.js';

export interface SourceBadgeProps extends SourceBadgeOverlay {
  fps: number;
  sceneDuration: number;
}

const EDGE_INSET = 40;

const KIND_LABEL: Record<string, string> = {
  tweet: 'POST',
  repository: 'REPO',
  article: 'ARTICLE',
  paper: 'PAPER',
  app: 'APP',
  website: 'WEB',
  video: 'VIDEO',
  unknown: 'SOURCE',
};

export const SourceBadge: React.FC<SourceBadgeProps> = (props) => {
  const { sourceName, sourceKind = 'unknown', detail, icon, verified, delayFrames = 10 } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slideY = interpolate(
    frame,
    [delay, delay + 10],
    [10, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (entranceOpacity <= 0) return null;

  const kindLabel = KIND_LABEL[sourceKind] ?? 'SOURCE';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: EDGE_INSET,
        left: EDGE_INSET,
        zIndex: 10,
        opacity: entranceOpacity * 0.9,
        transform: `translateY(${slideY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: withOpacity(COLORS.bgElevated, 0.82),
          border: `1px solid ${withOpacity(COLORS.accentPrimary, 0.28)}`,
          backdropFilter: 'blur(8px)',
          minWidth: 260,
          boxShadow: `0 4px 20px ${withOpacity(COLORS.bgDeepDark, 0.3)}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: THEME.fonts.mono,
              fontWeight: 700,
              color: COLORS.accentPrimary,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {icon ? `${icon} ` : ''}{kindLabel}
          </span>
          {verified && (
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: THEME.fonts.mono }}>
              VERIFIED
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 15,
            fontFamily: THEME.fonts.mono,
            fontWeight: 600,
            color: COLORS.textPrimary,
            lineHeight: 1.2,
          }}
        >
          {sourceName}
        </div>

        {detail && (
          <div
            style={{
              fontSize: 12,
              fontFamily: THEME.fonts.mono,
              fontWeight: 400,
              color: COLORS.textSecondary,
              opacity: 0.9,
            }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
};
