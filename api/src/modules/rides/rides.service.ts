import { assertPoolTransition, assertRideTransition } from '../../domain/rideStateMachine.js';
import { conflict, notFound } from '../../lib/errors.js';
import { lockPool } from '../../lib/locks.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { violatedUniqueIndex } from '../../lib/prismaErrors.js';
import { quoteTrip } from '../fares/fares.service.js';
import {
  passengerRideDetailInclude,
  passengerRideInclude,
  presentRide,
  presentRideDetail,
} from './rides.presenter.js';
import type { RequestRideInput } from './rides.schemas.js';

export async function requestRide(passengerId: string, input: RequestRideInput) {
  const { trip, estimate } = await quoteTrip(input);

  if (input.paymentMethod === 'WALLET') {
    // The solo fare is the most this ride can cost, so it's what the balance must cover.
    // No race here: a passenger can only have one active ride (unique index below).
    const wallet = await prisma.wallet.findUnique({ where: { userId: passengerId } });
    if (!wallet || wallet.balancePoisha < estimate.solo.totalPoisha) {
      throw conflict('INSUFFICIENT_BALANCE', 'Your TeslaPay balance is too low for this ride. Top up or pay cash.', {
        balancePoisha: wallet?.balancePoisha ?? 0,
        requiredPoisha: estimate.solo.totalPoisha,
      });
    }
  }

  try {
    const ride = await prisma.$transaction(async (tx) => {
      const created = await tx.rideRequest.create({
        data: {
          passengerId,
          pickupStopId: trip.pickup.id,
          dropStopId: trip.drop.id,
          seats: trip.seats,
          paymentMethod: input.paymentMethod,
          distanceM: trip.distanceM,
          estSoloFarePoisha: estimate.solo.totalPoisha,
          estPooledFarePoisha: estimate.pooled.totalPoisha,
        },
        include: passengerRideInclude,
      });
      await tx.rideStatusHistory.create({
        data: { rideRequestId: created.id, toStatus: 'REQUESTED', actorUserId: passengerId },
      });
      return created;
    });
    return presentRide(ride);
  } catch (err) {
    // Enforced by a partial unique index, so a double-tap on "Request" can't create two rides.
    if (violatedUniqueIndex(err) === 'ride_requests_one_active_per_passenger_uq') {
      throw conflict('CONFLICT', 'You already have an active ride. Cancel it before requesting another.');
    }
    throw err;
  }
}

export async function listRides(passengerId: string) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId },
    include: passengerRideInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rides.map(presentRide);
}

// A passenger may cancel before the trip starts. If they were already in a pool, their seats
// go back to the Tesla, and a pool left with nobody in it is cancelled too.
//
// Concurrency: the driver may be accepting this ride, or moving the pool along, at the same
// moment. Every writer that touches both locks the pool row first and the ride second, so they
// can't deadlock. The ride is changed with a conditional UPDATE on the status we just read; if
// someone else changed it in between, nothing is written and we re-read and try again.
export async function cancelRide(passengerId: string, rideId: string, reason?: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const done = await prisma.$transaction(async (tx) => {
      let ride = await tx.rideRequest.findFirst({
        where: { id: rideId, passengerId },
        select: { status: true, membership: { select: { poolId: true, seats: true, leftAt: true } } },
      });
      if (!ride) throw notFound('Ride not found');

      const member = ride.membership && !ride.membership.leftAt ? ride.membership : null;
      if (member) {
        await lockPool(tx, member.poolId);
        // Under the pool lock no pool action can move this ride, so re-read its status.
        ride = await tx.rideRequest.findUniqueOrThrow({
          where: { id: rideId },
          select: { status: true, membership: { select: { poolId: true, seats: true, leftAt: true } } },
        });
      }

      assertRideTransition(ride.status, 'CANCELLED');

      const { count } = await tx.rideRequest.updateMany({
        where: { id: rideId, status: ride.status },
        data: { status: 'CANCELLED', cancelledById: passengerId, cancelReason: reason ?? null },
      });
      if (count === 0) return false; // changed under us: retry with a fresh read

      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: rideId,
          poolId: member?.poolId ?? null,
          fromStatus: ride.status,
          toStatus: 'CANCELLED',
          actorUserId: passengerId,
          reason: reason ?? null,
        },
      });

      if (member) await leavePool(tx, rideId, member.poolId, member.seats);
      return true;
    });
    if (done) return getRide(passengerId, rideId);
  }
  throw conflict('CONFLICT', 'Your ride changed while cancelling. Please try again.');
}

// Caller must hold the pool lock.
async function leavePool(tx: Tx, rideId: string, poolId: string, seats: number) {
  await tx.poolMember.update({ where: { rideRequestId: rideId }, data: { leftAt: new Date() } });
  const pool = await tx.pool.update({
    where: { id: poolId },
    data: { seatsOccupied: { decrement: seats } },
    select: { status: true, _count: { select: { members: { where: { leftAt: null } } } } },
  });

  if (pool._count.members === 0) {
    assertPoolTransition(pool.status, 'CANCELLED');
    await tx.pool.update({ where: { id: poolId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await tx.rideStatusHistory.create({
      data: {
        poolId,
        fromStatus: pool.status,
        toStatus: 'CANCELLED',
        reason: 'Every passenger cancelled',
      },
    });
  }
}

// Another passenger's ride answers 404, not 403, so ride ids can't be probed.
export async function getRide(passengerId: string, rideId: string) {
  const ride = await prisma.rideRequest.findFirst({
    where: { id: rideId, passengerId },
    include: passengerRideDetailInclude,
  });
  if (!ride) throw notFound('Ride not found');
  return presentRideDetail(ride);
}
