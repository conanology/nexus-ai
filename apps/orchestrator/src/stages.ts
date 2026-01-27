// Stage registry and imports
// NOTE: render is handled via visual-gen (calls render-service)

import { executeNewsSourcing } from '@nexus-ai/news-sourcing';
import { executeResearch } from '@nexus-ai/research';
import { executeScriptGen } from '@nexus-ai/script-gen';
import { executePronunciation } from '@nexus-ai/pronunciation';
import { executeTTS } from '@nexus-ai/tts';
import { executeVisualGen } from '@nexus-ai/visual-gen';
import { executeThumbnail } from '@nexus-ai/thumbnail';
import { executeYouTubeUpload } from '@nexus-ai/youtube';
import { executeTwitter } from '@nexus-ai/twitter';
import { executeNotifications } from '@nexus-ai/notifications';
import { executeTimestampExtraction } from '@nexus-ai/timestamp-extraction';

export type StageExecutor = (input: any) => Promise<any>;

export const stageRegistry: Record<string, StageExecutor> = {
  'news-sourcing': executeNewsSourcing,
  'research': executeResearch,
  'script-gen': executeScriptGen,
  'pronunciation': executePronunciation,
  'tts': executeTTS,
  'timestamp-extraction': executeTimestampExtraction,
  'visual-gen': executeVisualGen,
  'render': executeVisualGen, // render is called internally by visual-gen
  'thumbnail': executeThumbnail,
  'youtube': executeYouTubeUpload,
  'twitter': executeTwitter,
  'notifications': executeNotifications,
};

// Stage execution order - render is embedded in visual-gen, notifications added as stub
export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'timestamp-extraction',
  'visual-gen',
  // 'render' is not a separate stage - visual-gen calls render-service internally
  'thumbnail',
  'youtube',
  'twitter',
  'notifications', // Always runs last, even on pipeline failures (FR45, NFR4)
];
