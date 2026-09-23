import { describe, expect, it } from 'vitest';
import { assertCanJoin, seatsFree } from '../../src/domain/matching.js';

const bullet = 3;
const pool = (seatsOccupied: number, status: 'MATCHED' | 'DRIVER_ARRIVED' | 'STARTED' = 'MATCHED') => ({
  status,
  capacity: bullet,
  seatsOccupied,
});

describe('seatsFree', () => {
  it('is the whole Tesla when there is no trip yet', () => {
    expect(seatsFree(null, bullet)).toBe(3);
  });

  it('is what is left while the pool can still take passengers', () => {
    expect(seatsFree(pool(2), bullet)).toBe(1);
    expect(seatsFree(pool(2, 'DRIVER_ARRIVED'), bullet)).toBe(1);
  });

  it('is zero once the trip has started', () => {
    expect(seatsFree(pool(1, 'STARTED'), bullet)).toBe(0);
  });
});

describe('assertCanJoin', () => {
  it('lets Shirin take the last seat', () => {
    expect(() => assertCanJoin(pool(2), bullet, 1)).not.toThrow();
  });

  it('refuses the 4th seat on Bullet with CAPACITY_EXCEEDED', () => {
    expect(() => assertCanJoin(pool(3), bullet, 1)).toThrow(expect.objectContaining({ code: 'CAPACITY_EXCEEDED' }));
  });

  it('refuses 2 seats when only 1 is free', () => {
    expect(() => assertCanJoin(pool(2), bullet, 2)).toThrow(
      expect.objectContaining({ details: { seatsNeeded: 2, seatsFree: 1 } }),
    );
  });

  it('refuses anyone once the trip has started, even with seats free', () => {
    expect(() => assertCanJoin(pool(1, 'STARTED'), bullet, 1)).toThrow(/already started/);
  });

  it('never compares drop-offs: a passenger to the next stop and one to the last stop can share', () => {
    // The rule has no drop-off input at all; this documents that on purpose.
    expect(assertCanJoin.length).toBe(3);
  });
});
