'use client';

import { Power } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { api, ApiError } from '@/lib/api';

export function OnlineToggle({ isOnline, onChanged }: { isOnline: boolean; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const tesla = user?.vehicle;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api('/driver/status', { method: 'PATCH', body: { online: !isOnline } });
      onChanged();
    } catch (err) {
      // e.g. "Finish or cancel your current trip before going offline".
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`rounded-2xl p-5 text-white shadow-sm transition-colors ${
        isOnline ? 'bg-linear-to-br from-emerald-600 to-teal-800' : 'bg-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">{tesla ? `${tesla.name} · ${tesla.plate}` : 'Your Tesla'}</p>
          <p className="mt-0.5 text-xl font-bold">{isOnline ? "You're online" : "You're offline"}</p>
          <p className="mt-1 text-sm text-white/80">
            {isOnline ? 'Passengers can book, and you can accept them.' : 'Go online to take passengers.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          role="switch"
          aria-checked={isOnline}
          aria-label={isOnline ? 'Go offline' : 'Go online'}
          className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-4 transition disabled:opacity-60 ${
            isOnline ? 'bg-white text-emerald-700 ring-white/30' : 'bg-emerald-500 text-white ring-emerald-500/30 hover:bg-emerald-400'
          }`}
        >
          <Power className="h-6 w-6" />
        </button>
      </div>
      {error && (
        <div className="mt-3 text-slate-900">
          <Alert>{error.message}</Alert>
        </div>
      )}
    </section>
  );
}
