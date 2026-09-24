// Ride requests don't wait forever: one that no driver accepts within REQUEST_TIMEOUT_SECONDS
// (5 minutes by default) becomes EXPIRED, and the passenger is told why.
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

export const EXPIRED_REASON = 'No Tesla accepted your request in time. Please request again.';

export const requestTimeoutMs = () => env.REQUEST_TIMEOUT_SECONDS * 1000;

// Requests created before this moment are overdue.
export const expiryCutoff = (now = new Date()) => new Date(now.getTime() - requestTimeoutMs());

export const expiresAt = (createdAt: Date) => new Date(createdAt.getTime() + requestTimeoutMs());

// Expires every overdue request in one statement: the status change and its history row are
// written together or not at all. `WHERE status = 'REQUESTED'` makes it safe to run while
// drivers are accepting: a request accepted first is no longer REQUESTED and is skipped, and
// one expired first can no longer be accepted (accept's own conditional update finds it gone).
// Safe to run from several API instances at once for the same reason.
export async function expireStaleRequests(now = new Date()): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ride_request_id: string }[]>`
    WITH expired AS (
      UPDATE ride_requests
      SET status = 'EXPIRED', cancel_reason = ${EXPIRED_REASON}, updated_at = now()
      WHERE status = 'REQUESTED' AND created_at < ${expiryCutoff(now)}
      RETURNING id
    )
    INSERT INTO ride_status_history (ride_request_id, from_status, to_status, reason)
    SELECT id, 'REQUESTED', 'EXPIRED', ${EXPIRED_REASON} FROM expired
    RETURNING ride_request_id`;
  return rows.map((r) => r.ride_request_id);
}

// A timer inside the API process: no extra service or queue for the MVP. With several API
// instances each would sweep; the statement above makes that harmless.
export function startExpirySweeper() {
  const sweep = () =>
    expireStaleRequests()
      .then((ids) => {
        if (ids.length) logger.info({ count: ids.length, rideIds: ids }, 'Expired ride requests nobody accepted');
      })
      .catch((err) => logger.error({ err }, 'Expiry sweep failed'));

  void sweep();
  const timer = setInterval(sweep, env.EXPIRY_SWEEP_SECONDS * 1000);
  timer.unref(); // never keeps the process alive on shutdown
  return () => clearInterval(timer);
}
