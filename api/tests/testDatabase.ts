// Integration tests use their own database next to the dev one, never the demo data.
// Override with TEST_DATABASE_URL (e.g. in CI).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://tesla:tesla@localhost:5440/dhaka_tesla_test';

// Tests truncate tables, so refuse to run against anything that isn't clearly a test database.
export function assertTestDatabase(url: string | undefined) {
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error(`Refusing to use ${url} for tests: the database name must end in _test`);
  }
}
