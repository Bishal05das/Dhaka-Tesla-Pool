// A Tesla's trip, moved along by its driver. Every step moves the pool and all passengers
// still in it together, in one transaction, so a passenger's status never disagrees with the
// Tesla's.
import { calculateFare } from '../../domain/fare.js';
import { assertPoolTransition, assertRideTransition } from '../../domain/rideStateMachine.js';
import type { PaymentMethod, PoolStatus, RideStatus } from '../../generated/prisma/enums.js';
import { notFound } from '../../lib/errors.js';
import { lockPool, lockVehicleOfDriver } from '../../lib/locks.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { driverPoolInclude, presentPool } from '../driver/driver.presenter.js';
import { tryDebitForRide } from '../wallet/wallet.service.js';

type PoolAction = 'arrive' | 'start' | 'complete' | 'cancel';

const ACTIONS: Record<PoolAction, { to: PoolStatus; stamp: 'arrivedAt' | 'startedAt' | 'completedAt' | 'cancelledAt' }> = {
  arrive: { to: 'DRIVER_ARRIVED', stamp: 'arrivedAt' },
  start: { to: 'STARTED', stamp: 'startedAt' },
  complete: { to: 'COMPLETED', stamp: 'completedAt' },
  cancel: { to: 'CANCELLED', stamp: 'cancelledAt' },
};

export async function advancePool(driverId: string, poolId: string, action: PoolAction, reason?: string) {
  const { to, stamp } = ACTIONS[action];

  return prisma.$transaction(async (tx) => {
    // Same lock order as accepting: vehicle → pool → rides.
    const vehicle = await lockVehicleOfDriver(tx, driverId);
    // Jashim can only move Bullet's trips; anyone else's pool id is simply "not found".
    const owned = await tx.pool.findFirst({ where: { id: poolId, vehicleId: vehicle.id }, select: { id: true } });
    if (!owned) throw notFound('Trip not found');
    await lockPool(tx, poolId);

    const pool = await tx.pool.findUniqueOrThrow({
      where: { id: poolId },
      include: { members: { where: { leftAt: null }, include: { rideRequest: true } } },
    });
    assertPoolTransition(pool.status, to);

    await tx.pool.update({ where: { id: poolId }, data: { status: to, [stamp]: new Date() } });
    await tx.rideStatusHistory.create({
      data: { poolId, fromStatus: pool.status, toStatus: to, actorUserId: driverId, reason: reason ?? null },
    });

    // The fare is frozen the moment the Tesla starts: pooled if more than one passenger is
    // aboard right then. Anyone who cancelled before this point doesn't count.
    const pooled = pool.members.length > 1;

    for (const { rideRequest: ride } of pool.members) {
      assertRideTransition(ride.status, to as RideStatus);
      await tx.rideRequest.update({
        where: { id: ride.id },
        data: {
          status: to as RideStatus,
          ...(action === 'start' && freezeFare(ride.distanceM, ride.seats, pooled)),
          ...(action === 'cancel' && { cancelledById: driverId, cancelReason: reason ?? 'Cancelled by the driver' }),
        },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: ride.id,
          poolId,
          fromStatus: ride.status,
          toStatus: to,
          actorUserId: driverId,
          reason: action === 'cancel' ? (reason ?? 'Cancelled by the driver') : null,
        },
      });

      if (action === 'complete') await settleFare(tx, ride);
    }

    return presentPool(await tx.pool.findUniqueOrThrow({ where: { id: poolId }, include: driverPoolInclude }));
  });
}

// Charges the fare frozen at the start, inside the same transaction as completing the trip:
// either the trip completes and everyone is charged, or neither happens.
async function settleFare(
  tx: Tx,
  ride: { id: string; passengerId: string; paymentMethod: PaymentMethod; finalFarePoisha: number | null },
) {
  if (ride.finalFarePoisha === null) throw new Error(`Ride ${ride.id} completed without a frozen fare`);

  let method = ride.paymentMethod;
  // The balance was checked against the solo fare at request time and nothing else spends
  // from the wallet, so this should always succeed. If it ever doesn't, Jashim collects cash
  // rather than the trip being stuck unfinished.
  if (method === 'WALLET' && !(await tryDebitForRide(tx, ride.passengerId, ride.id, ride.finalFarePoisha))) {
    method = 'CASH';
  }
  await tx.payment.create({ data: { rideRequestId: ride.id, method, amountPoisha: ride.finalFarePoisha } });
}

function freezeFare(distanceM: number, seats: number, pooled: boolean) {
  const fare = calculateFare({ distanceM, seats, pooled });
  return {
    baseFarePoisha: fare.basePoisha,
    distanceChargePoisha: fare.distanceChargePoisha,
    poolDiscountPoisha: fare.poolDiscountPoisha,
    finalFarePoisha: fare.totalPoisha,
    pooled: fare.pooled,
  };
}

// Finished trips, newest first. Passengers who cancelled before the start are left out.
export async function listDriverHistory(driverId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId }, select: { id: true } });
  if (!vehicle) throw notFound('No Tesla registered for this driver');
  const pools = await prisma.pool.findMany({
    where: { vehicleId: vehicle.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
    include: driverPoolInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return pools.map((pool) => {
    const trip = presentPool(pool);
    const earnedPoisha =
      pool.status === 'COMPLETED' ? trip.passengers.reduce((sum, p) => sum + (p.farePoisha ?? 0), 0) : 0;
    return { ...trip, earnedPoisha };
  });
}
