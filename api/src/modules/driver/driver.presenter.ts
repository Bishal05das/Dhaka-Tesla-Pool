// What Jashim sees: who is riding, how many seats, and where each passenger gets off.
import type { Prisma } from '../../generated/prisma/client.js';

export const driverPoolInclude = {
  members: {
    where: { leftAt: null },
    orderBy: { joinedAt: 'asc' },
    select: {
      seats: true,
      joinedAt: true,
      rideRequest: {
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          estSoloFarePoisha: true,
          estPooledFarePoisha: true,
          finalFarePoisha: true,
          passenger: { select: { name: true } },
          dropStop: { select: { id: true, name: true, sequence: true } },
        },
      },
    },
  },
} satisfies Prisma.PoolInclude;

type PoolRow = Prisma.PoolGetPayload<{ include: typeof driverPoolInclude }>;

export function presentPool(pool: PoolRow) {
  return {
    id: pool.id,
    status: pool.status,
    capacity: pool.capacity,
    seatsOccupied: pool.seatsOccupied,
    seatsFree: pool.capacity - pool.seatsOccupied,
    createdAt: pool.createdAt,
    arrivedAt: pool.arrivedAt,
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    cancelledAt: pool.cancelledAt,
    // In drop-off order, so the list reads like the route Jashim will drive.
    passengers: pool.members
      .map((m) => ({
        rideId: m.rideRequest.id,
        name: m.rideRequest.passenger.name,
        seats: m.seats,
        drop: { id: m.rideRequest.dropStop.id, name: m.rideRequest.dropStop.name },
        dropSequence: m.rideRequest.dropStop.sequence,
        status: m.rideRequest.status,
        paymentMethod: m.rideRequest.paymentMethod,
        farePoisha: m.rideRequest.finalFarePoisha,
        joinedAt: m.joinedAt,
      }))
      .sort((a, b) => a.dropSequence - b.dropSequence)
      .map(({ dropSequence: _omit, ...p }) => p),
  };
}

export const openRequestSelect = {
  id: true,
  seats: true,
  distanceM: true,
  paymentMethod: true,
  estSoloFarePoisha: true,
  estPooledFarePoisha: true,
  createdAt: true,
  passenger: { select: { name: true } },
  pickupStop: { select: { id: true, name: true } },
  dropStop: { select: { id: true, name: true } },
} satisfies Prisma.RideRequestSelect;

type OpenRequestRow = Prisma.RideRequestGetPayload<{ select: typeof openRequestSelect }>;

export function presentOpenRequest(r: OpenRequestRow) {
  return {
    id: r.id,
    passengerName: r.passenger.name,
    pickup: r.pickupStop,
    drop: r.dropStop,
    seats: r.seats,
    distanceM: r.distanceM,
    paymentMethod: r.paymentMethod,
    estimate: { soloPoisha: r.estSoloFarePoisha, pooledPoisha: r.estPooledFarePoisha },
    requestedAt: r.createdAt,
  };
}
