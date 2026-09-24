'use client';

import { Users } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { mmss, useCountdown } from '@/hooks/useCountdown';
import { api, ApiError } from '@/lib/api';
import { taka } from '@/lib/format';
import type { OpenRequest } from '@/lib/types';

interface Props {
  requests: OpenRequest[];
  seatsFree: number;
  isOnline: boolean;
  onAccepted: () => void;
}

function ExpiresIn({ at }: { at: string }) {
  const left = useCountdown(at) ?? 0;
  return (
    <span className={`font-mono text-xs ${left < 60 ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
      {mmss(left)} left
    </span>
  );
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
    <Card
      title="Waiting passengers"
      subtitle={`${seatsFree} seat${seatsFree === 1 ? '' : 's'} free in your Tesla`}
      icon={Users}
    >
      <div className="space-y-3">
        {!isOnline && <Alert tone="info">Go online to accept passengers.</Alert>}
        {error && <Alert>{error.message}</Alert>}
        {requests.length === 0 ? (
          <EmptyState icon={Users} title={seatsFree === 0 ? 'No seats free' : 'Nobody waiting right now'}>
            {seatsFree === 0 ? 'Finish the current trip to take more passengers.' : 'New requests appear here automatically.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                    {r.passengerName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{r.passengerName}</span>
                      <ExpiresIn at={r.expiresAt} />
                    </p>
                    <p className="text-slate-600">
                      to {r.drop.name} · {r.seats} seat{r.seats > 1 ? 's' : ''}
                    </p>
                    <p className="text-slate-500">
                      {taka(r.estimate.pooledPoisha)}–{taka(r.estimate.soloPoisha)} · {r.paymentMethod === 'WALLET' ? 'TeslaPay' : 'Cash'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => accept(r.id)}
                  loading={acceptingId === r.id}
                  disabled={!isOnline || acceptingId !== null}
                  className="mt-3 w-full"
                >
                  Accept {r.passengerName}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
