import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';

export interface GlowEffectProps {
  color?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  size?: number;
  pulse?: boolean;
  position?: { x: number; y: number };
}

const INTENSITY_MAP: Record<'subtle' | 'medium' | 'strong', number> = {
  subtle: 0.15,
  medium: 0.3,
  strong: 0.5,
};

export const GlowEffect: React.FC<GlowEffectProps> = ({
  color = COLORS.accentPrimary,
  intensity = 'medium',
  size = 200,
  pulse = true,
  position,
}) => {
  const frame = useCurrentFrame();

  const baseOpacity = INTENSITY_MAP[intensity];

  // Slow sine wave: ~4-second cycle at 30fps (120 frames)
  const pulseOffset = pulse
    ? Math.sin((frame * 2 * Math.PI) / 120) * baseOpacity * 0.3
    : 0;

  const finalOpacity = baseOpacity + pulseOffset;

  const posX = position?.x ?? 50;
  const posY = position?.y ?? 50;

  return (
    <div
      style={{
        position: 'absolute',
        width: size * 2,
        height: size * 2,
        left: `calc(${posX}% - ${size}px)`,
        top: `calc(${posY}% - ${size}px)`,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${withOpacity(color, finalOpacity)}, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
};
