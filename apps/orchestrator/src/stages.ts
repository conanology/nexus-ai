// Stage registry and imports
// NOTE: render is handled via visual-gen (calls render-service)
// NOTE: notifications will be added in Story 5.4

import { executeNewsSourcing } from '@nexus-ai/news-sourcing';
import { executeResearch } from '@nexus-ai/research';
import { executeScriptGen } from '@nexus-ai/script-gen';
import { executePronunciation } from '@nexus-ai/pronunciation';
import { executeTTS } from '@nexus-ai/tts';
import { executeVisualGen } from '@nexus-ai/visual-gen';
import { executeThumbnail } from '@nexus-ai/thumbnail';
import { executeYouTubeUpload } from '@nexus-ai/youtube';
import { executeTwitter } from '@nexus-ai/twitter';
import type { StageInput, StageOutput } from '@nexus-ai/core';

export type StageExecutor = (input: any) => Promise<any>;

// Stub for notifications stage (will be implemented in Story 5.4)
const executeNotificationsStub: StageExecutor = async (_input: StageInput<any>): Promise<StageOutput<any>> => {
  // Placeholder implementation - sends no notifications but returns success
  return {
    success: true,
    data: {
      emailSent: false,
      discordSent: false,
      message: 'Notifications stage not yet implemented (Story 5.4)',
    },
    quality: {
      stage: 'notifications',
      timestamp: new Date().toISOString(),
      measurements: {},
    },
    cost: {
      stage: 'notifications',
      totalCost: 0,
      breakdown: [],
      timestamp: new Date().toISOString(),
    },
    durationMs: 10,
    provider: {
      name: 'stub',
      tier: 'primary' as const,
      attempts: 1,
    },
  };
};

export const stageRegistry: Record<string, StageExecutor> = {
  'news-sourcing': executeNewsSourcing,
  'research': executeResearch,
  'script-gen': executeScriptGen,
  'pronunciation': executePronunciation,
  'tts': executeTTS,
  'visual-gen': executeVisualGen,
  'render': executeVisualGen, // render is called internally by visual-gen
  'thumbnail': executeThumbnail,
  'youtube': executeYouTubeUpload,
  'twitter': executeTwitter,
  'notifications': executeNotificationsStub,
};

// Stage execution order - render is embedded in visual-gen, notifications added as stub
export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'visual-gen',
  // 'render' is not a separate stage - visual-gen calls render-service internally
  'thumbnail',
  'youtube',
  'twitter',
  'notifications', // Stub implementation until Story 5.4
];
