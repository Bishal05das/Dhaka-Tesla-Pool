'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { mmss, useCountdown } from '@/hooks/useCountdown';
import { api, ApiError } from '@/lib/api';
import { RIDE_STATUS_LABEL, taka } from '@/lib/format';
import type { Ride, RideStatus } from '@/lib/types';
import { StatusSteps } from './StatusSteps';

const CANCELLABLE: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'];

export function ActiveRideCard({ ride, onChanged }: { ride: Ride; onChanged: () => void }) {
  return (
    <Card
      title={RIDE_STATUS_LABEL[ride.status]}
      action={
        <Link href={`/passenger/rides/${ride.id}`} className="text-sm font-semibold text-emerald-700 hover:underline">
          Details
        </Link>
      }
    >
      <StatusSteps status={ride.status} />
      {ride.status === 'REQUESTED' && <WaitingCountdown expiresAt={ride.expiresAt} />}

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Item label="Trip">
          {ride.pickup.name} → {ride.drop.name}
        </Item>
        <Item label="Seats">{ride.seats}</Item>
        <Item label="Tesla">
          {ride.tesla ? (
            <>
              {ride.tesla.driverName} in {ride.tesla.vehicleName}
              <span className="block text-slate-500">{ride.tesla.plate}</span>
            </>
          ) : (
            <span className="text-slate-500">Looking for a driver…</span>
          )}
        </Item>
        <Item label="Sharing">
          {ride.tesla ? (
            ride.tesla.coRiders === 0 ? (
              'Just you so far'
            ) : (
              `With ${ride.tesla.coRiders} other passenger${ride.tesla.coRiders > 1 ? 's' : ''}`
            )
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Item>
        <Item label="Fare">
          {ride.fare ? (
            <>
              <span className="font-semibold">{taka(ride.fare.totalPoisha)}</span>
              <span className="block text-slate-500">{ride.fare.pooled ? 'Shared fare, fixed' : 'Solo fare, fixed'}</span>
            </>
          ) : (
            <>
              {taka(ride.estimate.pooledPoisha)} shared · {taka(ride.estimate.soloPoisha)} alone
              <span className="block text-slate-500">Fixed when the Tesla starts</span>
            </>
          )}
        </Item>
        <Item label="Paying">{ride.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'}</Item>
      </dl>

      {CANCELLABLE.includes(ride.status) && <CancelRide rideId={ride.id} onCancelled={onChanged} />}
      {ride.status === 'STARTED' && (
        <p className="mt-4 text-sm text-slate-500">You&apos;re on the road. Rides can&apos;t be cancelled once they start.</p>
      )}
    </Card>
  );
}

// Nobody waits forever: the request gives up after 5 minutes without a driver.
function WaitingCountdown({ expiresAt }: { expiresAt: string | null }) {
  const left = useCountdown(expiresAt);
  if (left === null) return null;
  return (
    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
      {left > 0 ? (
        <>
          Waiting for a driver to accept. If nobody does within <strong>{mmss(left)}</strong>, we&apos;ll cancel the
          request so you&apos;re not stuck waiting.
        </>
      ) : (
        'No driver accepted in time. Closing this request…'
      )}
    </p>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}

function CancelRide({ rideId, onCancelled }: { rideId: string; onCancelled: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/rides/${rideId}/cancel`, { method: 'POST', body: reason ? { reason } : {} });
      onCancelled();
    } catch (err) {
      // e.g. the Tesla started a moment ago: the server refuses and says why. The message stays
      // visible; the next poll brings the new status.
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" className="mt-5 w-full" onClick={() => setConfirming(true)}>
        Cancel ride
      </Button>
    );
  }

  return (
    <div className="mt-5 space-y-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
      <p className="text-sm font-semibold text-red-800">Cancel this ride? It&apos;s free until the Tesla starts.</p>
      <Field label="Reason (optional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      {error && <Alert>{error.message}</Alert>}
      <div className="flex gap-2">
        <Button variant="danger" loading={busy} onClick={cancel}>
          Yes, cancel
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
          Keep my ride
        </Button>
      </div>
    </div>
  );
}
