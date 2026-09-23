import { conflict, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
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

// Another passenger's ride answers 404, not 403, so ride ids can't be probed.
export async function getRide(passengerId: string, rideId: string) {
  const ride = await prisma.rideRequest.findFirst({
    where: { id: rideId, passengerId },
    include: passengerRideDetailInclude,
  });
  if (!ride) throw notFound('Ride not found');
  return presentRideDetail(ride);
}
