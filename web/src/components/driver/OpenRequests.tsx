'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { mmss, useCountdown } from '@/hooks/useCountdown';
import { api, ApiError } from '@/lib/api';
import { taka, time } from '@/lib/format';
import type { OpenRequest } from '@/lib/types';

interface Props {
  requests: OpenRequest[];
  seatsFree: number;
  isOnline: boolean;
  onAccepted: () => void;
}

function ExpiresIn({ at }: { at: string }) {
  const left = useCountdown(at) ?? 0;
  return <span className={left < 60 ? 'font-semibold text-red-700' : ''}>expires in {mmss(left)}</span>;
}

// Passengers waiting at the start of the line whose seats fit in the Tesla right now.
export function OpenRequests({ requests, seatsFree, isOnline, onAccepted }: Props) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function accept(id: string) {
    setAcceptingId(id);
    setError(null);
    try {
      await api(`/driver/requests/${id}/accept`, { method: 'POST' });
    } catch (err) {
      // Someone else was quicker, the passenger cancelled, or the seat just went.
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
    } finally {
      setAcceptingId(null);
      onAccepted();
    }
  }

  return (
    <Card title="Waiting passengers" action={<span className="text-sm text-slate-500">{seatsFree} seat{seatsFree === 1 ? '' : 's'} free</span>}>
      {!isOnline && (
        <div className="mb-3">
          <Alert tone="info">Go online to accept passengers.</Alert>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}
      {requests.length === 0 ? (
        <EmptyState title={seatsFree === 0 ? 'No seats free' : 'Nobody waiting right now'}>
          {seatsFree === 0 ? 'Finish the current trip to take more passengers.' : 'New requests appear here automatically.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="text-sm">
                <p className="font-semibold">
                  {r.passengerName} <span className="font-normal text-slate-500">· {r.seats} seat{r.seats > 1 ? 's' : ''}</span>
                </p>
                <p className="text-slate-600">
                  {r.pickup.name} → {r.drop.name}
                </p>
                <p className="text-slate-500">
                  {taka(r.estimate.pooledPoisha)}–{taka(r.estimate.soloPoisha)} · {r.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'} ·
                  since {time(r.requestedAt)} · <ExpiresIn at={r.expiresAt} />
                </p>
              </div>
              <Button
                onClick={() => accept(r.id)}
                loading={acceptingId === r.id}
                disabled={!isOnline || acceptingId !== null}
              >
                Accept
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
