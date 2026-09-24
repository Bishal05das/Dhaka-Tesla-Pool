// Bullet's seats at a glance: filled = taken.
export function SeatMeter({ capacity, occupied }: { capacity: number; occupied: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${occupied} of ${capacity} seats taken`}>
      <div className="flex gap-1">
        {Array.from({ length: capacity }, (_, i) => (
          <span
            key={i}
            className={`h-6 w-6 rounded-md ring-1 ${i < occupied ? 'bg-emerald-600 ring-emerald-600' : 'bg-white ring-slate-300'}`}
          />
        ))}
      </div>
      <span className="text-sm text-slate-600">
        {occupied}/{capacity} seats taken
      </span>
    </div>
  );
}
