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

// Load Inter with weights 500 (medium), 700 (bold), and 900 (black)
const interInfo = loadInter('normal', {
  weights: ['500', '700', '900'],
});

// Load JetBrains Mono weight 400 (regular) for code
const jetBrainsInfo = loadJetBrainsMono('normal', {
  weights: ['400'],
});

/** Loaded font family references */
export const NEXUS_FONTS = {
  heading: interInfo.fontFamily,
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
      return { fontFamily: NEXUS_FONTS.heading, fontWeight: 900, letterSpacing: '-0.02em' };
    case 'body':
      return { fontFamily: NEXUS_FONTS.body, fontWeight: 700 };
    case 'label':
      return { fontFamily: NEXUS_FONTS.body, fontWeight: 500 };
    case 'code':
      return { fontFamily: NEXUS_FONTS.mono, fontWeight: 400 };
  }
}
