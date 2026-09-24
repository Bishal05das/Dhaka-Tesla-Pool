'use client';

import { ArrowRight, History, MapPin } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { dateTime, km, taka } from '@/lib/format';
import type { Ride } from '@/lib/types';

export default function PassengerHistory() {
  const rides = useApi<{ rides: Ride[] }>('/rides');

  if (rides.loading) return <PageLoading label="Loading your rides…" />;
  if (!rides.data) return <Alert>{rides.error?.message ?? 'Could not load your rides.'}</Alert>;

  const list = rides.data.rides;
  const completed = list.filter((r) => r.status === 'COMPLETED');
  const spent = completed.reduce((sum, r) => sum + (r.payment?.amountPoisha ?? 0), 0);
  const saved = completed.reduce((sum, r) => sum + (r.fare?.poolDiscountPoisha ?? 0), 0);

  return (
    <>
      <PageHeader title="My rides" subtitle="Every trip you've booked, with what you paid." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Trips completed" value={completed.length} />
        </Card>
        <Card>
          <Stat label="Paid in total" value={taka(spent)} />
        </Card>
        <Card>
          <Stat label="Saved by sharing" value={taka(saved)} hint="The 25% discount on shared trips" />
        </Card>
      </div>

      <Card title="All rides" icon={History}>
        {list.length === 0 ? (
          <EmptyState icon={MapPin} title="No rides yet">
            <Link href="/passenger" className="font-semibold text-emerald-700 hover:underline">
              Book your first seat
            </Link>
          </EmptyState>
        ) : (
          <ul className="-mx-2 divide-y divide-slate-100">
            {list.map((ride) => (
              <li key={ride.id}>
                <Link
                  href={`/passenger/rides/${ride.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 hover:bg-slate-50 sm:grid-cols-[1.5fr_1fr_auto_auto]"
                >
                  <span>
                    <span className="block font-medium text-slate-900">
                      {ride.pickup.name} → {ride.drop.name}
                    </span>
                    <span className="block text-sm text-slate-500">{dateTime(ride.createdAt)}</span>
                  </span>
                  <span className="hidden text-sm text-slate-500 sm:block">
                    {km(ride.distanceM)} · {ride.seats} seat{ride.seats > 1 ? 's' : ''}
                    {ride.fare?.pooled && <span className="ml-1 text-emerald-700">· shared</span>}
                  </span>
                  <StatusBadge status={ride.status} />
                  <span className="col-start-2 row-start-1 flex items-center gap-2 text-right font-semibold sm:col-start-auto sm:row-start-auto">
                    {ride.fare ? taka(ride.fare.totalPoisha) : <span className="font-normal text-slate-400">—</span>}
                    <ArrowRight className="hidden h-4 w-4 text-slate-400 sm:block" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
