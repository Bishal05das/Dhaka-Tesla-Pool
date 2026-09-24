'use client';

import { Alert } from '@/components/ui/Alert';
import { Card, EmptyState } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { dateTime, POOL_STATUS_LABEL, taka } from '@/lib/format';
import type { DriverTrip } from '@/lib/types';

export default function DriverHistory() {
  const history = useApi<{ trips: DriverTrip[] }>('/driver/history');

  if (history.loading) return <PageLoading label="Loading your trips…" />;
  if (!history.data) return <Alert>{history.error?.message ?? 'Could not load your trips.'}</Alert>;

  const trips = history.data.trips;
  const earned = trips.reduce((sum, t) => sum + t.earnedPoisha, 0);

  return (
    <>
      <Card>
        <p className="text-sm text-slate-500">Earned on the last {trips.length} trips</p>
        <p className="text-3xl font-bold">{taka(earned)}</p>
      </Card>

      {trips.length === 0 ? (
        <EmptyState title="No finished trips yet">Completed and cancelled trips appear here.</EmptyState>
      ) : (
        trips.map((trip) => (
          <Card
            key={trip.id}
            title={dateTime(trip.startedAt ?? trip.createdAt)}
            action={
              <span className={`text-sm font-semibold ${trip.status === 'COMPLETED' ? 'text-emerald-700' : 'text-slate-500'}`}>
                {POOL_STATUS_LABEL[trip.status]}
              </span>
            }
          >
            <ul className="divide-y divide-slate-100 text-sm">
              {trip.passengers.map((p) => (
                <li key={p.rideId} className="flex justify-between py-2">
                  <span>
                    <span className="font-semibold">{p.name}</span> → {p.drop.name}
                    <span className="text-slate-500">
                      {' '}
                      · {p.seats} seat{p.seats > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span>
                    {p.farePoisha !== null && trip.status === 'COMPLETED' ? (
                      <>
                        {taka(p.farePoisha)}{' '}
                        <span className="text-slate-500">{p.paidBy === 'WALLET' ? 'TeslaPay' : 'Cash'}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {trip.status === 'COMPLETED' && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-right text-sm font-semibold">
                Earned {taka(trip.earnedPoisha)}
              </p>
            )}
          </Card>
        ))
      )}
    </>
  );
}
