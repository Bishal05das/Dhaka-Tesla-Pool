'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { PageLoading } from '@/components/ui/Spinner';
import type { Role } from '@/lib/types';
import { homeFor, useAuth } from './AuthProvider';

// Renders children only for a signed-in user with the right role. A passenger opening
// /driver is sent to /passenger, and vice versa. (The API enforces the same rule with 403s;
// this just keeps people on screens that work for them.)
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace('/login');
    else if (user && user.role !== role) router.replace(homeFor(user));
  }, [user, role, router]);

  if (!user || user.role !== role) return <PageLoading />;
  return <>{children}</>;
}
