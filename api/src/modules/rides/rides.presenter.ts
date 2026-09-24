// Shapes a ride for the passenger who owns it. Deliberately leaves out everything about other
// passengers: co-riders appear only as a count, never with names, stops or fares.
import type { Prisma } from '../../generated/prisma/client.js';
import { expiresAt } from './expiry.service.js';

export const passengerRideInclude = {
  pickupStop: { select: { id: true, name: true } },
  dropStop: { select: { id: true, name: true } },
  payment: { select: { method: true, amountPoisha: true, paidAt: true } },
  membership: {
    select: {
      pool: {
        select: {
          status: true,
          vehicle: { select: { name: true, plate: true, driver: { select: { name: true } } } },
          _count: { select: { members: { where: { leftAt: null } } } },
        },
      },
    },
  },
} satisfies Prisma.RideRequestInclude;

export const passengerRideDetailInclude = {
  ...passengerRideInclude,
  history: {
    select: { fromStatus: true, toStatus: true, actorUserId: true, reason: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.RideRequestInclude;

type RideRow = Prisma.RideRequestGetPayload<{ include: typeof passengerRideInclude }>;
type RideDetailRow = Prisma.RideRequestGetPayload<{ include: typeof passengerRideDetailInclude }>;

export function presentRide(ride: RideRow) {
  const pool = ride.membership?.pool;
  return {
    id: ride.id,
    status: ride.status,
    pickup: ride.pickupStop,
    drop: ride.dropStop,
    seats: ride.seats,
    paymentMethod: ride.paymentMethod,
    distanceM: ride.distanceM,
    estimate: { soloPoisha: ride.estSoloFarePoisha, pooledPoisha: ride.estPooledFarePoisha },
    // Set once the trip starts; until then the passenger sees the estimate.
    fare:
      ride.finalFarePoisha === null
        ? null
        : {
            basePoisha: ride.baseFarePoisha,
            distanceChargePoisha: ride.distanceChargePoisha,
            poolDiscountPoisha: ride.poolDiscountPoisha,
            totalPoisha: ride.finalFarePoisha,
            pooled: ride.pooled,
          },
    payment: ride.payment,
    tesla: pool
      ? {
          driverName: pool.vehicle.driver.name,
          vehicleName: pool.vehicle.name,
          plate: pool.vehicle.plate,
          tripStatus: pool.status,
          coRiders: Math.max(pool._count.members - 1, 0),
        }
      : null,
    cancelReason: ride.cancelReason,
    // While waiting for a driver: when the request gives up (the passenger sees a countdown).
    expiresAt: ride.status === 'REQUESTED' ? expiresAt(ride.createdAt) : null,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
  };
}

export function presentRideDetail(ride: RideDetailRow) {
  return {
    ...presentRide(ride),
    timeline: ride.history.map((h) => ({
      status: h.toStatus,
      at: h.createdAt,
      by: h.actorUserId === ride.passengerId ? 'you' : h.actorUserId ? 'driver' : 'system',
      reason: h.reason,
    })),
  };
}
