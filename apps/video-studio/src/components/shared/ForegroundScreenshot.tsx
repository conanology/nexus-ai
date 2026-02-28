import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import type { SceneSourceMetadata } from '../../types/scenes.js';

const ENTRANCE_FRAMES = 15;
const SAFE_INSET_X = 96;
const SAFE_INSET_Y = 72;

interface ForegroundScreenshotProps {
  src: string;
  sourceMetadata?: SceneSourceMetadata;
}

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

const KIND_ACCENT: Record<string, string> = {
  tweet: '#1D9BF0',
  repository: '#A3E635',
  article: '#F59E0B',
  paper: '#8B5CF6',
  app: '#22D3EE',
  website: '#10B981',
  video: '#EF4444',
  unknown: '#A3E635',
};

/**
 * ForegroundScreenshot — renders a screenshot as a floating evidence window.
 *
 * - 78% x 72% of frame, centered
 * - 3D perspective tilt with floating bob animation
 * - Source-aware top evidence strip (tweet/repo/article/app/etc.)
 * - Slide-up entrance over 15 frames
 * - zIndex 5 (below overlays=6, annotations=8)
 */
export const ForegroundScreenshot: React.FC<ForegroundScreenshotProps> = ({ src, sourceMetadata }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const eased = 1 - Math.pow(1 - progress, 3);
  const translateY = (1 - eased) * 60;
  const opacity = eased;
  const float = interpolate(frame % 120, [0, 60, 120], [0, -6, 0]);
  const mediaPanX = interpolate(frame % 180, [0, 90, 180], [-10, 10, -10]);
  const mediaPanY = interpolate(frame % 210, [0, 105, 210], [6, -6, 6]);
  const mediaScale = 1.03 + Math.sin((frame * 2 * Math.PI) / 160) * 0.015;

  const sourceKind = sourceMetadata?.sourceKind || 'unknown';
  const accent = KIND_ACCENT[sourceKind] || '#A3E635';
  const kindLabel = KIND_LABEL[sourceKind] || 'SOURCE';
  const sourceName = sourceMetadata?.sourceName || 'Evidence source';
  const detail = sourceMetadata?.detail;
  const icon = sourceMetadata?.icon || '•';

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${SAFE_INSET_Y}px ${SAFE_INSET_X}px`,
        pointerEvents: 'none',
        perspective: 1200,
      }}
    >
      <div
        style={{
          width: '76%',
          height: '70%',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 0 30px rgba(170,255,0,0.15), 0 20px 60px rgba(0,0,0,0.6)',
          transform: `perspective(1200px) rotateX(4deg) rotateY(-2deg) translateY(${translateY + float}px)`,
          opacity,
          border: '2px solid rgba(255, 255, 255, 0.88)',
          backgroundColor: '#111111',
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            height: 28,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#febc2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#28c840' }} />
        </div>

        {/* Source evidence strip */}
        <div
          style={{
            minHeight: 34,
            backgroundColor: '#0F1115',
            borderTop: `1px solid ${accent}55`,
            borderBottom: `1px solid ${accent}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '6px 10px',
            color: '#E5E7EB',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: accent, fontWeight: 700, fontSize: 12 }}>{icon}</span>
            <span style={{ color: accent, fontWeight: 700, fontSize: 11, letterSpacing: 0.8 }}>{kindLabel}</span>
            <span style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
              {sourceName}
            </span>
          </div>
          {detail && (
            <span style={{ fontSize: 11, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
              {detail}
            </span>
          )}
        </div>

        <Img
          src={src}
          style={{
            width: '100%',
            height: 'calc(100% - 60px)',
            objectFit: 'cover',
            transform: `translate(${mediaPanX}px, ${mediaPanY}px) scale(${mediaScale})`,
            transformOrigin: 'center center',
            filter: 'contrast(1.08) saturate(1.06) brightness(1.03)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
