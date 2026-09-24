'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { homeFor, useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

// Seeded story cast, all with the password tesla1234 (see README "Demo credentials").
const DEMO_ACCOUNTS = [
  { name: 'Nusrat', email: 'nusrat@dhakatesla.test', role: 'passenger' },
  { name: 'Rafiq', email: 'rafiq@dhakatesla.test', role: 'passenger' },
  { name: 'Shirin', email: 'shirin@dhakatesla.test', role: 'passenger' },
  { name: 'Jashim', email: 'jashim@dhakatesla.test', role: 'drives Bullet' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      setUser(user);
      router.replace(homeFor(user));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      setSubmitting(false);
    }
  }

  const fieldErrors = error?.fieldErrors() ?? {};

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 text-slate-500">Sign in to book a seat or run your Tesla.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert>{error.message}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={fieldErrors.email}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={fieldErrors.password}
          required
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">Try the demo</p>
        <p className="mt-0.5 text-sm text-slate-500">
          Pick someone from the story. Password for all: <code className="rounded bg-slate-100 px-1">tesla1234</code>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword('tesla1234');
              }}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-emerald-400 hover:bg-emerald-50"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                {a.name.charAt(0)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-slate-900">{a.name}</span>
                <span className="block text-xs text-slate-500">{a.role}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
