// Ride-request and pool lifecycles (docs/domain-rules.md#lifecycle). Pure, no I/O.
//
// Two machines instead of one: a passenger can cancel their own ride without cancelling
// the Tesla's trip for everyone else, while pool actions (arrive, start, complete) move
// every active member along with the pool.
import type { PoolStatus, RideStatus } from '../generated/prisma/enums.js';
import { conflict } from '../lib/errors.js';

const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'], // no cancelling once the Tesla is moving
  COMPLETED: [],
  CANCELLED: [],
};

const POOL_TRANSITIONS: Record<PoolStatus, readonly PoolStatus[]> = {
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const canRideTransition = (from: RideStatus, to: RideStatus) => RIDE_TRANSITIONS[from].includes(to);
export const canPoolTransition = (from: PoolStatus, to: PoolStatus) => POOL_TRANSITIONS[from].includes(to);

export function assertRideTransition(from: RideStatus, to: RideStatus) {
  if (!canRideTransition(from, to)) {
    throw conflict('INVALID_TRANSITION', `A ${label(from)} ride can't become ${label(to)}`, { from, to });
  }
}

export function assertPoolTransition(from: PoolStatus, to: PoolStatus) {
  if (!canPoolTransition(from, to)) {
    throw conflict('INVALID_TRANSITION', `A ${label(from)} trip can't become ${label(to)}`, { from, to });
  }
}

// Statuses from which a transition to `to` is allowed; used in conditional UPDATEs
// (… WHERE status IN (…)) so a concurrent change can't slip past the rule.
export const rideStatusesAllowing = (to: RideStatus) =>
  (Object.keys(RIDE_TRANSITIONS) as RideStatus[]).filter((from) => canRideTransition(from, to));

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
// A pool can take new passengers until it starts.
export const JOINABLE_POOL_STATUSES: readonly PoolStatus[] = ['MATCHED', 'DRIVER_ARRIVED'];

const label = (status: string) => status.toLowerCase().replace('_', ' ');
