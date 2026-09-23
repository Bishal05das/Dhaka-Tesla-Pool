import type { RouteStop } from '../../domain/route.js';
import { prisma } from '../../lib/prisma.js';

export interface StopDto extends RouteStop {
  lat: number;
  lng: number;
}

// The route line in travel order.
export async function listStops(): Promise<StopDto[]> {
  const stops = await prisma.stop.findMany({ orderBy: { sequence: 'asc' } });
  return stops.map((s) => ({
    id: s.id,
    name: s.name,
    sequence: s.sequence,
    distanceFromStartM: s.distanceFromStartM,
    lat: s.lat.toNumber(),
    lng: s.lng.toNumber(),
  }));
}
