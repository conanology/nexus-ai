/**
 * Font Loading System — loads Google Fonts via @remotion/google-fonts.
 *
 * Importing this module automatically injects CSS @font-face declarations.
 * No useEffect or Root.tsx changes needed.
 *
 * @module fonts
 */

import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';

// Inter for body and UI text
const interInfo = loadInter('normal', {
  weights: ['500', '700', '900'],
});

// JetBrains Mono for code and metrics
const jetBrainsInfo = loadJetBrainsMono('normal', {
  weights: ['400', '600'],
});

// Sora for premium display/headline look
const soraInfo = loadSora('normal', {
  weights: ['700', '800'],
});

/** Loaded font family references */
export const NEXUS_FONTS = {
  heading: soraInfo.fontFamily,
  body: interInfo.fontFamily,
  mono: jetBrainsInfo.fontFamily,
} as const;

/**
 * Get CSS font properties for a given usage context.
 */
export function getFontProps(usage: 'headline' | 'body' | 'label' | 'code'): {
  fontFamily: string;
  fontWeight: number;
  letterSpacing?: string;
} {
  switch (usage) {
    case 'headline':
      return { fontFamily: NEXUS_FONTS.heading, fontWeight: 800, letterSpacing: '-0.018em' };
    case 'body':
      return { fontFamily: NEXUS_FONTS.body, fontWeight: 700 };
    case 'label':
      return { fontFamily: NEXUS_FONTS.body, fontWeight: 500, letterSpacing: '0.01em' };
    case 'code':
      return { fontFamily: NEXUS_FONTS.mono, fontWeight: 600 };
  }
}
