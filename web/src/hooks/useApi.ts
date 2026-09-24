'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface State<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}

// GET `path` and keep the result. With `pollMs`, fetch again on that interval while the tab is
// visible: that is how a passenger sees "Tesla on the way" turn into "Tesla at pickup" without
// refreshing. Old data stays on screen during a refresh, so the page doesn't flicker.
// A null path means "don't fetch yet".
export function useApi<T>(path: string | null, { pollMs }: { pollMs?: number } = {}) {
  const [state, setState] = useState<State<T>>({ loading: path !== null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path === null) return;
    let active = true;
    api<T>(path)
      .then((data) => {
        if (active) setState({ data, loading: false });
      })
      .catch((err: unknown) => {
        const error = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong');
        if (active) setState((s) => ({ data: s.data, error, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [path, tick]);

  useEffect(() => {
    if (!pollMs || path === null) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, path, reload]);

  return { ...state, reload };
}

// How often screens with a live ride refresh. Documented trade-off: simple and works on
// free hosting; push (SSE/WebSockets) is the scale-up path.
export const LIVE_POLL_MS = 5000;
