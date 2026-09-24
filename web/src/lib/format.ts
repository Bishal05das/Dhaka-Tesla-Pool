import type { PoolStatus, RideStatus } from './types';

// 7500 → "৳75", 7550 → "৳75.50". Money arrives as integer poisha and is only turned into
// taka here, for display.
export function taka(poisha: number): string {
  const sign = poisha < 0 ? '−' : '';
  const abs = Math.abs(poisha);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  return `${sign}৳${whole}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

export const km = (metres: number) => `${(metres / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`;

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// What a passenger reads for each status.
export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: 'Waiting for a Tesla',
  MATCHED: 'Tesla on the way',
  DRIVER_ARRIVED: 'Tesla at pickup',
  STARTED: 'On the road',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

// What the driver reads for their trip.
export const POOL_STATUS_LABEL: Record<PoolStatus, string> = {
  MATCHED: 'Heading to pickup',
  DRIVER_ARRIVED: 'At pickup',
  STARTED: 'On the road',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
