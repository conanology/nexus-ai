/**
 * Target Color Palette — Nexus AI Brand
 *
 * From VIDEO_SYSTEM_SPEC.md Section 4.2.
 * These are the TARGET colors for the new scene system.
 * theme.ts is NOT modified — the full theme migration happens in Phase 10.
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
  return `linear-gradient(${angle}deg, ${COLORS.bgDeepDark}, ${COLORS.bgBase}, ${COLORS.bgDeepDark})`;
}
