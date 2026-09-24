import { assertCanJoin, seatsFree } from '../../domain/matching.js';
import type { PoolStatus } from '../../generated/prisma/enums.js';
import { conflict, notFound } from '../../lib/errors.js';
import { lockPool, lockVehicleOfDriver } from '../../lib/locks.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { driverPoolInclude, openRequestSelect, presentOpenRequest, presentPool } from './driver.presenter.js';

export const ACTIVE_POOL_STATUSES: PoolStatus[] = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'];

export async function getVehicle(driverId: string, db: Tx | typeof prisma = prisma) {
  const vehicle = await db.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw notFound('No Tesla registered for this driver');
  return vehicle;
}

export function findActivePool(db: Tx | typeof prisma, vehicleId: string) {
  return db.pool.findFirst({
    where: { vehicleId, status: { in: ACTIVE_POOL_STATUSES } },
    include: driverPoolInclude,
  });
}

// The most seats any online Tesla could give a new passenger right now (0 if none), and how
// many Teslas are online. Used to refuse a request up front instead of letting it wait for a
// seat that doesn't exist. It's a snapshot, not a reservation: a Tesla can fill up before
// its driver accepts, which is what the request timeout is for.
export async function seatAvailability() {
  const vehicles = await prisma.vehicle.findMany({
    where: { isOnline: true },
    select: {
      capacity: true,
      pools: { where: { status: { in: ACTIVE_POOL_STATUSES } }, select: { status: true, capacity: true, seatsOccupied: true } },
    },
  });
  const best = Math.max(0, ...vehicles.map((v) => seatsFree(v.pools[0] ?? null, v.capacity)));
  return { onlineTeslas: vehicles.length, maxSeatsFree: best };
}

export async function setOnline(driverId: string, online: boolean) {
  return prisma.$transaction(async (tx) => {
    const vehicle = await lockVehicleOfDriver(tx, driverId);
    if (!online && (await findActivePool(tx, vehicle.id))) {
      throw conflict('CONFLICT', 'Finish or cancel your current trip before going offline');
    }
    const updated = await tx.vehicle.update({ where: { id: vehicle.id }, data: { isOnline: online } });
    return { isOnline: updated.isOnline };
  });
}

// Jashim accepts a waiting ride into Bullet's trip, creating the trip if there isn't one.
//
// The last-seat problem: Bullet has 1 seat left and Jashim taps "Accept" for Nusrat and for
// Shirin at nearly the same instant (two taps, two tabs). Both requests read "1 seat free".
//   1. Lock Bullet's vehicle row. The second accept waits here until the first commits, then
//      reads the updated seat count, so it can't also claim the seat.
//   2. Lock the pool row too, because a passenger cancelling only locks the pool.
//   3. Add the seats with a conditional UPDATE (… AND seats_occupied + n <= capacity).
//   4. Move the ride with a conditional UPDATE (… AND status = 'REQUESTED'), so a ride the
//      passenger just cancelled, or another driver just took, can't be accepted.
// And whatever the code does, the CHECK (seats_occupied <= capacity) and the one-active-pool-
// per-Tesla index make an overbooked or duplicate pool impossible to commit.
export async function acceptRequest(driverId: string, rideId: string) {
  return prisma.$transaction(async (tx) => {
    const vehicle = await lockVehicleOfDriver(tx, driverId);
    if (!vehicle.isOnline) throw conflict('CONFLICT', 'Go online to accept rides');

    let pool = await tx.pool.findFirst({ where: { vehicleId: vehicle.id, status: { in: ACTIVE_POOL_STATUSES } } });
    if (pool) await lockPool(tx, pool.id);
    // Re-read under the lock: a passenger may have just left and freed seats.
    if (pool) pool = await tx.pool.findUniqueOrThrow({ where: { id: pool.id } });

    const ride = await tx.rideRequest.findUnique({ where: { id: rideId }, select: { status: true, seats: true } });
    if (!ride) throw notFound('Ride request not found');
    if (ride.status !== 'REQUESTED') {
      throw conflict('CONFLICT', 'This passenger is no longer waiting (already matched or cancelled)');
    }

    assertCanJoin(pool, vehicle.capacity, ride.seats);

    if (!pool) {
      pool = await tx.pool.create({
        data: { vehicleId: vehicle.id, capacity: vehicle.capacity, status: 'MATCHED' },
      });
      await tx.rideStatusHistory.create({
        data: { poolId: pool.id, toStatus: 'MATCHED', actorUserId: driverId, reason: 'Trip created' },
      });
    }

    const seatsTaken = await tx.$executeRaw`
      UPDATE pools SET seats_occupied = seats_occupied + ${ride.seats}
      WHERE id = ${pool.id}::uuid AND seats_occupied + ${ride.seats} <= capacity`;
    if (seatsTaken === 0) {
      throw conflict('CAPACITY_EXCEEDED', 'Bullet is full', { seatsNeeded: ride.seats });
    }

    const { count } = await tx.rideRequest.updateMany({
      where: { id: rideId, status: 'REQUESTED' },
      data: { status: 'MATCHED' },
    });
    if (count === 0) {
      // Rolls back the seats and any pool created above.
      throw conflict('CONFLICT', 'This passenger is no longer waiting (already matched or cancelled)');
    }

    await tx.poolMember.create({ data: { poolId: pool.id, rideRequestId: rideId, seats: ride.seats } });
    await tx.rideStatusHistory.create({
      data: { rideRequestId: rideId, poolId: pool.id, fromStatus: 'REQUESTED', toStatus: 'MATCHED', actorUserId: driverId },
    });

    // Joining a Tesla that is already waiting at Banani: the passenger is matched and the driver
    // has arrived, both recorded, so the timeline stays REQUESTED → MATCHED → DRIVER_ARRIVED.
    if (pool.status === 'DRIVER_ARRIVED') {
      await tx.rideRequest.update({ where: { id: rideId }, data: { status: 'DRIVER_ARRIVED' } });
      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: rideId,
          poolId: pool.id,
          fromStatus: 'MATCHED',
          toStatus: 'DRIVER_ARRIVED',
          actorUserId: driverId,
          reason: 'Joined a Tesla already at the pickup',
        },
      });
    }

    return presentPool(await tx.pool.findUniqueOrThrow({ where: { id: pool.id }, include: driverPoolInclude }));
  });
}

export async function getCurrentPool(driverId: string) {
  const vehicle = await getVehicle(driverId);
  const pool = await findActivePool(prisma, vehicle.id);
  return pool ? presentPool(pool) : null;
}

// Open requests Jashim could accept right now: waiting for a Tesla and small enough for his free
// seats. Oldest first, so whoever has waited longest is at the top.
export async function listOpenRequests(driverId: string) {
  const vehicle = await getVehicle(driverId);
  const pool = await findActivePool(prisma, vehicle.id);

  const free = seatsFree(pool, vehicle.capacity);

  const requests =
    free === 0
      ? []
      : await prisma.rideRequest.findMany({
          where: { status: 'REQUESTED', seats: { lte: free } },
          select: openRequestSelect,
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

  return { isOnline: vehicle.isOnline, seatsFree: free, requests: requests.map(presentOpenRequest) };
}
