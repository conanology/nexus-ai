// Stage registry and imports
// NOTE: @nexus-ai/notifications will be created in Story 5.4

import { executeNewsSourcing } from '@nexus-ai/news-sourcing';
import { executeResearch } from '@nexus-ai/research';
import { executeScriptGen } from '@nexus-ai/script-gen';
import { executePronunciation } from '@nexus-ai/pronunciation';
import { executeTTS } from '@nexus-ai/tts';
import { executeVisualGen } from '@nexus-ai/visual-gen';
import { executeThumbnail } from '@nexus-ai/thumbnail';
import { executeYouTubeUpload } from '@nexus-ai/youtube';
import { executeTwitter } from '@nexus-ai/twitter';

export type StageExecutor = (input: any) => Promise<any>;

export const stageRegistry: Record<string, StageExecutor> = {
  'news-sourcing': executeNewsSourcing,
  'research': executeResearch,
  'script-gen': executeScriptGen,
  'pronunciation': executePronunciation,
  'tts': executeTTS,
  'visual-gen': executeVisualGen,
  'thumbnail': executeThumbnail,
  'youtube': executeYouTubeUpload,
  'twitter': executeTwitter,
  // notifications will be added in Story 5.4
};

// Stage execution order (used in Story 5.2)
export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'visual-gen',
  'thumbnail',
  'youtube',
  'twitter',
  // 'notifications' will be added in Story 5.4
];
