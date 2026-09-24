'use client';

import { useEffect, useState } from 'react';

// Seconds left until `deadline` (ISO string), ticking every second; 0 once passed.
// null deadline → null.
export function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000));
}

export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
