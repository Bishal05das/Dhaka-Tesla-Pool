'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { homeFor, useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import type { Role, User } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [role, setRole] = useState<Role>('PASSENGER');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [vehicle, setVehicle] = useState({ name: '', plate: '', capacity: '3' });
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body =
      role === 'DRIVER'
        ? { role, ...form, vehicle: { ...vehicle, capacity: Number(vehicle.capacity) } }
        : { role, ...form };
    try {
      const { user } = await api<{ user: User }>('/auth/register', { method: 'POST', body });
      setUser(user);
      router.replace(homeFor(user));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'));
      setSubmitting(false);
    }
  }

  const fieldErrors = error?.fieldErrors() ?? {};
  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-slate-500">Ride along the Banani line, or put your own Tesla on it.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">I want to</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                ['PASSENGER', 'Ride'],
                ['DRIVER', 'Drive my Tesla'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => setRole(value)}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${
                  role === value ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white ring-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <Alert>{error.message}</Alert>}

        <Field label="Name" autoComplete="name" value={form.name} onChange={update('name')} errors={fieldErrors.name} />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          errors={fieldErrors.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={form.password}
          onChange={update('password')}
          errors={fieldErrors.password}
        />

        {role === 'DRIVER' && (
          <fieldset className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold">Your Tesla</legend>
            {fieldErrors.vehicle && <Alert>{fieldErrors.vehicle.join(' ')}</Alert>}
            <Field
              label="Tesla name"
              placeholder="e.g. Bullet"
              value={vehicle.name}
              onChange={(e) => setVehicle((v) => ({ ...v, name: e.target.value }))}
            />
            <Field
              label="Plate number"
              placeholder="e.g. DHAKA-TESLA-11"
              value={vehicle.plate}
              onChange={(e) => setVehicle((v) => ({ ...v, plate: e.target.value }))}
            />
            <SelectField
              label="Passenger seats"
              hint="Fixed after sign-up"
              value={vehicle.capacity}
              onChange={(e) => setVehicle((v) => ({ ...v, capacity: e.target.value }))}
            >
              <option value="1">1 seat</option>
              <option value="2">2 seats</option>
              <option value="3">3 seats</option>
            </SelectField>
          </fieldset>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
