import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXUS_PROJECT_ID: 'test-project',
    },
  },
});
