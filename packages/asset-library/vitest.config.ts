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
  },
});
