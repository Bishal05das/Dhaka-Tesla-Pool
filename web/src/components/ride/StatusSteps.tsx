import type { RideStatus } from '@/lib/types';
import { RIDE_STATUS_LABEL } from '@/lib/format';

const STEPS: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED'];

// The ride's progress as a row of steps. A cancelled ride shows where it stopped.
export function StatusSteps({ status, reachedBeforeCancel }: { status: RideStatus; reachedBeforeCancel?: RideStatus }) {
  // A cancelled or expired ride shows the step where it stopped, in red.
  const stopped = status === 'CANCELLED' || status === 'EXPIRED';
  const current = status === 'EXPIRED' ? 'REQUESTED' : status === 'CANCELLED' ? (reachedBeforeCancel ?? 'REQUESTED') : status;
  const index = STEPS.indexOf(current);

  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Ride progress">
      {STEPS.map((step, i) => {
        const done = i < index || (i === index && !stopped);
        const isCurrent = i === index;
        return (
          <li key={step} aria-current={isCurrent ? 'step' : undefined}>
            <div
              className={`h-1.5 rounded-full ${
                stopped && isCurrent ? 'bg-red-400' : done ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            />
            <span className={`mt-1 block text-[11px] leading-tight ${isCurrent ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
              {RIDE_STATUS_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ status }: { status: RideStatus }) {
  const tone =
    status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'CANCELLED' || status === 'EXPIRED'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{RIDE_STATUS_LABEL[status]}</span>;
}
