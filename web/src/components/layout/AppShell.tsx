'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function AppShell({ nav, children }: { nav: { href: string; label: string }[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={nav[0]?.href ?? '/'} className="font-bold">
            Dhaka Tesla Pool
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user?.name}
              {user?.vehicle && <span className="text-slate-400"> · {user.vehicle.name}</span>}
            </span>
            <button type="button" onClick={logout} className="font-semibold text-slate-700 hover:underline">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4" aria-label="Main">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">{children}</main>
    </div>
  );
}
