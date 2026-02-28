import { RenderService } from '../apps/render-service/src/render.js';

const topicSlug = process.argv[2] ?? 'claude-sonnet-4-6';
const pipelineId = process.argv[3] ?? 'offline-replay-claude';
const timelineFile = process.argv[4] ?? 'scenes-enriched.json';

async function main() {
  process.env.STORAGE_MODE = process.env.STORAGE_MODE ?? 'local';
  process.env.LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH ?? './local-storage';
  const svc = new RenderService();
  const input = {
    pipelineId,
    timelineUrl: topicSlug + '/' + timelineFile,
    audioUrl: topicSlug + '/audio.wav',
    resolution: '1080p',
  };

  const result = await svc.renderVideo(input, (progress) => {
    if (progress.includes('Bundling') || progress.includes('Rendering') || progress.includes('Uploading')) {
      console.log('[progress]', progress);
    }
  });

  console.log(JSON.stringify({ topicSlug, pipelineId, timelineFile, result }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
