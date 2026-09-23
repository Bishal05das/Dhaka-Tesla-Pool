// Seeds the route line and the story cast. Safe to run repeatedly (upserts only),
// so the Docker entrypoint can run it on every start.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';

try {
  process.loadEnvFile();
} catch {
  // variables come from the environment
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Documented in the README as demo credentials. Not a secret: seed data only.
const DEMO_PASSWORD = 'tesla1234';

// The single route line. Distances are whole km so fares can be checked by hand
// (docs/domain-rules.md#fare).
const STOPS = [
  { sequence: 0, name: 'Banani', km: 0, lat: 23.7937, lng: 90.4066 },
  { sequence: 1, name: 'Mohakhali', km: 3, lat: 23.778, lng: 90.405 },
  { sequence: 2, name: 'Gulshan 1', km: 5, lat: 23.7806, lng: 90.4163 },
  { sequence: 3, name: 'Gulshan 2', km: 7, lat: 23.7925, lng: 90.415 },
  { sequence: 4, name: 'Bashundhara', km: 10, lat: 23.8193, lng: 90.4526 },
];

const PASSENGERS = [
  { name: 'Nusrat', email: 'nusrat@dhakatesla.test' },
  { name: 'Rafiq', email: 'rafiq@dhakatesla.test' },
  { name: 'Shirin', email: 'shirin@dhakatesla.test' },
];

const DRIVER = { name: 'Jashim', email: 'jashim@dhakatesla.test' };
const BULLET = { name: 'Bullet', plate: 'DHAKA-TESLA-11', capacity: 3 };

const STARTING_WALLET_POISHA = 50_000; // ৳500

async function main() {
  for (const stop of STOPS) {
    const data = {
      sequence: stop.sequence,
      distanceFromStartM: stop.km * 1000,
      lat: stop.lat,
      lng: stop.lng,
    };
    await prisma.stop.upsert({ where: { name: stop.name }, update: data, create: { name: stop.name, ...data } });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const p of PASSENGERS) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, passwordHash, role: Role.PASSENGER },
    });
    // update: {} keeps a balance that changed during a demo.
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, balancePoisha: STARTING_WALLET_POISHA },
    });
  }

  const jashim = await prisma.user.upsert({
    where: { email: DRIVER.email },
    update: {},
    create: { ...DRIVER, passwordHash, role: Role.DRIVER },
  });
  await prisma.vehicle.upsert({
    where: { driverId: jashim.id },
    update: {},
    create: { ...BULLET, driverId: jashim.id },
  });

  console.log(`Seeded ${STOPS.length} stops, ${PASSENGERS.length} passengers, Jashim and Bullet.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
