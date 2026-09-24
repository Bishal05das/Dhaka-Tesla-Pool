import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  error: { box: 'bg-red-50 text-red-800 border-red-200', Icon: TriangleAlert },
  info: { box: 'bg-sky-50 text-sky-900 border-sky-200', Icon: Info },
  warning: { box: 'bg-amber-50 text-amber-900 border-amber-200', Icon: Info },
  success: { box: 'bg-emerald-50 text-emerald-900 border-emerald-200', Icon: CircleCheck },
} as const;

export function Alert({ tone = 'error', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  const { box, Icon } = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
