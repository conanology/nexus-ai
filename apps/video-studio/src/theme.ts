/**
 * NEXUS-AI Visual Language Theme
 * Consistent color palette and typography for all visual components
 */

export const THEME = {
  colors: {
    // Primary brand colors
    primary: '#6366f1', // Indigo - Brand Blue/Purple
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',

    // Secondary colors
    secondary: '#8b5cf6', // Violet
    secondaryLight: '#a78bfa',
    secondaryDark: '#7c3aed',

    // Accent colors
    accent: '#06b6d4', // Cyan
    accentLight: '#22d3ee',
    accentDark: '#0891b2',

    // Background colors (dark mode default)
    background: '#0f172a', // Slate 900
    backgroundLight: '#1e293b', // Slate 800
    backgroundDark: '#020617', // Slate 950

    // Text colors
    text: '#f8fafc', // Slate 50
    textSecondary: '#cbd5e1', // Slate 300
    textMuted: '#94a3b8', // Slate 400

    // UI colors
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    info: '#3b82f6', // Blue

    // Chart/visualization colors
    chart: {
      blue: '#3b82f6',
      green: '#10b981',
      yellow: '#f59e0b',
      red: '#ef4444',
      purple: '#8b5cf6',
      cyan: '#06b6d4',
    },
  },

  fonts: {
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
    '8xl': 96,
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
    glow: '0 0 20px rgba(99, 102, 241, 0.5)',
  },

  // Animation timing
  timing: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;

export type Theme = typeof THEME;
