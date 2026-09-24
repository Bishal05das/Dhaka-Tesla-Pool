'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api, ApiError } from '@/lib/api';
import { km, taka } from '@/lib/format';
import type { FareQuote, PaymentMethod, Ride, Stop, Wallet } from '@/lib/types';

export function RequestRideForm({ onRequested }: { onRequested: (ride: Ride) => void }) {
  const stops = useApi<{ stops: Stop[] }>('/stops');
  const wallet = useApi<Wallet>('/wallet');

  const [dropId, setDropId] = useState<number | null>(null);
  const [seats, setSeats] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [quote, setQuote] = useState<{ key: string; value?: FareQuote; error?: ApiError } | null>(null);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const line = stops.data?.stops ?? [];
  const pickup = line[0];
  const drops = line.slice(1);
  const drop = dropId ?? drops[0]?.id ?? null;
  const quoteKey = `${pickup?.id}-${drop}-${seats}`;

  // Re-price whenever the trip changes. The server does the maths, so what is shown here is
  // exactly what gets stored with the ride.
  useEffect(() => {
    if (!pickup || drop === null) return;
    let active = true;
    api<FareQuote>('/fares/estimate', { method: 'POST', body: { pickupStopId: pickup.id, dropStopId: drop, seats } })
      .then((value) => active && setQuote({ key: quoteKey, value }))
      .catch((error: ApiError) => active && setQuote({ key: quoteKey, error }));
    return () => {
      active = false;
    };
  }, [pickup, drop, seats, quoteKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickup || drop === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { ride } = await api<{ ride: Ride }>('/rides', {
        method: 'POST',
        body: { pickupStopId: pickup.id, dropStopId: drop, seats, paymentMethod: payment },
      });
      onRequested(ride);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      setSubmitting(false);
    }
  }

  if (stops.loading) return <PageLoading label="Loading the route…" />;
  if (stops.error || !pickup) {
    return <Alert>{stops.error?.message ?? 'The route is not set up yet.'}</Alert>;
  }

  const current = quote?.key === quoteKey ? quote : null;
  const balance = wallet.data?.balancePoisha;

  return (
    <Card title="Where to?">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <span className="block text-sm font-medium text-slate-700">Pickup</span>
          <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-slate-800">{pickup.name}</p>
          <p className="mt-1 text-sm text-slate-500">Every Tesla starts from {pickup.name} and runs along one line.</p>
        </div>

        <SelectField label="Drop-off" value={drop ?? ''} onChange={(e) => setDropId(Number(e.target.value))}>
          {drops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({km(s.distanceFromStartM - pickup.distanceFromStartM)})
            </option>
          ))}
        </SelectField>

        <SelectField label="Seats" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
          <option value={1}>1 seat</option>
          <option value={2}>2 seats</option>
          <option value={3}>3 seats</option>
        </SelectField>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Pay with</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['CASH', 'WALLET'] as const).map((method) => (
              <label
                key={method}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ring-1 ${
                  payment === method ? 'bg-emerald-50 ring-emerald-600' : 'bg-white ring-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={method}
                  checked={payment === method}
                  onChange={() => setPayment(method)}
                  className="sr-only"
                />
                <span className="font-semibold">{method === 'CASH' ? 'Cash' : 'TeslaPay'}</span>
                {method === 'WALLET' && balance !== undefined && (
                  <span className="block text-slate-500">Balance {taka(balance)}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <FareBox quote={current} />

        {submitError && (
          <Alert>
            {submitError.message}
            {submitError.code === 'INSUFFICIENT_BALANCE' && (
              <>
                {' '}
                <Link href="/passenger/wallet" className="font-semibold underline">
                  Top up TeslaPay
                </Link>
              </>
            )}
          </Alert>
        )}

        <Button type="submit" loading={submitting} disabled={!current?.value} className="w-full">
          Request a seat
        </Button>
      </form>
    </Card>
  );
}

function FareBox({ quote }: { quote: { value?: FareQuote; error?: ApiError } | null }) {
  if (!quote) {
    return <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">Working out the fare…</p>;
  }
  if (quote.error) return <Alert>{quote.error.message}</Alert>;
  const { solo, pooled } = quote.value!.estimate;
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-600">If you share the Tesla</span>
        <span className="text-xl font-bold text-emerald-700">{taka(pooled.totalPoisha)}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between text-sm text-slate-600">
        <span>If you ride alone</span>
        <span>{taka(solo.totalPoisha)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {taka(solo.basePoisha)} base + {taka(solo.distanceChargePoisha)} distance. Sharing takes 25% off the
        distance part. Your fare is fixed when the Tesla starts: shared if anyone else is aboard then.
      </p>
    </div>
  );
}
