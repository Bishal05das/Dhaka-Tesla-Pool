'use client';

import { ArrowLeft, Clock, MapPin, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteLine } from '@/components/route/RouteLine';
import { StatusBadge, StatusSteps } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Card, PageHeader } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { dateTime, km, RIDE_STATUS_LABEL, taka, time } from '@/lib/format';
import type { RideDetail, Stop } from '@/lib/types';

// Everything that happened to one ride: the route, the timeline, the fare line by line and the
// payment. Enough to explain the ride later if anyone asks.
export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ride = useApi<{ ride: RideDetail }>(`/rides/${id}`, { pollMs: LIVE_POLL_MS });
  const stops = useApi<{ stops: Stop[] }>('/stops');

  if (ride.loading) return <PageLoading label="Loading ride…" />;
  if (!ride.data) {
    // A 404 also covers "this is someone else's ride".
    return (
      <Alert>
        {ride.error?.status === 404 ? 'Ride not found.' : (ride.error?.message ?? 'Could not load this ride.')}{' '}
        <Link href="/passenger/history" className="font-semibold underline">
          Back to my rides
        </Link>
      </Alert>
    );
  }

  const r = ride.data.ride;
  const beforeCancel = r.timeline.at(-2)?.status;

  return (
    <>
      <Link href="/passenger/history" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> My rides
      </Link>
      <PageHeader
        title={`${r.pickup.name} → ${r.drop.name}`}
        subtitle={`${dateTime(r.createdAt)} · ${km(r.distanceM)} · ${r.seats} seat${r.seats > 1 ? 's' : ''}`}
        action={<StatusBadge status={r.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card
            title="Trip"
            icon={MapPin}
            subtitle={r.tesla ? `${r.tesla.driverName} in ${r.tesla.vehicleName} (${r.tesla.plate})` : undefined}
          >
            <StatusSteps status={r.status} reachedBeforeCancel={beforeCancel} />
            {stops.data && (
              <div className="mt-6">
                <RouteLine stops={stops.data.stops} pickupId={r.pickup.id} dropId={r.drop.id} />
              </div>
            )}
            {r.cancelReason && (
              <p className="mt-4 text-sm text-slate-600">
                <span className="font-medium">Reason:</span> {r.cancelReason}
              </p>
            )}
          </Card>

          <Card title="What happened" icon={Clock}>
            <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
              {r.timeline.map((event, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  <span className="font-medium text-slate-900">{RIDE_STATUS_LABEL[event.status]}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {time(event.at)} · by {event.by}
                  </span>
                  {event.reason && <span className="block text-slate-500">{event.reason}</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside>
          <Card title="Receipt" icon={Receipt}>
            {r.fare ? (
              <dl className="space-y-2 text-sm">
                <Row label="Base fare" value={taka(r.fare.basePoisha)} />
                <Row
                  label={`Distance (${km(r.distanceM)} × ${r.seats} seat${r.seats > 1 ? 's' : ''})`}
                  value={taka(r.fare.distanceChargePoisha)}
                />
                {r.fare.pooled && <Row label="Shared Tesla (−25% distance)" value={taka(-r.fare.poolDiscountPoisha)} />}
                <Row label="Total" value={taka(r.fare.totalPoisha)} strong />
                <p className="pt-2 text-slate-500">
                  {r.fare.pooled
                    ? 'Someone else was aboard when the Tesla started, so you paid the shared fare.'
                    : 'You were the only passenger when the Tesla started, so this is the solo fare.'}
                </p>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">
                {r.status === 'CANCELLED' || r.status === 'EXPIRED'
                  ? 'The trip never started: nothing to pay.'
                  : `Estimate: ${taka(r.estimate.pooledPoisha)} if shared, ${taka(r.estimate.soloPoisha)} alone. Fixed when the Tesla starts.`}
              </p>
            )}
            {r.payment && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Paid {taka(r.payment.amountPoisha)} {r.payment.method === 'WALLET' ? 'from TeslaPay' : 'in cash'} at{' '}
                {time(r.payment.paidAt)}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t border-slate-200 pt-3 text-base font-bold' : 'text-slate-700'}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
