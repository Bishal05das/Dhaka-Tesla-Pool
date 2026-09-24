'use client';

import { ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { RouteLine } from '@/components/route/RouteLine';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { api, ApiError } from '@/lib/api';
import { km, taka } from '@/lib/format';
import type { FareQuote, PaymentMethod, Ride, Stop } from '@/lib/types';

interface Props {
  stops: Stop[];
  balancePoisha?: number;
  onRequested: (ride: Ride) => void;
}

export function RequestRideForm({ stops, balancePoisha, onRequested }: Props) {
  const pickup = stops[0]!;
  const drops = stops.slice(1);

  const [dropId, setDropId] = useState<number>(drops[0]?.id ?? 0);
  const [seats, setSeats] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [quote, setQuote] = useState<{ key: string; value?: FareQuote; error?: ApiError } | null>(null);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const quoteKey = `${pickup.id}-${dropId}-${seats}`;

  // Re-price whenever the trip changes. The server does the maths, so what is shown here is
  // exactly what gets stored with the ride.
  useEffect(() => {
    let active = true;
    api<FareQuote>('/fares/estimate', { method: 'POST', body: { pickupStopId: pickup.id, dropStopId: dropId, seats } })
      .then((value) => active && setQuote({ key: quoteKey, value }))
      .catch((error: ApiError) => active && setQuote({ key: quoteKey, error }));
    return () => {
      active = false;
    };
  }, [pickup.id, dropId, seats, quoteKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { ride } = await api<{ ride: Ride }>('/rides', {
        method: 'POST',
        body: { pickupStopId: pickup.id, dropStopId: dropId, seats, paymentMethod: payment },
      });
      onRequested(ride);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      setSubmitting(false);
    }
  }

  const current = quote?.key === quoteKey ? quote : null;

  return (
    <Card title="Book a seat" subtitle={`Every Tesla starts at ${pickup.name} and runs one line.`} icon={MapPin}>
      <form onSubmit={onSubmit} className="space-y-6">
        <RouteLine stops={stops} pickupId={pickup.id} dropId={dropId} />

        <Segmented
          label="Where are you getting off?"
          value={dropId}
          onChange={setDropId}
          columns="grid-cols-2 sm:grid-cols-4"
          options={drops.map((s) => ({
            value: s.id,
            label: s.name,
            hint: km(s.distanceFromStartM - pickup.distanceFromStartM),
          }))}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Segmented
            label="Seats"
            value={seats}
            onChange={setSeats}
            options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
          />
          <Segmented
            label="Pay with"
            value={payment}
            onChange={setPayment}
            options={[
              { value: 'CASH' as const, label: 'Cash', hint: 'Pay the driver' },
              {
                value: 'WALLET' as const,
                label: 'TeslaPay',
                hint: balancePoisha !== undefined ? taka(balancePoisha) : undefined,
              },
            ]}
          />
        </div>

        <FareBox quote={current} />

        {submitError && (
          <Alert tone={submitError.code === 'NO_TESLA_AVAILABLE' ? 'warning' : 'error'}>
            <p className="font-semibold">
              {submitError.code === 'NO_TESLA_AVAILABLE' ? "Can't book right now" : 'Request not sent'}
            </p>
            <p>
              {submitError.message}
              {submitError.code === 'INSUFFICIENT_BALANCE' && (
                <>
                  {' '}
                  <Link href="/passenger/wallet" className="font-semibold underline">
                    Top up TeslaPay
                  </Link>
                </>
              )}
            </p>
          </Alert>
        )}

        <Button type="submit" size="lg" loading={submitting} disabled={!current?.value} className="w-full">
          Request a seat to {drops.find((d) => d.id === dropId)?.name}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

function FareBox({ quote }: { quote: { value?: FareQuote; error?: ApiError } | null }) {
  if (!quote) {
    return <div className="h-[104px] animate-pulse rounded-xl bg-slate-100" aria-label="Working out the fare" />;
  }
  if (quote.error) return <Alert>{quote.error.message}</Alert>;
  const { solo, pooled } = quote.value!.estimate;
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Shared Tesla</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-800">{taka(pooled.totalPoisha)}</p>
        <p className="text-xs text-emerald-700">25% off the distance part</p>
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Riding alone</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-700">{taka(solo.totalPoisha)}</p>
        <p className="text-xs text-slate-500">
          {taka(solo.basePoisha)} base + {taka(solo.distanceChargePoisha)} distance
        </p>
      </div>
      <p className="col-span-2 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        Your fare is fixed when the Tesla starts: shared if anyone else is aboard then.
      </p>
    </div>
  );
}
