/**
 * NEXUS-AI Visual Language Theme
 * Consistent color palette and typography for all visual components
 */

export const THEME = {
  colors: {
    // Primary brand colors — Neon Hacker palette
    primary: '#aaff00', // Neon Green
    primaryLight: '#88cc00',
    primaryDark: '#669900',

    // Secondary colors — unified Neon Green
    secondary: '#88cc00',
    secondaryLight: '#aaff00',
    secondaryDark: '#669900',

    // Accent colors
    accent: '#aaff00', // Neon Green
    accentLight: '#88cc00',
    accentDark: '#669900',

    // Background colors (dark mode default) — Deep Black
    background: '#0a0a0a', // Deep dark
    backgroundLight: '#1a1a1a', // Elevated
    backgroundDark: '#111111', // Base

    // Text colors
    text: '#ffffff', // Pure white
    textSecondary: '#94a3b8', // Slate 400
    textMuted: '#64748b', // Slate 500

    // UI colors
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    info: '#88cc00', // Neon Green

    // Chart/visualization colors
    chart: {
      blue: '#aaff00',
      green: '#aaff00',
      yellow: '#f59e0b',
      red: '#ef4444',
      purple: '#88cc00',
      cyan: '#aaff00',
    },
  },

  fonts: {
    /** Inter — regular text, labels, headings */
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    /** Inter — body text */
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    /** JetBrains Mono — numbers, stats, code */
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  fontSizes: {
    xs: 14,      // source citations
    sm: 17,      // labels
    base: 25,    // body base
    lg: 34,      // body lower
    xl: 45,      // body upper
    '2xl': 59,   // subheading
    '3xl': 67,   // heading
    '4xl': 84,   // large heading
    '5xl': 101,  // stats
    '6xl': 112,  // cold-open
    '7xl': 134,  // impact
    '8xl': 157,  // hero
  },

  lineHeight: {
    tight: 1.0,     // stat numbers, impact text
    cinematic: 1.1,  // headings, emphasis
    normal: 1.25,    // body text
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
    glow: '0 0 20px rgba(170, 255, 0, 0.3)',
  },

  // Animation timing
  timing: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;

export type Theme = typeof THEME;
