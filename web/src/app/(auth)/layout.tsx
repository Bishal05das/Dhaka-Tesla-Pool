import { Clock, Coins, Users } from 'lucide-react';
import Link from 'next/link';
import { Logo, LogoMark } from '@/components/brand/Logo';

const POINTS = [
  { icon: Users, text: 'Share a three-seat Tesla with people going your way.' },
  { icon: Coins, text: 'Pay 25% less on distance when you share. Your fare, never anyone else’s.' },
  { icon: Clock, text: 'No endless waiting: no seat, no request; no driver in 5 minutes, you’re told.' },
];

const LINE = ['Banani', 'Mohakhali', 'Gulshan 1', 'Gulshan 2', 'Bashundhara'];

// Desktop: brand panel on the left, the form on the right. Phones: just the form.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-emerald-700 via-teal-800 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" onDark />
          <span className="text-lg font-bold">Dhaka Tesla Pool</span>
        </div>

        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Share a seat. Split the fare. Survive Dhaka traffic.
          </h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex max-w-md gap-3 text-emerald-50">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* The one route every Tesla runs. */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-200">The line</p>
          <ol className="flex items-center">
            {LINE.map((stop, i) => (
              <li key={stop} className="flex flex-1 items-center last:flex-none">
                <span className="flex flex-col items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${i === 0 ? 'bg-emerald-300 ring-4 ring-emerald-300/30' : 'bg-white/70'}`} />
                  <span className="text-xs text-emerald-100">{stop}</span>
                </span>
                {i < LINE.length - 1 && <span className="mb-6 h-0.5 flex-1 bg-white/30" />}
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo tagline />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
