import { JOINABLE_POOL_STATUSES } from '../../domain/rideStateMachine.js';
import type { PoolStatus } from '../../generated/prisma/enums.js';
import { conflict, notFound } from '../../lib/errors.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { driverPoolInclude, openRequestSelect, presentOpenRequest, presentPool } from './driver.presenter.js';

export const ACTIVE_POOL_STATUSES: PoolStatus[] = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'];

export async function getVehicle(driverId: string, db: Tx | typeof prisma = prisma) {
  const vehicle = await db.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw notFound('No Tesla registered for this driver');
  return vehicle;
}

// SELECT … FOR UPDATE on the Tesla's row. It exists before any pool does, so it is the one lock
// that serialises everything that changes this Tesla's trips: accepting (including creating the
// first pool), going offline, and pool actions. Lock order is always vehicle → pool → ride.
export async function lockVehicle(tx: Tx, driverId: string) {
  const [vehicle] = await tx.$queryRaw<{ id: string; capacity: number; is_online: boolean }[]>`
    SELECT id, capacity, is_online FROM vehicles WHERE driver_id = ${driverId}::uuid FOR UPDATE`;
  if (!vehicle) throw notFound('No Tesla registered for this driver');
  return { id: vehicle.id, capacity: vehicle.capacity, isOnline: vehicle.is_online };
}

export function findActivePool(db: Tx | typeof prisma, vehicleId: string) {
  return db.pool.findFirst({
    where: { vehicleId, status: { in: ACTIVE_POOL_STATUSES } },
    include: driverPoolInclude,
  });
}

export async function setOnline(driverId: string, online: boolean) {
  return prisma.$transaction(async (tx) => {
    const vehicle = await lockVehicle(tx, driverId);
    if (!online && (await findActivePool(tx, vehicle.id))) {
      throw conflict('CONFLICT', 'Finish or cancel your current trip before going offline');
    }
    const updated = await tx.vehicle.update({ where: { id: vehicle.id }, data: { isOnline: online } });
    return { isOnline: updated.isOnline };
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

  let seatsFree = vehicle.capacity;
  if (pool) {
    seatsFree = JOINABLE_POOL_STATUSES.includes(pool.status) ? pool.capacity - pool.seatsOccupied : 0;
  }

  const requests =
    seatsFree === 0
      ? []
      : await prisma.rideRequest.findMany({
          where: { status: 'REQUESTED', seats: { lte: seatsFree } },
          select: openRequestSelect,
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

  return { isOnline: vehicle.isOnline, seatsFree, requests: requests.map(presentOpenRequest) };
}
