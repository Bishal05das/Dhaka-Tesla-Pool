'use client';

import Link from 'next/link';
import { ActiveRideCard } from '@/components/ride/ActiveRideCard';
import { RequestRideForm } from '@/components/ride/RequestRideForm';
import { StatusBadge } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { taka } from '@/lib/format';
import type { Ride, RideStatus } from '@/lib/types';

const ACTIVE: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];

export default function PassengerHome() {
  // Polled, so the active ride moves along as Jashim arrives, starts and completes.
  const rides = useApi<{ rides: Ride[] }>('/rides', { pollMs: LIVE_POLL_MS });

  if (rides.loading) return <PageLoading label="Loading your rides…" />;
  if (!rides.data) {
    return (
      <Alert>
        {rides.error?.message ?? 'Could not load your rides.'}{' '}
        <Button variant="secondary" className="ml-2" onClick={rides.reload}>
          Try again
        </Button>
      </Alert>
    );
  }

  const active = rides.data.rides.find((r) => ACTIVE.includes(r.status));
  const last = rides.data.rides[0];

  return (
    <>
      {rides.error && <Alert tone="info">Connection trouble; showing the last update. Retrying…</Alert>}
      {active ? (
        <ActiveRideCard ride={active} onChanged={rides.reload} />
      ) : (
        <>
          {last && (
            <Link
              href={`/passenger/rides/${last.id}`}
              className="flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <span>
                Last ride: {last.pickup.name} → {last.drop.name}
                {last.payment && <span className="text-slate-500"> · {taka(last.payment.amountPoisha)}</span>}
              </span>
              <StatusBadge status={last.status} />
            </Link>
          )}
          <RequestRideForm onRequested={rides.reload} />
        </>
      )}
    </>
  );
}
