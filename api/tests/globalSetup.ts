import { execSync } from 'node:child_process';
import pg from 'pg';
import { assertTestDatabase, TEST_DATABASE_URL } from './testDatabase.js';

// Once per test run: make sure the test database exists and has every migration applied,
// so tests always run against the real schema, including the hand-written constraints.
// `migrate deploy` only applies pending migrations; it never drops data.
export default async function setup() {
  assertTestDatabase(TEST_DATABASE_URL);
  await createDatabaseIfMissing(TEST_DATABASE_URL);
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

async function createDatabaseIfMissing(url: string) {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
}
