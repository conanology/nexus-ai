/**
 * NEXUS-AI Visual Language Theme
 * Consistent color palette and typography for all visual components
 */

export const THEME = {
  colors: {
    // Primary brand colors — Cyan (target palette from VIDEO_SYSTEM_SPEC.md Section 4.2)
    primary: '#00d4ff', // Electric Cyan
    primaryLight: '#0ea5e9',
    primaryDark: '#0284c7',

    // Secondary colors
    secondary: '#8b5cf6', // Violet
    secondaryLight: '#a855f7',
    secondaryDark: '#7c3aed',

    // Accent colors
    accent: '#00d4ff', // Cyan (matches primary)
    accentLight: '#0ea5e9',
    accentDark: '#0284c7',

    // Background colors (dark mode default)
    background: '#0a0e1a', // Deep dark
    backgroundLight: '#1e293b', // Elevated
    backgroundDark: '#111827', // Base

    // Text colors
    text: '#ffffff', // Pure white
    textSecondary: '#94a3b8', // Slate 400
    textMuted: '#64748b', // Slate 500

    // UI colors
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    info: '#0ea5e9', // Sky

    // Chart/visualization colors
    chart: {
      blue: '#0ea5e9',
      green: '#10b981',
      yellow: '#f59e0b',
      red: '#ef4444',
      purple: '#8b5cf6',
      cyan: '#00d4ff',
    },
  },

  fonts: {
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  fontSizes: {
    xs: 20,      // source citations
    sm: 24,      // labels
    base: 36,    // body base (was 32)
    lg: 48,      // body lower (was 42)
    xl: 64,      // body upper (was 54)
    '2xl': 84,   // subheading (was 72)
    '3xl': 96,   // heading (was 86)
    '4xl': 120,  // large heading (was 96)
    '5xl': 144,  // stats (was 120)
    '6xl': 160,  // cold-open (was 140)
    '7xl': 192,  // impact (was 160)
    '8xl': 224,  // hero (was 192)
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

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(0, 212, 255, 0.3)',
  },

  // Animation timing
  timing: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;

export type Theme = typeof THEME;
