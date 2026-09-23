import { estimateFare } from '../../domain/fare.js';
import { planTrip } from '../../domain/route.js';
import { listStops } from '../stops/stops.service.js';
import type { TripInput } from './fares.schemas.js';

// Validates the trip against the route line and prices it both ways (solo and pooled).
export async function quoteTrip(input: TripInput) {
  const trip = planTrip(await listStops(), input.pickupStopId, input.dropStopId);
  return {
    trip: {
      pickup: { id: trip.pickup.id, name: trip.pickup.name },
      drop: { id: trip.drop.id, name: trip.drop.name },
      distanceM: trip.distanceM,
      seats: input.seats,
    },
    estimate: estimateFare(trip.distanceM, input.seats),
  };
}
