import { describe, expect, it } from 'vitest';
import {
  assertPoolTransition,
  assertRideTransition,
  canPoolTransition,
  canRideTransition,
  rideStatusesAllowing,
} from '../../src/domain/rideStateMachine.js';
import type { PoolStatus, RideStatus } from '../../src/generated/prisma/enums.js';
import { AppError } from '../../src/lib/errors.js';

const RIDE: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
const POOL: PoolStatus[] = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED'];

// Every allowed move, written out. Anything not listed must be rejected.
const ALLOWED_RIDE = new Set([
  'REQUESTED>MATCHED',
  'REQUESTED>CANCELLED',
  'REQUESTED>EXPIRED',
  'MATCHED>DRIVER_ARRIVED',
  'MATCHED>CANCELLED',
  'DRIVER_ARRIVED>STARTED',
  'DRIVER_ARRIVED>CANCELLED',
  'STARTED>COMPLETED',
]);
const ALLOWED_POOL = new Set([
  'MATCHED>DRIVER_ARRIVED',
  'MATCHED>CANCELLED',
  'DRIVER_ARRIVED>STARTED',
  'DRIVER_ARRIVED>CANCELLED',
  'STARTED>COMPLETED',
]);

describe('ride request transitions', () => {
  const pairs = RIDE.flatMap((from) => RIDE.map((to) => [from, to] as const));

  it.each(pairs)('%s → %s', (from, to) => {
    expect(canRideTransition(from, to)).toBe(ALLOWED_RIDE.has(`${from}>${to}`));
  });

  it('rejects an invalid move with 409 INVALID_TRANSITION', () => {
    try {
      assertRideTransition('STARTED', 'CANCELLED');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
    }
  });

  it('can only expire while still waiting for a driver', () => {
    expect(rideStatusesAllowing('EXPIRED')).toEqual(['REQUESTED']);
  });

  it('can be cancelled only before the trip starts', () => {
    expect(rideStatusesAllowing('CANCELLED')).toEqual(['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED']);
  });

  it('never leaves a finished state', () => {
    for (const to of RIDE) {
      expect(canRideTransition('COMPLETED', to)).toBe(false);
      expect(canRideTransition('CANCELLED', to)).toBe(false);
      expect(canRideTransition('EXPIRED', to)).toBe(false);
    }
  });
});

describe('pool transitions', () => {
  const pairs = POOL.flatMap((from) => POOL.map((to) => [from, to] as const));

  it.each(pairs)('%s → %s', (from, to) => {
    expect(canPoolTransition(from, to)).toBe(ALLOWED_POOL.has(`${from}>${to}`));
  });

  it('rejects starting before the driver has arrived', () => {
    expect(() => assertPoolTransition('MATCHED', 'STARTED')).toThrow(AppError);
  });

  it('rejects completing a trip that never started', () => {
    expect(() => assertPoolTransition('DRIVER_ARRIVED', 'COMPLETED')).toThrow(AppError);
  });
});
