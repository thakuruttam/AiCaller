import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: './test/globalSetup.js',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
