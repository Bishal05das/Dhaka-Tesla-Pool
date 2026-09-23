// Row locks (SELECT … FOR UPDATE) for the writes that must not interleave.
// Held until the surrounding transaction commits or rolls back.
//
// Lock order is always vehicle → pool → ride. Two transactions that take locks in the same
// order can wait for each other but can never deadlock.
//
//   accept a request     vehicle → pool → ride
//   pool actions         vehicle → pool → rides
//   go offline           vehicle
//   passenger cancels    pool → ride
import { notFound } from './errors.js';
import type { Tx } from './prisma.js';

// The Tesla's row exists before any pool does, so it is the lock that serialises creating
// the first pool as well as everything else a driver does to their trips.
export async function lockVehicleOfDriver(tx: Tx, driverId: string) {
  const [vehicle] = await tx.$queryRaw<{ id: string; capacity: number; is_online: boolean }[]>`
    SELECT id, capacity, is_online FROM vehicles WHERE driver_id = ${driverId}::uuid FOR UPDATE`;
  if (!vehicle) throw notFound('No Tesla registered for this driver');
  return { id: vehicle.id, capacity: vehicle.capacity, isOnline: vehicle.is_online };
}

export async function lockPool(tx: Tx, poolId: string) {
  await tx.$queryRaw`SELECT id FROM pools WHERE id = ${poolId}::uuid FOR UPDATE`;
}
