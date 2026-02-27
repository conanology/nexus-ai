import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const nexusAlias = [
  {
    find: /^@nexus-ai\/([^/]+)$/,
    replacement: `${workspaceRoot}packages/$1/src/index.ts`,
  },
  {
    find: /^@nexus-ai\/([^/]+)\/(.*)$/,
    replacement: `${workspaceRoot}packages/$1/src/$2`,
  },
];

export default defineConfig({
  resolve: { alias: nexusAlias },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
});
