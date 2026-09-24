'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Card, EmptyState } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { dateTime, taka } from '@/lib/format';
import type { Ride } from '@/lib/types';

export default function PassengerHistory() {
  const rides = useApi<{ rides: Ride[] }>('/rides');

  if (rides.loading) return <PageLoading label="Loading your rides…" />;
  if (!rides.data) return <Alert>{rides.error?.message ?? 'Could not load your rides.'}</Alert>;

  return (
    <Card title="Your rides">
      {rides.data.rides.length === 0 ? (
        <EmptyState title="No rides yet">
          <Link href="/passenger" className="font-semibold text-emerald-700 hover:underline">
            Book your first seat
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rides.data.rides.map((ride) => (
            <li key={ride.id}>
              <Link href={`/passenger/rides/${ride.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">
                    {ride.pickup.name} → {ride.drop.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {dateTime(ride.createdAt)} · {ride.seats} seat{ride.seats > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={ride.status} />
                  <p className="mt-1 text-sm font-semibold">
                    {ride.fare ? taka(ride.fare.totalPoisha) : <span className="font-normal text-slate-400">—</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
