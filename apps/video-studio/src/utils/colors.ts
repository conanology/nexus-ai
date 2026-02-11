/**
 * Target Color Palette — Nexus AI Brand
 *
 * From VIDEO_SYSTEM_SPEC.md Section 4.2.
 * Canonical color source for all scene components.
 * theme.ts has been migrated to match this palette (Phase 10).
 */

export const COLORS = {
  // Background
  bgDeepDark: '#0a0e1a',
  bgBase: '#111827',
  bgElevated: '#1e293b',

  // Accent Primary
  accentPrimary: '#00d4ff',
  accentGlow: 'rgba(0, 212, 255, 0.3)',
  accentBright: '#0ea5e9',

  // Accent Secondary
  accentSecondary: '#8b5cf6',
  accentSecondaryBright: '#a855f7',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Emphasis
  warning: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
} as const;

export const GRADIENTS = {
  background: 'linear-gradient(135deg, #0a0e1a, #111827, #0a0e1a)',
  accent: 'linear-gradient(90deg, #00d4ff, #8b5cf6)',
  glow: 'radial-gradient(circle, rgba(0,212,255,0.15), transparent)',
} as const;

/**
 * Convert a hex color to rgba with the given opacity.
 * Accepts 3-digit (#abc) or 6-digit (#aabbcc) hex strings.
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
 * Returns a background gradient string using the target dark palette.
 * @param angle - Gradient angle in degrees (default 135)
 */
export function gradientBg(angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${COLORS.bgDeepDark} 0%, ${COLORS.bgBase} 40%, ${COLORS.bgElevated} 70%, ${COLORS.bgBase} 100%)`;
}

/**
 * Generate a CSS text-shadow string for glow effects.
 *
 * @param color  - Glow color (hex)
 * @param intensity - 'subtle' (readability), 'medium' (emphasis), 'strong' (dramatic)
 * @returns CSS text-shadow value
 */
export function textGlow(color: string, intensity: 'subtle' | 'medium' | 'strong' = 'subtle'): string {
  const rgba = withOpacity(color, 0.6);
  const rgbaOuter = withOpacity(color, 0.3);

  switch (intensity) {
    case 'subtle':
      return `0 0 6px ${rgba}, 0 2px 4px rgba(0,0,0,0.8)`;
    case 'medium':
      return `0 0 10px ${rgba}, 0 0 20px ${rgbaOuter}, 0 2px 4px rgba(0,0,0,0.8)`;
    case 'strong':
      return `0 0 15px ${rgba}, 0 0 30px ${rgbaOuter}, 0 0 45px ${withOpacity(color, 0.15)}, 0 2px 4px rgba(0,0,0,0.9)`;
  }
}

/** Base dark text shadow for readability on all text over images. */
export const TEXT_CONTRAST_SHADOW = '0 2px 4px rgba(0,0,0,0.8)';
