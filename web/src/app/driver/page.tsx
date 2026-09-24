'use client';

import { useState } from 'react';
import { CurrentTrip } from '@/components/driver/CurrentTrip';
import { OnlineToggle } from '@/components/driver/OnlineToggle';
import { OpenRequests } from '@/components/driver/OpenRequests';
import { Alert } from '@/components/ui/Alert';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { taka } from '@/lib/format';
import type { OpenRequest, Pool } from '@/lib/types';

export default function DriverHome() {
  // Both polled: new requests appear, and passengers who cancel drop out of the trip.
  const feed = useApi<{ isOnline: boolean; seatsFree: number; requests: OpenRequest[] }>('/driver/requests', {
    pollMs: LIVE_POLL_MS,
  });
  const trip = useApi<{ pool: Pool | null }>('/driver/pool', { pollMs: LIVE_POLL_MS });
  const [finished, setFinished] = useState<Pool | null>(null);

  const reloadAll = () => {
    feed.reload();
    trip.reload();
  };

  if (feed.loading || trip.loading) return <PageLoading label="Loading your Tesla…" />;
  if (!feed.data || !trip.data) {
    return <Alert>{feed.error?.message ?? trip.error?.message ?? 'Could not load your trip.'}</Alert>;
  }

  return (
    <>
      {(feed.error || trip.error) && <Alert tone="info">Connection trouble; showing the last update. Retrying…</Alert>}
      {finished && <FinishedBanner pool={finished} onDismiss={() => setFinished(null)} />}
      <OnlineToggle isOnline={feed.data.isOnline} onChanged={reloadAll} />
      <CurrentTrip
        pool={trip.data.pool}
        onChanged={(done) => {
          if (done) setFinished(done);
          reloadAll();
        }}
      />
      <OpenRequests
        requests={feed.data.requests}
        seatsFree={feed.data.seatsFree}
        isOnline={feed.data.isOnline}
        onAccepted={reloadAll}
      />
    </>
  );
}

// After completing: who paid by TeslaPay and whom to collect cash from.
function FinishedBanner({ pool, onDismiss }: { pool: Pool; onDismiss: () => void }) {
  if (pool.status === 'CANCELLED') {
    return (
      <Alert tone="info">
        Trip cancelled. Passengers have been told.{' '}
        <button type="button" onClick={onDismiss} className="font-semibold underline">
          OK
        </button>
      </Alert>
    );
  }
  const cash = pool.passengers.filter((p) => p.paidBy === 'CASH');
  const total = pool.passengers.reduce((sum, p) => sum + (p.farePoisha ?? 0), 0);
  return (
    <Alert tone="success">
      Trip completed: {taka(total)} earned.{' '}
      {cash.length > 0
        ? `Collect cash from ${cash.map((p) => `${p.name} (${taka(p.farePoisha ?? 0)})`).join(', ')}.`
        : 'Everyone paid with TeslaPay.'}{' '}
      <button type="button" onClick={onDismiss} className="font-semibold underline">
        OK
      </button>
    </Alert>
  );
}
