import { describe, expect, it } from 'vitest';
import { calculateFare, estimateFare } from '../../src/domain/fare.js';

// The hand-check table from docs/domain-rules.md#fare. All amounts in poisha.
describe('fares for the story cast (1 seat each)', () => {
  it.each([
    // who,      trip,                     km, solo,  pooled
    ['Nusrat', 'Banani → Mohakhali', 3, 9000, 7500],
    ['Rafiq', 'Banani → Gulshan 1', 5, 13000, 10500],
    ['Shirin', 'Banani → Gulshan 2', 7, 17000, 13500],
  ])('%s, %s (%i km): solo %i, pooled %i', (_who, _trip, km, solo, pooled) => {
    const estimate = estimateFare(km * 1000, 1);
    expect(estimate.solo.totalPoisha).toBe(solo);
    expect(estimate.pooled.totalPoisha).toBe(pooled);
  });

  it("shows Nusrat's pooled fare line by line", () => {
    expect(calculateFare({ distanceM: 3000, seats: 1, pooled: true })).toEqual({
      basePoisha: 3000, // ৳30
      distanceChargePoisha: 6000, // 3 km × ৳20
      poolDiscountPoisha: 1500, // 25% of ৳60
      totalPoisha: 7500, // ৳75
      pooled: true,
    });
  });
});

describe('seats', () => {
  it('multiplies the distance charge but charges the base fare once', () => {
    // Nusrat with a friend, 2 seats to Mohakhali: 3000 + 2 × 6000 = 15000.
    expect(calculateFare({ distanceM: 3000, seats: 2, pooled: false }).totalPoisha).toBe(15000);
    // Pooled: the discount is 25% of the doubled distance charge: 3000 + 12000 − 3000.
    expect(calculateFare({ distanceM: 3000, seats: 2, pooled: true }).totalPoisha).toBe(12000);
  });

  it.each([0, 4, 1.5])('rejects %s seats', (seats) => {
    expect(() => calculateFare({ distanceM: 3000, seats, pooled: false })).toThrow(RangeError);
  });
});

describe('money stays in whole poisha', () => {
  it('rounds a half-poisha discount up', () => {
    // 3.333 km → 6666 poisha; 25% = 1666.5 → 1667.
    expect(calculateFare({ distanceM: 3333, seats: 1, pooled: true })).toMatchObject({
      distanceChargePoisha: 6666,
      poolDiscountPoisha: 1667,
      totalPoisha: 7999,
    });
  });

  it('never produces fractions for any distance on the line', () => {
    for (let m = 100; m <= 10_000; m += 37) {
      for (const seats of [1, 2, 3]) {
        const { totalPoisha, distanceChargePoisha, poolDiscountPoisha } = calculateFare({
          distanceM: m,
          seats,
          pooled: true,
        });
        expect(Number.isInteger(totalPoisha)).toBe(true);
        expect(totalPoisha).toBe(3000 + distanceChargePoisha - poolDiscountPoisha);
      }
    }
  });

  it.each([0, -1000, 2.5])('rejects a distance of %s m', (distanceM) => {
    expect(() => calculateFare({ distanceM, seats: 1, pooled: false })).toThrow(RangeError);
  });
});

describe('pooling', () => {
  it('always costs less than riding alone', () => {
    const { solo, pooled } = estimateFare(10_000, 3);
    expect(pooled.totalPoisha).toBeLessThan(solo.totalPoisha);
  });
});
