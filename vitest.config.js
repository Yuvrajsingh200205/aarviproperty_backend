const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: 'forks',
  },
});
