'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { CurrentTrip } from '@/components/driver/CurrentTrip';
import { OnlineToggle } from '@/components/driver/OnlineToggle';
import { OpenRequests } from '@/components/driver/OpenRequests';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { taka } from '@/lib/format';
import type { OpenRequest, Pool, Stop } from '@/lib/types';

export default function DriverHome() {
  const { user } = useAuth();
  // Both polled: new requests appear, and passengers who cancel drop out of the trip.
  const feed = useApi<{ isOnline: boolean; seatsFree: number; requests: OpenRequest[] }>('/driver/requests', {
    pollMs: LIVE_POLL_MS,
  });
  const trip = useApi<{ pool: Pool | null }>('/driver/pool', { pollMs: LIVE_POLL_MS });
  const stops = useApi<{ stops: Stop[] }>('/stops');
  const [finished, setFinished] = useState<Pool | null>(null);

  const reloadAll = () => {
    feed.reload();
    trip.reload();
  };

  if (feed.loading || trip.loading || stops.loading) return <PageLoading label="Loading your Tesla…" />;
  if (!feed.data || !trip.data || !stops.data) {
    return <Alert>{(feed.error ?? trip.error ?? stops.error)?.message ?? 'Could not load your trip.'}</Alert>;
  }

  return (
    <>
      <PageHeader
        title={`Hi ${user?.name.split(' ')[0]}, here's ${user?.vehicle?.name ?? 'your Tesla'}`}
        subtitle="Accept passengers, then arrive, start and complete the trip. Updates every few seconds."
      />

      <div className="space-y-4">
        {(feed.error || trip.error) && <Alert tone="info">Connection trouble; showing the last update. Retrying…</Alert>}
        {finished && <FinishedBanner pool={finished} onDismiss={() => setFinished(null)} />}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <CurrentTrip
          pool={trip.data.pool}
          stops={stops.data.stops}
          onChanged={(done) => {
            if (done) setFinished(done);
            reloadAll();
          }}
        />
        <aside className="space-y-4">
          <OnlineToggle isOnline={feed.data.isOnline} onChanged={reloadAll} />
          <OpenRequests
            requests={feed.data.requests}
            seatsFree={feed.data.seatsFree}
            isOnline={feed.data.isOnline}
            onAccepted={reloadAll}
          />
        </aside>
      </div>
    </>
  );
}

// After completing: who paid by TeslaPay and whom to collect cash from.
function FinishedBanner({ pool, onDismiss }: { pool: Pool; onDismiss: () => void }) {
  const dismiss = (
    <button type="button" onClick={onDismiss} className="ml-2 font-semibold underline">
      OK
    </button>
  );
  if (pool.status === 'CANCELLED') {
    return <Alert tone="info">Trip cancelled. Passengers have been told. {dismiss}</Alert>;
  }
  const cash = pool.passengers.filter((p) => p.paidBy === 'CASH');
  const total = pool.passengers.reduce((sum, p) => sum + (p.farePoisha ?? 0), 0);
  return (
    <Alert tone="success">
      <p className="font-semibold">Trip completed: {taka(total)} earned.</p>
      <p>
        {cash.length > 0
          ? `Collect cash from ${cash.map((p) => `${p.name} (${taka(p.farePoisha ?? 0)})`).join(', ')}.`
          : 'Everyone paid with TeslaPay.'}
        {dismiss}
      </p>
    </Alert>
  );
}
