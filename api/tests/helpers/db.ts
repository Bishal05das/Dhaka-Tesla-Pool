import { seedDemoData } from '../../prisma/seed-data.js';
import { prisma } from '../../src/lib/prisma.js';
import { assertTestDatabase } from '../testDatabase.js';

// Wipe every table and reseed the story cast, so each test file starts from the demo state.
export async function resetDatabase() {
  assertTestDatabase(process.env.DATABASE_URL);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  await seedDemoData(prisma);
}
