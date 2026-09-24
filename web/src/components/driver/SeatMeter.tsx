import { Armchair } from 'lucide-react';

// Bullet's seats at a glance: filled = taken.
export function SeatMeter({ capacity, occupied }: { capacity: number; occupied: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${occupied} of ${capacity} seats taken`}>
      <div className="flex gap-1">
        {Array.from({ length: capacity }, (_, i) => (
          <span
            key={i}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
              i < occupied ? 'bg-emerald-600 text-white' : 'border border-dashed border-slate-300 text-slate-300'
            }`}
          >
            <Armchair className="h-4 w-4" />
          </span>
        ))}
      </div>
      <span className="text-sm font-medium text-slate-600">
        {occupied}/{capacity}
      </span>
    </div>
  );
}
