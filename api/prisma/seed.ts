// Seeds the route line and the story cast. Safe to run repeatedly (upserts only),
// so the Docker entrypoint can run it on every start.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDemoData } from './seed-data.js';

try {
  process.loadEnvFile();
} catch {
  // variables come from the environment
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

seedDemoData(prisma)
  .then(() => console.log('Seeded route stops, Nusrat, Rafiq, Shirin, Jashim and Bullet.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
