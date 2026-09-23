import { Prisma } from '../generated/prisma/client.js';

// For a unique-index violation (P2002), returns the violated index name, e.g. "vehicles_plate_key"
// or "ride_requests_one_active_per_passenger_uq"; otherwise null. With the pg driver adapter,
// Prisma reports the index under meta.driverAdapterError.cause.constraint.index.
export function violatedUniqueIndex(err: unknown): string | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const cause = (err.meta?.driverAdapterError as { cause?: { constraint?: { index?: string } } })?.cause;
  return cause?.constraint?.index ?? 'unknown';
}
