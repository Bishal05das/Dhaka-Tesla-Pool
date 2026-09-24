'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {tesla?.name ?? 'Your Tesla'} <span className="font-normal text-slate-500">{tesla?.plate}</span>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {isOnline ? 'Online: you can accept passengers' : 'Offline: passengers wait for you to go online'}
          </p>
        </div>
        <Button variant={isOnline ? 'secondary' : 'primary'} loading={busy} onClick={toggle}>
          {isOnline ? 'Go offline' : 'Go online'}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error.message}</Alert>
        </div>
      )}
    </Card>
  );
}
