import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/__tests__/**', '**/dist/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@nexus-ai/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/script-gen': new URL('../script-gen/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/audio-mixer': new URL('../audio-mixer/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/timestamp-extraction': new URL('../timestamp-extraction/src/index.ts', import.meta.url).pathname,
    },
  },
});
