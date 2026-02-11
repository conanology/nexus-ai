import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CornerLogo } from './CornerLogo.js';
import { InfoBadge } from './InfoBadge.js';
import { FloatingLabel } from './FloatingLabel.js';
import { SourceCitation } from './SourceCitation.js';
import type { SceneOverlay } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OverlayRendererProps {
  overlays: SceneOverlay[];
  fps: number;
  sceneDuration: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OverlayRenderer: React.FC<OverlayRendererProps> = ({
  overlays,
  fps,
  sceneDuration,
}) => {
  if (!overlays || overlays.length === 0) return null;

  return (
    <AbsoluteFill style={{ zIndex: 10, pointerEvents: 'none' }}>
      {overlays.map((overlay, index) => {
        switch (overlay.type) {
          case 'corner-logo':
            return (
              <CornerLogo
                key={`overlay-${index}-corner-logo`}
                {...overlay}
                fps={fps}
                sceneDuration={sceneDuration}
              />
            );
          case 'info-badge':
            return (
              <InfoBadge
                key={`overlay-${index}-info-badge`}
                {...overlay}
                fps={fps}
                sceneDuration={sceneDuration}
              />
            );
          case 'floating-label':
            return (
              <FloatingLabel
                key={`overlay-${index}-floating-label`}
                {...overlay}
                fps={fps}
                sceneDuration={sceneDuration}
              />
            );
          case 'source-citation':
            return (
              <SourceCitation
                key={`overlay-${index}-source-citation`}
                {...overlay}
                fps={fps}
                sceneDuration={sceneDuration}
              />
            );
          default:
            return null;
        }
      })}
    </AbsoluteFill>
  );
};
