import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/__tests__/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@nexus-ai/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/script-gen': new URL('../script-gen/src/index.ts', import.meta.url).pathname,
    },
  },
});
