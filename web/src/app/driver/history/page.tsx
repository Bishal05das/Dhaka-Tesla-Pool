'use client';

import { Banknote, CarFront, History, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { dateTime, POOL_STATUS_LABEL, taka } from '@/lib/format';
import type { DriverTrip } from '@/lib/types';

export default function DriverHistory() {
  const history = useApi<{ trips: DriverTrip[] }>('/driver/history');

  if (history.loading) return <PageLoading label="Loading your trips…" />;
  if (!history.data) return <Alert>{history.error?.message ?? 'Could not load your trips.'}</Alert>;

  const trips = history.data.trips;
  const completed = trips.filter((t) => t.status === 'COMPLETED');
  const earned = completed.reduce((sum, t) => sum + t.earnedPoisha, 0);
  const passengers = completed.reduce((sum, t) => sum + t.passengers.length, 0);
  const cash = completed.flatMap((t) => t.passengers).filter((p) => p.paidBy === 'CASH');
  const cashTotal = cash.reduce((sum, p) => sum + (p.farePoisha ?? 0), 0);

  return (
    <>
      <PageHeader title="Earnings" subtitle="Your finished trips, newest first." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Earned" value={taka(earned)} />
        </Card>
        <Card>
          <Stat label="Trips completed" value={completed.length} />
        </Card>
        <Card>
          <Stat label="Passengers carried" value={passengers} />
        </Card>
        <Card>
          <Stat label="Collected in cash" value={taka(cashTotal)} hint={`${cash.length} fare${cash.length === 1 ? '' : 's'}`} />
        </Card>
      </div>

      {trips.length === 0 ? (
        <EmptyState icon={History} title="No finished trips yet">
          Completed and cancelled trips appear here.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trips.map((trip) => (
            <Card
              key={trip.id}
              title={dateTime(trip.startedAt ?? trip.createdAt)}
              subtitle={`${trip.passengers.length} passenger${trip.passengers.length === 1 ? '' : 's'} · ${trip.seatsOccupied}/${trip.capacity} seats`}
              icon={CarFront}
              action={
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {POOL_STATUS_LABEL[trip.status]}
                </span>
              }
            >
              <ul className="divide-y divide-slate-100 text-sm">
                {trip.passengers.map((p) => (
                  <li key={p.rideId} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-slate-500">
                        {' '}
                        to {p.drop.name} · {p.seats} seat{p.seats > 1 ? 's' : ''}
                      </span>
                    </span>
                    {trip.status === 'COMPLETED' && p.farePoisha !== null ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        {p.paidBy === 'WALLET' ? <Wallet className="h-3.5 w-3.5 text-slate-400" /> : <Banknote className="h-3.5 w-3.5 text-slate-400" />}
                        {taka(p.farePoisha)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </li>
                ))}
              </ul>
              {trip.status === 'COMPLETED' && (
                <p className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold">
                  <span>Earned</span>
                  <span>{taka(trip.earnedPoisha)}</span>
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
