import React from 'react';
import { COLORS } from '../../utils/colors.js';

interface GlassPanelProps {
  opacity?: number;
  blurRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  opacity = 0.15,
  blurRadius = 12,
  borderColor = COLORS.accentPrimary,
  borderWidth = 1,
  borderRadius = 12,
  children,
  style,
}) => {
  return (
    <div
      style={{
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        backdropFilter: `blur(${blurRadius}px)`,
        WebkitBackdropFilter: `blur(${blurRadius}px)`,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
