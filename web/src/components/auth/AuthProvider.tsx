'use client';

import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  // undefined = still checking the session; null = signed out.
  user: User | null | undefined;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Asks the API who is signed in (GET /api/auth/me) once, and shares the answer.
// The session itself is the httpOnly cookie; this is just a cached copy of "who am I".
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  useEffect(() => {
    let active = true;
    fetchMe()
      .catch(() => null)
      .then((me) => {
        if (active) setUser(me);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.replace('/login');
  }, [router]);

  return <AuthContext.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// The signed-in user, or null when there is no valid session.
async function fetchMe(): Promise<User | null> {
  try {
    return (await api<{ user: User }>('/auth/me')).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const homeFor =(user: User) => (user.role === 'DRIVER' ? '/driver' : '/passenger');
