'use client';

import { ArrowRight, History, Leaf, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { ActiveRideCard } from '@/components/ride/ActiveRideCard';
import { RequestRideForm } from '@/components/ride/RequestRideForm';
import { StatusBadge } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { dateTime, taka } from '@/lib/format';
import type { Ride, RideStatus, Stop, Wallet as WalletData } from '@/lib/types';

const ACTIVE: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];

export default function PassengerHome() {
  const { user } = useAuth();
  // Polled, so the active ride moves along as Jashim arrives, starts and completes.
  const rides = useApi<{ rides: Ride[] }>('/rides', { pollMs: LIVE_POLL_MS });
  const stops = useApi<{ stops: Stop[] }>('/stops');
  const wallet = useApi<WalletData>('/wallet', { pollMs: LIVE_POLL_MS });

  if (rides.loading || stops.loading) return <PageLoading label="Loading your rides…" />;
  if (!rides.data || !stops.data) {
    return (
      <Alert>
        {(rides.error ?? stops.error)?.message ?? 'Could not load your rides.'}{' '}
        <Button variant="secondary" className="ml-2" onClick={() => (rides.reload(), stops.reload())}>
          Try again
        </Button>
      </Alert>
    );
  }

  const active = rides.data.rides.find((r) => ACTIVE.includes(r.status));
  const last = rides.data.rides[0];
  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={active ? 'Your ride' : `Where to, ${firstName}?`}
        subtitle={active ? 'Updates every few seconds.' : 'Book a seat on the next Tesla out of Banani.'}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {(rides.error || stops.error) && <Alert tone="info">Connection trouble; showing the last update. Retrying…</Alert>}
          {!active && last?.status === 'EXPIRED' && (
            <Alert tone="warning">
              <p className="font-semibold">Your last request expired</p>
              <p>
                {last.pickup.name} → {last.drop.name}: {last.cancelReason}
              </p>
            </Alert>
          )}
          {active ? (
            <ActiveRideCard ride={active} stops={stops.data.stops} onChanged={rides.reload} />
          ) : (
            <RequestRideForm
              stops={stops.data.stops}
              balancePoisha={wallet.data?.balancePoisha}
              onRequested={rides.reload}
            />
          )}
        </div>

        <aside className="space-y-4">
          <Card title="TeslaPay" icon={Wallet} action={<Link href="/passenger/wallet" className="text-sm font-semibold text-emerald-700 hover:underline">Top up</Link>}>
            <p className="text-3xl font-bold tracking-tight">{wallet.data ? taka(wallet.data.balancePoisha) : '—'}</p>
            <p className="mt-1 text-sm text-slate-500">Charged only when a trip completes.</p>
          </Card>

          <Card title="Sharing saves" icon={Leaf}>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <Step n={1} /> Book a seat from Banani to any stop on the line.
              </li>
              <li className="flex gap-3">
                <Step n={2} /> The driver may seat others going the same way, up to 3 seats.
              </li>
              <li className="flex gap-3">
                <Step n={3} /> If anyone shares when the Tesla starts, you pay 25% less on distance. You only ever see
                your own fare.
              </li>
            </ol>
          </Card>

          <Card
            title="Recent rides"
            icon={History}
            action={
              <Link href="/passenger/history" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
                All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {rides.data.rides.length === 0 ? (
              <p className="text-sm text-slate-500">Your trips will appear here.</p>
            ) : (
              <ul className="-mx-2 divide-y divide-slate-100">
                {rides.data.rides.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link href={`/passenger/rides/${r.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.drop.name}</span>
                        <span className="block text-xs text-slate-500">{dateTime(r.createdAt)}</span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
      {n}
    </span>
  );
}
