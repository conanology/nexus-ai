import type React from 'react';

/**
 * Target Color Palette — Nexus AI Premium Visual Pass
 */

export const COLORS = {
  // Background
  bgDeepDark: '#090B10',
  bgBase: '#0F121A',
  bgElevated: '#141923',

  // Accents
  accentPrimary: '#AAFF00',
  accentGlow: 'rgba(170, 255, 0, 0.22)',
  accentBright: '#C6FF4D',

  accentSecondary: '#53D1FF',
  accentSecondaryBright: '#8EE4FF',
  accentTertiary: '#9B8CFF',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',

  // Semantic
  warning: '#F59E0B',
  success: '#22C55E',
  error: '#EF4444',
} as const;

export const GRADIENTS = {
  background: 'linear-gradient(135deg, #090B10, #0F121A, #141923, #0F121A)',
  accent: 'linear-gradient(90deg, #AAFF00, #53D1FF)',
  glow: 'radial-gradient(circle, rgba(83,209,255,0.14), transparent)',
} as const;

/**
 * Convert a hex color to rgba with the given opacity.
 */
export function withOpacity(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  const fullHex = hex.length === 3
    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    : hex;
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Returns a background gradient string using the premium dark palette.
 */
export function gradientBg(angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${COLORS.bgDeepDark} 0%, ${COLORS.bgBase} 38%, ${COLORS.bgElevated} 68%, ${COLORS.bgBase} 100%)`;
}

/**
 * Generate a CSS text-shadow string for glow effects.
 */
export function textGlow(color: string, intensity: 'subtle' | 'medium' | 'strong' = 'subtle'): string {
  const rgba = withOpacity(color, 0.55);
  const rgbaOuter = withOpacity(color, 0.26);

  switch (intensity) {
    case 'subtle':
      return `0 0 5px ${rgba}, 0 2px 4px rgba(0,0,0,0.78)`;
    case 'medium':
      return `0 0 10px ${rgba}, 0 0 18px ${rgbaOuter}, 0 2px 4px rgba(0,0,0,0.82)`;
    case 'strong':
      return `0 0 14px ${rgba}, 0 0 28px ${rgbaOuter}, 0 0 42px ${withOpacity(color, 0.14)}, 0 2px 4px rgba(0,0,0,0.9)`;
  }
}

/** Base dark text shadow for readability on all text over images. */
export const TEXT_CONTRAST_SHADOW =
  '0 4px 20px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.3)';

/** White sticker outline — multi-direction text-shadow for bold "sticker" aesthetic */
export const STICKER_OUTLINE =
  '-3px -3px 0 rgba(255,255,255,0.95), ' +
  ' 3px -3px 0 rgba(255,255,255,0.95), ' +
  '-3px  3px 0 rgba(255,255,255,0.95), ' +
  ' 3px  3px 0 rgba(255,255,255,0.95), ' +
  ' 0 0 10px rgba(0,0,0,0.6)';

/**
 * Marker highlight — returns CSS for a colored background rectangle behind keywords.
 */
export function markerHighlight(color: string = COLORS.accentPrimary): React.CSSProperties {
  return {
    backgroundColor: withOpacity(color, 0.22),
    borderRadius: 6,
    padding: '2px 6px',
    marginLeft: -6,
    marginRight: -6,
  };
}
