'use client';

import { Banknote, CarFront, Flag, Play, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { RouteLine, type TeslaPosition } from '@/components/route/RouteLine';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import { POOL_STATUS_LABEL, taka } from '@/lib/format';
import type { Pool, PoolStatus, Stop } from '@/lib/types';
import { SeatMeter } from './SeatMeter';

type Action = 'arrive' | 'start' | 'complete' | 'cancel';

// The one next step for each state, so Jashim can't press them out of order
// (and the API would refuse with 409 if he somehow did).
const NEXT: Partial<Record<PoolStatus, { action: Action; label: string; icon: typeof Flag }>> = {
  MATCHED: { action: 'arrive', label: "I've arrived at the pickup", icon: Flag },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip', icon: Play },
  STARTED: { action: 'complete', label: 'Complete trip', icon: Flag },
};

const TESLA_AT: Partial<Record<PoolStatus, TeslaPosition>> = {
  MATCHED: 'approaching',
  DRIVER_ARRIVED: 'at-pickup',
  STARTED: 'moving',
};

interface Props {
  pool: Pool | null;
  stops: Stop[];
  onChanged: (finished?: Pool) => void;
}

export function CurrentTrip({ pool, stops, onChanged }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  if (!pool) {
    return (
      <Card title="Current trip" icon={CarFront}>
        <RouteLine stops={stops} />
        <div className="mt-6">
          <EmptyState icon={CarFront} title="Bullet is empty">
            Accept a waiting passenger and a trip starts here.
          </EmptyState>
        </div>
      </Card>
    );
  }

  async function run(action: Action) {
    if (!pool) return;
    setBusy(action);
    setError(null);
    try {
      const { pool: updated } = await api<{ pool: Pool }>(`/pools/${pool.id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' && reason ? { reason } : {},
      });
      setCancelling(false);
      setReason('');
      onChanged(updated.status === 'COMPLETED' || updated.status === 'CANCELLED' ? updated : undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const next = NEXT[pool.status];
  const canCancel = pool.status === 'MATCHED' || pool.status === 'DRIVER_ARRIVED';
  const pickupId = stops[0]?.id;
  // Who gets off where, for the route diagram.
  const dropOffs: Record<number, string[]> = {};
  for (const p of pool.passengers) (dropOffs[p.drop.id] ??= []).push(p.seats > 1 ? `${p.name} ×${p.seats}` : p.name);

  return (
    <Card
      title="Current trip"
      subtitle={POOL_STATUS_LABEL[pool.status]}
      icon={CarFront}
      action={<SeatMeter capacity={pool.capacity} occupied={pool.seatsOccupied} />}
    >
      <div className="space-y-6">
        <RouteLine stops={stops} pickupId={pickupId} dropOffs={dropOffs} tesla={TESLA_AT[pool.status]} />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Drop-offs, in order</p>
          <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {pool.passengers.map((p, i) => (
              <li key={p.rideId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{p.name}</span>
                  <span className="block text-slate-500">
                    to {p.drop.name} · {p.seats} seat{p.seats > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{p.farePoisha !== null ? taka(p.farePoisha) : '—'}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    {p.paymentMethod === 'WALLET' ? <Wallet className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                    {p.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {pool.status !== 'STARTED' && (
            <p className="mt-2 text-xs text-slate-500">
              Fares are fixed when you start: shared if more than one passenger is aboard.
            </p>
          )}
        </div>

        {error && <Alert>{error.message}</Alert>}

        {cancelling ? (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Cancel this trip for every passenger?</p>
            <Field label="Reason passengers will see (optional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="danger" loading={busy === 'cancel'} onClick={() => run('cancel')}>
                Yes, cancel trip
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => setCancelling(false)}>
                Keep trip
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {next && (
              <Button size="lg" loading={busy === next.action} disabled={busy !== null} onClick={() => run(next.action)} className="flex-1 sm:flex-none">
                <next.icon className="h-4 w-4" />
                {next.label}
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" size="lg" disabled={busy !== null} onClick={() => setCancelling(true)}>
                <X className="h-4 w-4" />
                Cancel trip
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
