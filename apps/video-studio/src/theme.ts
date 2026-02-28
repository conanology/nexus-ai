/**
 * NEXUS-AI Visual Language Theme (Premium Pass)
 *
 * Designed for high-end tech-news storytelling:
 * - deep cinematic dark base
 * - neon-lime brand anchor + cyan/violet premium accents
 * - clearer typography hierarchy
 */

export const THEME = {
  colors: {
    // Primary brand colors
    primary: '#AAFF00',
    primaryLight: '#C6FF4D',
    primaryDark: '#7BC800',

    // Secondary / tertiary accents (premium tech look)
    secondary: '#53D1FF',
    secondaryLight: '#8EE4FF',
    secondaryDark: '#1EA7D8',
    tertiary: '#9B8CFF',

    // Accent aliases
    accent: '#AAFF00',
    accentLight: '#C6FF4D',
    accentDark: '#7BC800',

    // Background (cinematic)
    background: '#090B10',
    backgroundLight: '#141923',
    backgroundDark: '#0F121A',

    // Text
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',

    // Semantic UI
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#53D1FF',

    // Data-viz palette
    chart: {
      blue: '#53D1FF',
      green: '#AAFF00',
      yellow: '#F59E0B',
      red: '#EF4444',
      purple: '#9B8CFF',
      cyan: '#22D3EE',
    },
  },

  fonts: {
    // Headline stack favors geometric premium display fonts
    heading: '"Sora", "Space Grotesk", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  fontSizes: {
    xs: 14,
    sm: 17,
    base: 25,
    lg: 34,
    xl: 45,
    '2xl': 59,
    '3xl': 67,
    '4xl': 84,
    '5xl': 101,
    '6xl': 112,
    '7xl': 134,
    '8xl': 157,
  },

  lineHeight: {
    tight: 1.0,
    cinematic: 1.1,
    normal: 1.25,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Safe area keeps critical text and badges away from crop zones
  safeArea: {
    horizontal: 96,
    vertical: 72,
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 6px 12px -2px rgba(0, 0, 0, 0.28)',
    lg: '0 14px 30px -8px rgba(0, 0, 0, 0.45)',
    xl: '0 24px 48px -12px rgba(0, 0, 0, 0.6)',
    glow: '0 0 24px rgba(170, 255, 0, 0.22)',
  },

  timing: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;

export type Theme = typeof THEME;
