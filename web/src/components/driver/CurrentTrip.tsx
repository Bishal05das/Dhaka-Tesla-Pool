'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import { POOL_STATUS_LABEL, taka } from '@/lib/format';
import type { Pool, PoolStatus } from '@/lib/types';
import { SeatMeter } from './SeatMeter';

type Action = 'arrive' | 'start' | 'complete' | 'cancel';

// The one next step for each state, so Jashim can't press them out of order
// (and the API would refuse with 409 if he somehow did).
const NEXT: Partial<Record<PoolStatus, { action: Action; label: string }>> = {
  MATCHED: { action: 'arrive', label: "I've arrived at the pickup" },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip' },
  STARTED: { action: 'complete', label: 'Complete trip' },
};

export function CurrentTrip({ pool, onChanged }: { pool: Pool | null; onChanged: (finished?: Pool) => void }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  if (!pool) {
    return (
      <Card title="Current trip">
        <EmptyState title="No passengers yet">Accept a waiting passenger to start a trip.</EmptyState>
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

  return (
    <Card title="Current trip" action={<span className="text-sm font-semibold text-amber-700">{POOL_STATUS_LABEL[pool.status]}</span>}>
      <SeatMeter capacity={pool.capacity} occupied={pool.seatsOccupied} />

      <p className="mt-4 text-sm font-medium text-slate-500">Drop-offs, in order</p>
      <ol className="mt-1 divide-y divide-slate-100">
        {pool.passengers.map((p) => (
          <li key={p.rideId} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-semibold">{p.name}</span> → {p.drop.name}
              <span className="text-slate-500">
                {' '}
                · {p.seats} seat{p.seats > 1 ? 's' : ''}
              </span>
            </span>
            <span className="text-right text-slate-600">
              {p.farePoisha !== null ? taka(p.farePoisha) : ''}{' '}
              <span className="text-slate-500">{p.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'}</span>
            </span>
          </li>
        ))}
      </ol>
      {pool.status !== 'STARTED' && pool.passengers.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Fares are fixed when you start: shared if more than one passenger is aboard.
        </p>
      )}

      {error && (
        <div className="mt-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {cancelling ? (
        <div className="mt-4 space-y-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
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
        <div className="mt-4 flex flex-wrap gap-2">
          {next && (
            <Button loading={busy === next.action} disabled={busy !== null} onClick={() => run(next.action)}>
              {next.label}
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" disabled={busy !== null} onClick={() => setCancelling(true)}>
              Cancel trip
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
