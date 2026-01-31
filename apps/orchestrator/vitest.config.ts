import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/__tests__/**', '**/dist/**'],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@nexus-ai/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/news-sourcing': new URL('../../packages/news-sourcing/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/research': new URL('../../packages/research/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/script-gen': new URL('../../packages/script-gen/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/pronunciation': new URL('../../packages/pronunciation/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/tts': new URL('../../packages/tts/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/timestamp-extraction': new URL('../../packages/timestamp-extraction/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/visual-gen': new URL('../../packages/visual-gen/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/thumbnail': new URL('../../packages/thumbnail/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/youtube': new URL('../../packages/youtube/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/twitter': new URL('../../packages/twitter/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/notifications': new URL('../../packages/notifications/src/index.ts', import.meta.url).pathname,
    },
  },
});
