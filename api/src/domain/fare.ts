// Fare model (docs/domain-rules.md#fare). Pure functions, integer poisha only (৳1 = 100 poisha).
//
//   distanceCharge = distanceKm × ৳20 × seats
//   poolDiscount   = pooled ? 25% of distanceCharge : 0
//   fare           = ৳30 base + distanceCharge − poolDiscount
//
// The base fare is charged once per ride, whatever the seat count.

export const FARE_RULES = {
  BASE_POISHA: 3000,
  PER_KM_POISHA: 2000,
  POOL_DISCOUNT_PERCENT: 25,
  MAX_SEATS: 3,
} as const;

export interface FareInput {
  distanceM: number;
  seats: number;
  pooled: boolean;
}

export interface FareBreakdown {
  basePoisha: number;
  distanceChargePoisha: number;
  poolDiscountPoisha: number;
  totalPoisha: number;
  pooled: boolean;
}

export function calculateFare({ distanceM, seats, pooled }: FareInput): FareBreakdown {
  if (!Number.isInteger(distanceM) || distanceM <= 0) {
    throw new RangeError(`distanceM must be a positive integer, got ${distanceM}`);
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > FARE_RULES.MAX_SEATS) {
    throw new RangeError(`seats must be 1-${FARE_RULES.MAX_SEATS}, got ${seats}`);
  }

  // Metres × poisha-per-km / 1000. Exact for whole km; otherwise rounded to the nearest poisha.
  const distanceChargePoisha = Math.round((distanceM * FARE_RULES.PER_KM_POISHA * seats) / 1000);
  // The only other rounding step. Math.round rounds .5 up, e.g. 1666.5 → 1667.
  const poolDiscountPoisha = pooled
    ? Math.round((distanceChargePoisha * FARE_RULES.POOL_DISCOUNT_PERCENT) / 100)
    : 0;

  return {
    basePoisha: FARE_RULES.BASE_POISHA,
    distanceChargePoisha,
    poolDiscountPoisha,
    totalPoisha: FARE_RULES.BASE_POISHA + distanceChargePoisha - poolDiscountPoisha,
    pooled,
  };
}

// What a passenger sees before requesting: they don't know yet whether anyone will share.
export function estimateFare(distanceM: number, seats: number) {
  return {
    solo: calculateFare({ distanceM, seats, pooled: false }),
    pooled: calculateFare({ distanceM, seats, pooled: true }),
  };
}
