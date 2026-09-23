#!/bin/sh
# Apply pending migrations, optionally seed, then start the API.
# Migrations are idempotent (already-applied ones are skipped) and the seed only upserts,
# so restarting the container is always safe.
set -e

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding demo data..."
  node dist/prisma/seed.js
fi

# exec replaces the shell, so node becomes PID 1 and receives SIGTERM directly.
exec node dist/src/server.js
