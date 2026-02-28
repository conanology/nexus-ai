import fs from 'fs';
import path from 'path';
import type { Scene } from '@nexus-ai/director-agent';
import { enrichScenesWithSourceMetadata } from '../packages/visual-gen/src/source-metadata-enricher.js';

const slug = process.argv[2] ?? 'claude-sonnet-4-6';
const inPath = path.join('local-storage', slug, 'scenes-enriched.json');
const outPath = path.join('local-storage', slug, 'scenes-enriched-sourcepack-url.json');

const curatedSources = [
  { title: 'OpenAI GPT-4.1 launch', url: 'https://openai.com/index/introducing-gpt-4-1/' },
  { title: 'Anthropic Claude Sonnet 4.6 release', url: 'https://www.anthropic.com/news/claude-sonnet-4-6' },
  { title: 'Google DeepMind Gemini', url: 'https://deepmind.google/technologies/gemini/' },
  { title: 'Gemini API docs', url: 'https://ai.google.dev/gemini-api/docs' },
  { title: 'OpenAI tweet GPT-4.1 in ChatGPT', url: 'https://x.com/OpenAI/status/1922707554745909391' },
  { title: 'OpenAI Devs tweet GPT-4.1 family', url: 'https://x.com/OpenAIDevs/status/1911859780236214426' },
  { title: 'Anthropic tweet web search', url: 'https://x.com/AnthropicAI/status/1902765011727999046' },
  { title: 'Anthropic tweet Claude 3.7', url: 'https://x.com/AnthropicAI/status/1894092430560965029' },
  { title: 'OpenAI Python SDK repo', url: 'https://github.com/openai/openai-python' },
  { title: 'Anthropic Python SDK repo', url: 'https://github.com/anthropics/anthropic-sdk-python' },
  { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762' },
  { title: 'HF Transformers docs', url: 'https://huggingface.co/docs/transformers/index' },
] as const;

const excluded = new Set(['intro','outro','chapter-break','code-block','meme-reaction','map-animation']);

function previewUrl(sourceUrl: string): string {
  const target = sourceUrl.includes('x.com/') ? sourceUrl.replace('https://x.com/','https://vxtwitter.com/') : sourceUrl;
  return 'https://image.thum.io/get/width/1920/noanimate/' + target;
}

async function main() {
  if (!fs.existsSync(inPath)) throw new Error('Input not found: ' + inPath);
  const payload = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const scenes: Scene[] = payload.scenes ?? [];

  let idx = 0;
  for (const scene of scenes) {
    if (idx >= curatedSources.length) break;
    if (excluded.has(scene.type)) continue;

    const src = curatedSources[idx];
    scene.sourceUrl = src.url;
    scene.visualSource = 'source-screenshot';
    scene.screenshotImage = previewUrl(src.url);
    scene.screenshotDisplayMode = idx % 2 === 0 ? 'foreground' : 'background';
    scene.highlightText = src.title.split(' ').slice(0, 4).join(' ');
    idx += 1;
  }

  await enrichScenesWithSourceMetadata(scenes);

  const out = { ...payload, scenes };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  const assigned = scenes.filter((s) => s.visualSource === 'source-screenshot' && typeof s.screenshotImage === 'string' && s.screenshotImage.startsWith('https://image.thum.io/'));
  const previewRows = assigned.slice(0, 20).map((s) => ({
    id: s.id,
    type: s.type,
    sourceUrl: s.sourceUrl,
    preview: s.screenshotImage,
    sourceKind: s.sourceMetadata?.sourceKind,
  }));

  const reportPath = path.join('output', slug, 'sourcepack-url-preview.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ slug, outPath, assignedCount: assigned.length, previewRows }, null, 2));

  console.log(JSON.stringify({ slug, outPath, reportPath, assignedCount: assigned.length }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
