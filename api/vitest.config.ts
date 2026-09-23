import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/testDatabase.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-at-least-32-characters-long',
      COOKIE_SECURE: 'false',
      // Tests sign in many times from one IP; the limiter itself is tested separately.
      AUTH_RATE_LIMIT_MAX: '10000',
    },
    // Integration tests share one database, so test files run one at a time.
    fileParallelism: false,
  },
});
