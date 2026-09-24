'use client';

import { ArrowRight, Clock, Coins, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor, useAuth } from '@/components/auth/AuthProvider';
import { Logo } from '@/components/brand/Logo';
import { PageLoading } from '@/components/ui/Spinner';

const FEATURES = [
  { icon: Users, title: 'Share the Tesla', text: 'Up to three passengers going the same way along the Banani line.' },
  { icon: Coins, title: 'Pay less together', text: '25% off the distance part of your fare when anyone shares. You only see your own fare.' },
  { icon: Clock, title: 'Never stuck waiting', text: 'No seat means no request. No driver within 5 minutes and you’re told straight away.' },
  { icon: ShieldCheck, title: 'Seats never oversold', text: 'Three seats means three passengers, even when two people book the last seat at once.' },
];

// The worked example from the brief, priced exactly as the app prices it.
const EXAMPLE = [
  { name: 'Nusrat', trip: 'Banani → Mohakhali', km: 3, solo: 90, shared: 75 },
  { name: 'Rafiq', trip: 'Banani → Gulshan 1', km: 5, solo: 130, shared: 105 },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  // Signed-in users go straight to their own screen.
  useEffect(() => {
    if (user) router.replace(homeFor(user));
  }, [user, router]);

  if (user !== null) return <PageLoading />;

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Sign in
          </Link>
          <Link href="/register" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Sign up
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
            Banani · Mohakhali · Gulshan · Bashundhara
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Share a seat. Split the fare. Survive Dhaka traffic.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-slate-600">
            Book a seat on a three-seat Tesla out of Banani. Share it with others going your way and pay less. Drivers
            see exactly who is riding and when to go.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Book a seat <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/register" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50">
              Drive your Tesla
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-linear-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 text-white shadow-xl sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-200">8:41 AM, Banani Road 11</p>
          <p className="mt-2 text-xl font-bold">Nusrat and Rafiq share Bullet</p>
          <table className="mt-6 w-full text-left text-sm">
            <thead className="text-emerald-200">
              <tr>
                <th className="pb-2 font-medium">Passenger</th>
                <th className="pb-2 text-right font-medium">Alone</th>
                <th className="pb-2 text-right font-medium">Shared</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE.map((r) => (
                <tr key={r.name} className="border-t border-white/15">
                  <td className="py-3">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="text-emerald-100/80">
                      {r.trip} · {r.km} km
                    </span>
                  </td>
                  <td className="py-3 text-right text-emerald-100/80 line-through">৳{r.solo}</td>
                  <td className="py-3 text-right text-lg font-bold">৳{r.shared}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-emerald-100/80">৳30 base + ৳20/km per seat, 25% off the distance part when shared.</p>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">
        Dhaka Tesla Pool: an MVP. The Teslas have three wheels and no affiliation with anyone.
      </footer>
    </div>
  );
}
