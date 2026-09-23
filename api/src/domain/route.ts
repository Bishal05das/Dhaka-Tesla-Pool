// The single route line (docs/domain-rules.md#the-route-line). Pure functions, no I/O.
import { badRequest } from '../lib/errors.js';

export interface RouteStop {
  id: number;
  name: string;
  sequence: number;
  distanceFromStartM: number;
}

export interface Trip {
  pickup: RouteStop;
  drop: RouteStop;
  distanceM: number;
}

// A valid trip boards at the start of the line and gets off at any later stop.
export function planTrip(stops: RouteStop[], pickupStopId: number, dropStopId: number): Trip {
  const pickup = stops.find((s) => s.id === pickupStopId);
  const drop = stops.find((s) => s.id === dropStopId);
  if (!pickup || !drop) throw badRequest('Unknown stop');

  const start = Math.min(...stops.map((s) => s.sequence));
  if (pickup.sequence !== start) {
    throw badRequest('Every ride boards at the start of the line');
  }
  if (drop.sequence <= pickup.sequence) {
    throw badRequest('The drop-off must be a later stop than the pickup');
  }

  return { pickup, drop, distanceM: drop.distanceFromStartM - pickup.distanceFromStartM };
}
