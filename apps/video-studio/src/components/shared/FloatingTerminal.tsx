import React from 'react';
import { Img, useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';

interface FloatingTerminalProps {
  src?: string;
  children?: React.ReactNode;
  width?: number;
  height?: number;
  rotateX?: number;
  rotateY?: number;
  style?: React.CSSProperties;
}

export const FloatingTerminal: React.FC<FloatingTerminalProps> = ({
  src,
  children,
  width = 1400,
  height = 800,
  rotateX = 8,
  rotateY = -5,
  style,
}) => {
  const frame = useCurrentFrame();
  const float = interpolate(frame % 120, [0, 60, 120], [0, -6, 0]);

  return (
    <div
      style={{
        perspective: 1200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        ...style,
      }}
    >
      <div
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${float}px)`,
          borderRadius: 12,
          overflow: 'hidden',
          border: `2px solid ${COLORS.accentPrimary}`,
          boxShadow: `0 0 30px ${COLORS.accentGlow}, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Terminal chrome bar */}
        <div
          style={{
            height: 32,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28c840' }} />
        </div>
        {children ?? (
          src ? <Img src={src} style={{ width, height, objectFit: 'cover', display: 'block' }} /> : null
        )}
      </div>
    </div>
  );
};
