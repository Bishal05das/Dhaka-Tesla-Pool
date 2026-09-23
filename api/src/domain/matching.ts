// Pool matching (docs/domain-rules.md#matching). Pure, no I/O.
//
// Every valid trip is on the one route line, so any two passengers are route-compatible:
// drop-offs are never compared with each other. What decides whether a request can join a
// Tesla's trip is only whether the trip has started and whether the seats fit.
import type { PoolStatus } from '../generated/prisma/enums.js';
import { conflict } from '../lib/errors.js';
import { JOINABLE_POOL_STATUSES } from './rideStateMachine.js';

export interface PoolSnapshot {
  status: PoolStatus;
  capacity: number;
  seatsOccupied: number;
}

// Seats a new request could take right now. `pool` is the Tesla's active pool, or null if it
// has none (the next accept will create one with the Tesla's full capacity).
export function seatsFree(pool: PoolSnapshot | null, vehicleCapacity: number): number {
  if (!pool) return vehicleCapacity;
  if (!JOINABLE_POOL_STATUSES.includes(pool.status)) return 0;
  return pool.capacity - pool.seatsOccupied;
}

export function assertCanJoin(pool: PoolSnapshot | null, vehicleCapacity: number, seats: number) {
  if (pool && !JOINABLE_POOL_STATUSES.includes(pool.status)) {
    throw conflict('CONFLICT', 'Your trip has already started; finish it before accepting more passengers');
  }
  const free = seatsFree(pool, vehicleCapacity);
  if (seats > free) {
    throw conflict('CAPACITY_EXCEEDED', `Not enough seats: this ride needs ${seats}, only ${free} free`, {
      seatsNeeded: seats,
      seatsFree: free,
    });
  }
}
