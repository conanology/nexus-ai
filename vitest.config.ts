import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXUS_PROJECT_ID: 'test-project',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
});
