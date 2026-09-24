'use client';

import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api, ApiError } from '@/lib/api';
import { dateTime, taka } from '@/lib/format';
import type { Wallet as WalletData } from '@/lib/types';

const QUICK_AMOUNTS = [100, 200, 500];

export default function WalletPage() {
  const wallet = useApi<WalletData>('/wallet');
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
      <PageHeader title="TeslaPay" subtitle="A simulated wallet: no real money moves." />

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-linear-to-br from-emerald-600 to-teal-800 p-6 text-white shadow-sm">
            <p className="flex items-center gap-2 text-sm text-emerald-100">
              <Wallet className="h-4 w-4" /> Balance
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight">{taka(wallet.data.balancePoisha)}</p>
            <p className="mt-2 text-sm text-emerald-100">Rides paid with TeslaPay are charged when the trip completes.</p>
          </section>

          <Card title="Add money" icon={Plus}>
            <form onSubmit={topUp} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className={`rounded-xl border py-2 text-sm font-semibold ${
                      amount === String(a) ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50'
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
              <Button type="submit" loading={busy} className="w-full">
                Add money
              </Button>
            </form>
          </Card>
        </div>

        <Card title="Activity" subtitle="Every top-up and ride payment, with the balance after it.">
          {wallet.data.transactions.length === 0 ? (
            <EmptyState icon={Wallet} title="No activity yet">
              Top-ups and TeslaPay ride payments will show here.
            </EmptyState>
          ) : (
            <ul className="-mx-2 divide-y divide-slate-100 text-sm">
              {wallet.data.transactions.map((t) => {
                const incoming = t.amountPoisha > 0;
                const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-2 py-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        incoming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
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
                      <p className={`font-semibold ${incoming ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {incoming ? '+' : ''}
                        {taka(t.amountPoisha)}
                      </p>
                      <p className="text-xs text-slate-500">Balance {taka(t.balanceAfterPoisha)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
