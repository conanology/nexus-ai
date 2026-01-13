/**
 * ESLint configuration for NEXUS-AI monorepo.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    /**
     * Ban console.log usage - use structured logger instead.
     *
     * NEXUS-AI requires all logging to go through the structured logger
     * to ensure consistent log format with pipeline/stage context.
     *
     * @see packages/core/src/observability/logger.ts
     *
     * Use eslint-disable comment for legitimate exceptions (CLI tools):
     * // eslint-disable-next-line no-console
     * console.log('CLI output');
     */
    'no-console': 'error',

    // TypeScript handles these better
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // Allow explicit any for now, prefer strict typing
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.d.ts',
  ],
};
