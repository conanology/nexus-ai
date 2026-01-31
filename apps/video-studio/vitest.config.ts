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
      '@nexus-ai/broll-engine': new URL('../../packages/broll-engine/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/script-gen': new URL('../../packages/script-gen/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/visual-gen': new URL('../../packages/visual-gen/src/index.ts', import.meta.url).pathname,
    },
  },
});
