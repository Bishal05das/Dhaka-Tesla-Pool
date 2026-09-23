import { defineConfig } from 'prisma/config';

// Load api/.env for local CLI use; in Docker/Render the variables come from the environment.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fine
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
