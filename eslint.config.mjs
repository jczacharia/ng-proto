import baseConfig from './eslint.base.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
];
