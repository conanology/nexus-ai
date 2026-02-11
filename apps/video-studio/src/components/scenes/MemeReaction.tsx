import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Gif } from '@remotion/gif';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MemeReaction — short 1-1.5 second GIF clip for humor and engagement.
 *
 * Renders a reaction GIF against pure black background with a dark vignette,
 * punchy spring entrance, and quick fade out. Uses @remotion/gif for
 * frame-synced GIF playback. Designed as a sharp CUT between content scenes.
 */
export const MemeReaction: React.FC<SceneComponentProps<'meme-reaction'>> = ({
  visualData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { gifSrc } = visualData;

  // --- Entrance: punchy spring scale 0.85 → 1.0 over first ~4-5 frames ---
  const entranceScale = spring({
    frame,
    fps,
    config: { stiffness: 300, damping: 20, mass: 1 },
    from: 0.85,
    to: 1.0,
  });

  // --- Exit: quick fade out over last 4 frames ---
  const exitOpacity = interpolate(
    frame,
    [28, 36],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (!gifSrc) return <AbsoluteFill style={{ backgroundColor: '#000000' }} />;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* GIF container — centered, max 70% of frame */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${entranceScale})`,
          width: 1344, // 70% of 1920
          height: 756, // 70% of 1080
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: exitOpacity,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            width: '100%',
            height: '100%',
          }}
        >
          <Gif
            src={gifSrc}
            width={1344}
            height={756}
            fit="contain"
          />
        </div>
      </div>

      {/* Dark vignette overlay — blends GIF edges with black background */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
