import { Zap } from 'lucide-react';

// The mark: a lightning bolt for the (battery-powered, entirely unaffiliated) "Tesla".
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm ${className}`}
      aria-hidden
    >
      <Zap className="h-1/2 w-1/2" fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className="block font-bold tracking-tight text-slate-900">Dhaka Tesla Pool</span>
        {tagline && <span className="block text-xs text-slate-500">Share a seat. Split the fare.</span>}
      </span>
    </span>
  );
}
