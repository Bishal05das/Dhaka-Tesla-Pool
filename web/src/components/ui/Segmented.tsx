// Written out in full: Tailwind only generates classes it can find as whole strings.
const COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

// A row of mutually exclusive choices (seats, payment method, drop-off stop).
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; hint?: React.ReactNode }[];
  onChange: (value: T) => void;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className={`mt-1.5 grid gap-2 ${columns ?? COLS[options.length] ?? 'grid-cols-2'}`}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                selected
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="block font-semibold">{o.label}</span>
              {o.hint && <span className="block text-xs text-slate-500">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
