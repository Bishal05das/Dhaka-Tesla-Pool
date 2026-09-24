import { CarFront } from 'lucide-react';
import type { Stop } from '@/lib/types';

// Where the Tesla is, as far as the app knows (there is no GPS in this MVP):
// heading to the pickup, waiting at it, driving the line, or finished at the last drop-off.
export type TeslaPosition = 'approaching' | 'at-pickup' | 'moving' | 'arrived';

interface Props {
  stops: Stop[];
  // Passenger view: their own trip, highlighted.
  pickupId?: number;
  dropId?: number;
  // Driver view: who gets off at which stop.
  dropOffs?: Record<number, string[]>;
  tesla?: TeslaPosition;
}

// The single line every Tesla runs, drawn to scale by distance from the start, so the gap
// between stops matches the kilometres the fare charges for.
export function RouteLine({ stops, pickupId, dropId, dropOffs = {}, tesla }: Props) {
  if (stops.length < 2) return null;
  const first = stops[0]!;
  const total = stops.at(-1)!.distanceFromStartM - first.distanceFromStartM || 1;
  const pos = (s: Stop) => ((s.distanceFromStartM - first.distanceFromStartM) / total) * 100;

  const pickup = stops.find((s) => s.id === pickupId) ?? first;
  const drop = stops.find((s) => s.id === dropId);
  // Driver view: the trip runs to the furthest drop-off.
  const lastDropId = Object.keys(dropOffs).map(Number).at(-1);
  const end = drop ?? stops.find((s) => s.id === lastDropId);

  const teslaPct =
    tesla === 'approaching' || tesla === 'at-pickup'
      ? pos(pickup)
      : tesla === 'moving' && end
        ? (pos(pickup) + pos(end)) / 2
        : tesla === 'arrived' && end
          ? pos(end)
          : null;

  const hasMarkers = Object.keys(dropOffs).length > 0 || teslaPct !== null;

  return (
    <>
      <VerticalRoute stops={stops} pickup={pickup} end={end} dropOffs={dropOffs} tesla={tesla} />
      <div
        className={`relative mx-4 hidden sm:block ${hasMarkers ? 'h-32' : 'h-20'}`}
        role="img"
        aria-label={describe(stops, pickup, end)}
      >
      <div className={`absolute inset-x-0 ${hasMarkers ? 'top-14' : 'top-3'}`}>
        {/* The line, and the part this trip covers. */}
        <div className="absolute inset-x-0 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        {end && (
          <div
            className="absolute h-1.5 -translate-y-1/2 rounded-full bg-emerald-500"
            style={{ left: `${pos(pickup)}%`, width: `${pos(end) - pos(pickup)}%` }}
          />
        )}

        {stops.map((s, i) => {
          const isPickup = s.id === pickup.id;
          const isDrop = s.id === end?.id;
          const onTrip = end && pos(s) >= pos(pickup) && pos(s) <= pos(end);
          const names = dropOffs[s.id];
          const align = i === 0 ? 'items-start' : i === stops.length - 1 ? 'items-end' : 'items-center';
          const shift = i === 0 ? '' : i === stops.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
          return (
            <div key={s.id} className="absolute" style={{ left: `${pos(s)}%` }}>
              {names && (
                <div className={`absolute bottom-3 flex flex-col gap-1 ${align} ${shift}`}>
                  {names.map((n) => (
                    <span key={n} className="whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {n}
                    </span>
                  ))}
                </div>
              )}
              <span
                className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                  isPickup || isDrop
                    ? 'border-emerald-600 bg-white ring-4 ring-emerald-100'
                    : onTrip
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-white'
                }`}
              />
              <div className={`absolute top-4 flex flex-col ${align} ${shift}`}>
                <span className={`whitespace-nowrap text-xs ${isPickup || isDrop ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                  {s.name}
                </span>
                <span className="text-[11px] text-slate-400">{(s.distanceFromStartM - first.distanceFromStartM) / 1000} km</span>
              </div>
            </div>
          );
        })}

        {teslaPct !== null && (
          <div className="absolute -translate-x-1/2 -translate-y-full pb-3 transition-all duration-700" style={{ left: `${teslaPct}%` }}>
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full shadow ${
                tesla === 'approaching' ? 'bg-amber-500' : 'bg-slate-900'
              } text-white`}
              title="Your Tesla"
            >
              <CarFront className="h-4 w-4" />
            </span>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// Phones: the same line top to bottom, so stop names never collide.
function VerticalRoute({
  stops,
  pickup,
  end,
  dropOffs,
  tesla,
}: {
  stops: Stop[];
  pickup: Stop;
  end?: Stop;
  dropOffs: Record<number, string[]>;
  tesla?: TeslaPosition;
}) {
  const first = stops[0]!;
  const teslaStopId =
    tesla === 'approaching' || tesla === 'at-pickup' ? pickup.id : tesla === 'arrived' ? end?.id : undefined;
  const inTrip = (s: Stop) => end && s.distanceFromStartM >= pickup.distanceFromStartM && s.distanceFromStartM <= end.distanceFromStartM;

  return (
    <ol className="sm:hidden" aria-label={describe(stops, pickup, end)}>
      {stops.map((s, i) => {
        const key = s.id === pickup.id || s.id === end?.id;
        const segmentOn = inTrip(s) && stops[i + 1] && inTrip(stops[i + 1]!);
        return (
          <li key={s.id} className="flex gap-3">
            <div className="flex w-4 flex-col items-center">
              <span
                className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                  key ? 'border-emerald-600 bg-white ring-4 ring-emerald-100' : inTrip(s) ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                }`}
              />
              {i < stops.length - 1 && <span className={`w-1 flex-1 ${segmentOn ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
            <div className="flex min-h-11 flex-1 flex-wrap items-start justify-between gap-2 pb-2">
              <span className={`text-sm ${key ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                {s.name} <span className="text-xs text-slate-400">{(s.distanceFromStartM - first.distanceFromStartM) / 1000} km</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {teslaStopId === s.id && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${tesla === 'approaching' ? 'bg-amber-500' : 'bg-slate-900'}`}>
                    <CarFront className="h-3 w-3" /> {tesla === 'approaching' ? 'on the way' : 'Tesla here'}
                  </span>
                )}
                {tesla === 'moving' && s.id === pickup.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <CarFront className="h-3 w-3" /> on the road
                  </span>
                )}
                {dropOffs[s.id]?.map((n) => (
                  <span key={n} className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {n}
                  </span>
                ))}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function describe(stops: Stop[], pickup: Stop, end?: Stop) {
  const line = `Route line: ${stops.map((s) => s.name).join(', ')}.`;
  return end ? `${line} Trip from ${pickup.name} to ${end.name}.` : line;
}
