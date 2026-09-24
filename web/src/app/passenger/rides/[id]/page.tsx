'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StatusBadge, StatusSteps } from '@/components/ride/StatusSteps';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { LIVE_POLL_MS, useApi } from '@/hooks/useApi';
import { dateTime, km, RIDE_STATUS_LABEL, taka, time } from '@/lib/format';
import type { RideDetail } from '@/lib/types';

// Everything that happened to one ride: the timeline, the fare line by line, and the payment.
export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ride = useApi<{ ride: RideDetail }>(`/rides/${id}`, { pollMs: LIVE_POLL_MS });

  if (ride.loading) return <PageLoading label="Loading ride…" />;
  if (!ride.data) {
    // A 404 also covers "this is someone else's ride".
    return (
      <Alert>
        {ride.error?.status === 404 ? 'Ride not found.' : (ride.error?.message ?? 'Could not load this ride.')}{' '}
        <Link href="/passenger/history" className="font-semibold underline">
          Back to your rides
        </Link>
      </Alert>
    );
  }

  const r = ride.data.ride;
  const beforeCancel = r.timeline.at(-2)?.status;

  return (
    <>
      <Link href="/passenger/history" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Your rides
      </Link>

      <Card title={`${r.pickup.name} → ${r.drop.name}`} action={<StatusBadge status={r.status} />}>
        <StatusSteps status={r.status} reachedBeforeCancel={beforeCancel} />
        <p className="mt-4 text-sm text-slate-600">
          {km(r.distanceM)} · {r.seats} seat{r.seats > 1 ? 's' : ''} · {dateTime(r.createdAt)}
          {r.tesla && (
            <>
              {' '}
              · {r.tesla.driverName} in {r.tesla.vehicleName} ({r.tesla.plate})
            </>
          )}
        </p>
        {r.cancelReason && <p className="mt-2 text-sm text-slate-600">Reason: {r.cancelReason}</p>}
      </Card>

      <Card title="Fare">
        {r.fare ? (
          <dl className="space-y-1 text-sm">
            <Row label="Base fare" value={taka(r.fare.basePoisha)} />
            <Row label={`Distance (${km(r.distanceM)} × ${r.seats} seat${r.seats > 1 ? 's' : ''})`} value={taka(r.fare.distanceChargePoisha)} />
            {r.fare.pooled && <Row label="Shared Tesla (25% off distance)" value={taka(-r.fare.poolDiscountPoisha)} />}
            <Row label="Total" value={taka(r.fare.totalPoisha)} strong />
            <p className="pt-2 text-slate-500">
              {r.fare.pooled
                ? 'Someone else was aboard when the Tesla started, so you paid the shared fare.'
                : 'You were the only passenger when the Tesla started, so this is the solo fare.'}
            </p>
          </dl>
        ) : (
          <p className="text-sm text-slate-600">
            {r.status === 'CANCELLED'
              ? 'Cancelled before the trip started: nothing to pay.'
              : `Estimate: ${taka(r.estimate.pooledPoisha)} if shared, ${taka(r.estimate.soloPoisha)} alone. Fixed when the Tesla starts.`}
          </p>
        )}
        {r.payment && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Paid {taka(r.payment.amountPoisha)} {r.payment.method === 'WALLET' ? 'from TeslaPay' : 'in cash'} at{' '}
            {time(r.payment.paidAt)}
          </p>
        )}
      </Card>

      <Card title="What happened">
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {r.timeline.map((event, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{RIDE_STATUS_LABEL[event.status]}</span>
              <span className="text-slate-500">
                {' '}
                · {time(event.at)} · by {event.by}
              </span>
              {event.reason && <span className="block text-slate-500">{event.reason}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t border-slate-200 pt-2 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
