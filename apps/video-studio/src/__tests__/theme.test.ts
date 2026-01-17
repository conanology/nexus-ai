import { describe, it, expect } from 'vitest';
import { THEME } from '../theme';

/**
 * Unit tests for theme configuration
 * Ensures theme consistency and completeness
 */
describe('NEXUS-AI Theme', () => {
  describe('Color Palette', () => {
    it('should have primary colors defined', () => {
      expect(THEME.colors.primary).toBeDefined();
      expect(THEME.colors.primaryLight).toBeDefined();
      expect(THEME.colors.primaryDark).toBeDefined();
    });

    it('should have secondary colors defined', () => {
      expect(THEME.colors.secondary).toBeDefined();
      expect(THEME.colors.secondaryLight).toBeDefined();
      expect(THEME.colors.secondaryDark).toBeDefined();
    });

    it('should have accent colors defined', () => {
      expect(THEME.colors.accent).toBeDefined();
      expect(THEME.colors.accentLight).toBeDefined();
      expect(THEME.colors.accentDark).toBeDefined();
    });

    it('should have background colors defined', () => {
      expect(THEME.colors.background).toBeDefined();
      expect(THEME.colors.backgroundLight).toBeDefined();
      expect(THEME.colors.backgroundDark).toBeDefined();
    });

    it('should have text colors defined', () => {
      expect(THEME.colors.text).toBeDefined();
      expect(THEME.colors.textSecondary).toBeDefined();
      expect(THEME.colors.textMuted).toBeDefined();
    });

    it('should have UI state colors defined', () => {
      expect(THEME.colors.success).toBeDefined();
      expect(THEME.colors.warning).toBeDefined();
      expect(THEME.colors.error).toBeDefined();
      expect(THEME.colors.info).toBeDefined();
    });

    it('should have chart colors defined', () => {
      expect(THEME.colors.chart.blue).toBeDefined();
      expect(THEME.colors.chart.green).toBeDefined();
      expect(THEME.colors.chart.yellow).toBeDefined();
      expect(THEME.colors.chart.red).toBeDefined();
      expect(THEME.colors.chart.purple).toBeDefined();
      expect(THEME.colors.chart.cyan).toBeDefined();
    });

    it('should use valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(THEME.colors.primary).toMatch(hexColorRegex);
      expect(THEME.colors.secondary).toMatch(hexColorRegex);
      expect(THEME.colors.accent).toMatch(hexColorRegex);
      expect(THEME.colors.background).toMatch(hexColorRegex);
    });
  });

  describe('Typography', () => {
    it('should have font families defined', () => {
      expect(THEME.fonts.heading).toBeDefined();
      expect(THEME.fonts.body).toBeDefined();
      expect(THEME.fonts.mono).toBeDefined();
    });

    it('should have font sizes defined', () => {
      expect(THEME.fontSizes.xs).toBeDefined();
      expect(THEME.fontSizes.sm).toBeDefined();
      expect(THEME.fontSizes.base).toBeDefined();
      expect(THEME.fontSizes.lg).toBeDefined();
      expect(THEME.fontSizes.xl).toBeDefined();
      expect(THEME.fontSizes['2xl']).toBeDefined();
      expect(THEME.fontSizes['8xl']).toBeDefined();
    });

    it('should have consistent font size scale', () => {
      expect(THEME.fontSizes.xs).toBeLessThan(THEME.fontSizes.sm);
      expect(THEME.fontSizes.sm).toBeLessThan(THEME.fontSizes.base);
      expect(THEME.fontSizes.base).toBeLessThan(THEME.fontSizes.lg);
      expect(THEME.fontSizes.lg).toBeLessThan(THEME.fontSizes.xl);
    });
  });

  describe('Spacing', () => {
    it('should have spacing scale defined', () => {
      expect(THEME.spacing.xs).toBeDefined();
      expect(THEME.spacing.sm).toBeDefined();
      expect(THEME.spacing.md).toBeDefined();
      expect(THEME.spacing.lg).toBeDefined();
      expect(THEME.spacing.xl).toBeDefined();
      expect(THEME.spacing['3xl']).toBeDefined();
    });

    it('should have consistent spacing scale', () => {
      expect(THEME.spacing.xs).toBeLessThan(THEME.spacing.sm);
      expect(THEME.spacing.sm).toBeLessThan(THEME.spacing.md);
      expect(THEME.spacing.md).toBeLessThan(THEME.spacing.lg);
      expect(THEME.spacing.lg).toBeLessThan(THEME.spacing.xl);
    });
  });

  describe('Border Radius', () => {
    it('should have border radius values defined', () => {
      expect(THEME.borderRadius.sm).toBeDefined();
      expect(THEME.borderRadius.md).toBeDefined();
      expect(THEME.borderRadius.lg).toBeDefined();
      expect(THEME.borderRadius.xl).toBeDefined();
      expect(THEME.borderRadius.full).toBeDefined();
    });

    it('should have full border radius as maximum', () => {
      expect(THEME.borderRadius.full).toBeGreaterThan(THEME.borderRadius.xl);
    });
  });

  describe('Shadows', () => {
    it('should have shadow definitions', () => {
      expect(THEME.shadows.sm).toBeDefined();
      expect(THEME.shadows.md).toBeDefined();
      expect(THEME.shadows.lg).toBeDefined();
      expect(THEME.shadows.xl).toBeDefined();
      expect(THEME.shadows.glow).toBeDefined();
    });
  });

  describe('Animation Timing', () => {
    it('should have timing values defined', () => {
      expect(THEME.timing.fast).toBeDefined();
      expect(THEME.timing.normal).toBeDefined();
      expect(THEME.timing.slow).toBeDefined();
    });

    it('should have consistent timing scale', () => {
      expect(THEME.timing.fast).toBeLessThan(THEME.timing.normal);
      expect(THEME.timing.normal).toBeLessThan(THEME.timing.slow);
    });
  });
});
