'use client';

import { Armchair, Banknote, CarFront, Clock, Receipt, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { RouteLine, type TeslaPosition } from '@/components/route/RouteLine';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { mmss, useCountdown } from '@/hooks/useCountdown';
import { api, ApiError } from '@/lib/api';
import { RIDE_STATUS_LABEL, taka } from '@/lib/format';
import type { Ride, RideStatus, Stop } from '@/lib/types';
import { StatusSteps } from './StatusSteps';

const CANCELLABLE: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'];

const TESLA_AT: Partial<Record<RideStatus, TeslaPosition>> = {
  MATCHED: 'approaching',
  DRIVER_ARRIVED: 'at-pickup',
  STARTED: 'moving',
};

const HEADLINE: Partial<Record<RideStatus, string>> = {
  REQUESTED: 'Finding you a Tesla',
  MATCHED: 'Your Tesla is on the way',
  DRIVER_ARRIVED: 'Your Tesla is at the pickup',
  STARTED: 'On the road',
};

export function ActiveRideCard({ ride, stops, onChanged }: { ride: Ride; stops: Stop[]; onChanged: () => void }) {
  return (
    <Card
      title={HEADLINE[ride.status] ?? RIDE_STATUS_LABEL[ride.status]}
      subtitle={`${ride.pickup.name} → ${ride.drop.name}`}
      icon={CarFront}
      action={
        <Link href={`/passenger/rides/${ride.id}`} className="text-sm font-semibold text-emerald-700 hover:underline">
          Details
        </Link>
      }
    >
      <div className="space-y-6">
        <StatusSteps status={ride.status} />
        {ride.status === 'REQUESTED' && <WaitingCountdown expiresAt={ride.expiresAt} />}
        <RouteLine stops={stops} pickupId={ride.pickup.id} dropId={ride.drop.id} tesla={TESLA_AT[ride.status]} />

        {ride.tesla && (
          <div className="flex items-center gap-4 rounded-xl bg-slate-900 p-4 text-white">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <CarFront className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {ride.tesla.driverName} in {ride.tesla.vehicleName}
              </p>
              <p className="text-sm text-slate-300">
                {ride.status === 'MATCHED'
                  ? `Heading to ${ride.pickup.name}`
                  : ride.status === 'DRIVER_ARRIVED'
                    ? `Waiting for you at ${ride.pickup.name}`
                    : `Driving you to ${ride.drop.name}`}
              </p>
            </div>
            <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-sm tracking-wider">{ride.tesla.plate}</span>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail icon={Armchair} label="Seats" value={ride.seats} />
          <Detail
            icon={Users}
            label="Sharing"
            value={
              !ride.tesla
                ? '—'
                : ride.tesla.coRiders === 0
                  ? 'Just you so far'
                  : `+${ride.tesla.coRiders} passenger${ride.tesla.coRiders > 1 ? 's' : ''}`
            }
          />
          <Detail
            icon={Receipt}
            label={ride.fare ? (ride.fare.pooled ? 'Fare (shared)' : 'Fare (solo)') : 'Fare'}
            value={
              ride.fare
                ? taka(ride.fare.totalPoisha)
                : `${taka(ride.estimate.pooledPoisha)}–${taka(ride.estimate.soloPoisha)}`
            }
          />
          <Detail
            icon={ride.paymentMethod === 'WALLET' ? Wallet : Banknote}
            label="Paying"
            value={ride.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'}
          />
        </dl>
        {!ride.fare && (
          <p className="text-xs text-slate-500">
            Shared price if anyone else is aboard when the Tesla starts, otherwise the solo price.
          </p>
        )}

        {CANCELLABLE.includes(ride.status) && <CancelRide rideId={ride.id} onCancelled={onChanged} />}
        {ride.status === 'STARTED' && (
          <p className="text-sm text-slate-500">You&apos;re on the road. Rides can&apos;t be cancelled once they start.</p>
        )}
      </div>
    </Card>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

// Nobody waits forever: the request gives up after 5 minutes without a driver.
function WaitingCountdown({ expiresAt }: { expiresAt: string | null }) {
  const left = useCountdown(expiresAt);
  if (left === null) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Clock className="h-5 w-5 shrink-0" />
      {left > 0 ? (
        <p>
          Waiting for a driver to accept. If nobody does within <strong className="font-mono">{mmss(left)}</strong>,
          we&apos;ll close the request so you&apos;re not stuck waiting.
        </p>
      ) : (
        <p>No driver accepted in time. Closing this request…</p>
      )}
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
      <Button variant="danger" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
        Cancel ride
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
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
