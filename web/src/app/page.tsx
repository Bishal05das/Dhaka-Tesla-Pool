'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor, useAuth } from '@/components/auth/AuthProvider';
import { PageLoading } from '@/components/ui/Spinner';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  // Signed-in users go straight to their own screen.
  useEffect(() => {
    if (user) router.replace(homeFor(user));
  }, [user, router]);

  if (user !== null) return <PageLoading />;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-bold">Dhaka Tesla Pool</h1>
      <p className="mt-2 text-slate-600">Share a seat. Split the fare. Survive Dhaka traffic.</p>
      <p className="mt-6 text-slate-700">
        Book a seat from Banani along the line to Mohakhali, Gulshan or Bashundhara. Share the Tesla with others
        going the same way and pay 25% less on distance.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          Sign in
        </Link>
        <Link href="/register" className="rounded-lg px-4 py-2 font-semibold ring-1 ring-slate-300 hover:bg-slate-100">
          Create an account
        </Link>
      </div>
    </main>
  );
}
