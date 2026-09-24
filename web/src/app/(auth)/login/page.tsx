'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { homeFor, useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

// Seeded story cast, all with the password tesla1234 (see README "Demo credentials").
const DEMO_ACCOUNTS = [
  { name: 'Nusrat', email: 'nusrat@dhakatesla.test', role: 'passenger' },
  { name: 'Rafiq', email: 'rafiq@dhakatesla.test', role: 'passenger' },
  { name: 'Shirin', email: 'shirin@dhakatesla.test', role: 'passenger' },
  { name: 'Jashim', email: 'jashim@dhakatesla.test', role: 'driver of Bullet' },
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
      <Card title="Sign in">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && !Object.keys(fieldErrors).length && <Alert>{error.message}</Alert>}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
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
          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          New here?{' '}
          <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
            Create an account
          </Link>
        </p>
      </Card>

      <Card title="Demo accounts" className="mt-4">
        <p className="mb-3 text-sm text-slate-600">
          Password for all: <code className="rounded bg-slate-100 px-1">tesla1234</code>
        </p>
        <ul className="space-y-1 text-sm">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                className="text-left text-emerald-700 hover:underline"
                onClick={() => {
                  setEmail(a.email);
                  setPassword('tesla1234');
                }}
              >
                {a.name}
              </button>{' '}
              <span className="text-slate-500">— {a.role}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
