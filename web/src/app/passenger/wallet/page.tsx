'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api, ApiError } from '@/lib/api';
import { dateTime, taka } from '@/lib/format';
import type { Wallet } from '@/lib/types';

const QUICK_AMOUNTS = [100, 200, 500];

export default function WalletPage() {
  const wallet = useApi<Wallet>('/wallet');
  const [amount, setAmount] = useState('200');
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function topUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    // Typed in taka, sent in poisha. Rounding here avoids 0.1 + 0.2 style float leftovers.
    const amountPoisha = Math.round(Number(amount) * 100);
    try {
      await api('/wallet/topup', { method: 'POST', body: { amountPoisha } });
      setDone(`Added ${taka(amountPoisha)} to TeslaPay.`);
      wallet.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  if (wallet.loading) return <PageLoading label="Loading TeslaPay…" />;
  if (!wallet.data) return <Alert>{wallet.error?.message ?? 'Could not load your wallet.'}</Alert>;

  const fieldErrors = error?.fieldErrors() ?? {};

  return (
    <>
      <Card title="TeslaPay">
        <p className="text-sm text-slate-500">Balance</p>
        <p className="text-4xl font-bold">{taka(wallet.data.balancePoisha)}</p>
        <p className="mt-2 text-sm text-slate-500">
          Simulated wallet: no real money moves. Rides paid with TeslaPay are charged when the trip completes.
        </p>
      </Card>

      <Card title="Top up">
        <form onSubmit={topUp} className="space-y-3">
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${
                  amount === String(a) ? 'bg-emerald-50 ring-emerald-600' : 'ring-slate-300'
                }`}
              >
                ৳{a}
              </button>
            ))}
          </div>
          <Field
            label="Amount (৳)"
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            errors={fieldErrors.amountPoisha}
            hint="৳1 to ৳5,000 at a time"
          />
          {error && !fieldErrors.amountPoisha && <Alert>{error.message}</Alert>}
          {done && <Alert tone="success">{done}</Alert>}
          <Button type="submit" loading={busy}>
            Add money
          </Button>
        </form>
      </Card>

      <Card title="Activity">
        {wallet.data.transactions.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {wallet.data.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">
                    {t.type === 'TOPUP' ? (
                      'Top-up'
                    ) : t.rideRequestId ? (
                      <Link href={`/passenger/rides/${t.rideRequestId}`} className="hover:underline">
                        Ride payment
                      </Link>
                    ) : (
                      'Ride payment'
                    )}
                  </p>
                  <p className="text-slate-500">{dateTime(t.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={t.amountPoisha > 0 ? 'font-semibold text-emerald-700' : 'font-semibold'}>
                    {t.amountPoisha > 0 ? '+' : ''}
                    {taka(t.amountPoisha)}
                  </p>
                  <p className="text-slate-500">Balance {taka(t.balanceAfterPoisha)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
