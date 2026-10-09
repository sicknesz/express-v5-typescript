import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/app.ts', 'src/server.ts', 'src/routes/**/*.ts', 'src/crypto/**/*.ts'],
    },
    // Increase timeout for crypto operations (PBKDF2 is slow by design)
    testTimeout: 30_000,
  },
});
