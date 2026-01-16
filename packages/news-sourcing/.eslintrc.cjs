module.exports = {
  extends: ['../../packages/config/eslint.js'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
};
