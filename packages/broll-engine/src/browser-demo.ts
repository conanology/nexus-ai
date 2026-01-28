import type { BrowserBRollConfig } from '@nexus-ai/script-gen';
import type { BrowserDemoProps } from './types.js';

// TODO: Full implementation in Story 6-30
export function generateBrowserDemoProps(
  config: BrowserBRollConfig,
  _durationFrames: number,
): BrowserDemoProps {
  return {
    url: config.url,
    content: null,
    actions: config.actions,
    viewport: config.viewport,
    style: { theme: 'light' },
  };
}
