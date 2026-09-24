import type { PoolStatus, RideStatus } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';

// Requests are refused while no Tesla is online, so most tests start with Jashim online.
export async function bulletOnline(online = true) {
  await prisma.vehicle.update({ where: { plate: 'DHAKA-TESLA-11' }, data: { isOnline: online } });
}

// Puts existing ride requests straight into a pool on Bullet, bypassing the driver API.
// For testing passenger-side rules (like cancelling) in isolation from the driver flow.
export async function putInBulletsPool(rideIds: string[], status: PoolStatus = 'MATCHED') {
  const bullet = await prisma.vehicle.findUniqueOrThrow({ where: { plate: 'DHAKA-TESLA-11' } });
  const rides = await prisma.rideRequest.findMany({ where: { id: { in: rideIds } } });
  const seats = rides.reduce((sum, r) => sum + r.seats, 0);

  const pool = await prisma.pool.create({
    data: {
      vehicleId: bullet.id,
      capacity: bullet.capacity,
      seatsOccupied: seats,
      status,
      members: { create: rides.map((r) => ({ rideRequestId: r.id, seats: r.seats })) },
    },
  });
  await prisma.rideRequest.updateMany({
    where: { id: { in: rideIds } },
    data: { status: status as RideStatus },
  });
  return pool.id;
}
