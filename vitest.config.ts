import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app.ts', 'routes/**/*.ts', 'crypto/**/*.ts'],
    },
    // Increase timeout for crypto operations (PBKDF2 is slow by design)
    testTimeout: 30_000,
  },
});
