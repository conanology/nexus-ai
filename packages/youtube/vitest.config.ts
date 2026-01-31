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
      '@nexus-ai/news-sourcing': new URL('../news-sourcing/src/index.ts', import.meta.url).pathname,
    },
  },
});
