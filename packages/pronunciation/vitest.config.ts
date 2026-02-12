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
      '@nexus-ai/core/types': new URL('../core/src/types/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/errors': new URL('../core/src/errors/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/storage': new URL('../core/src/storage/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/secrets': new URL('../core/src/secrets/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/observability': new URL('../core/src/observability/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/utils': new URL('../core/src/utils/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/providers': new URL('../core/src/providers/index.ts', import.meta.url).pathname,
      '@nexus-ai/core/quality': new URL('../core/src/quality/index.ts', import.meta.url).pathname,
      '@nexus-ai/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@nexus-ai/script-gen': new URL('../script-gen/src/index.ts', import.meta.url).pathname,
    },
  },
});
