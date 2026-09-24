import { RoleGate } from '@/components/auth/RoleGate';
import { AppShell } from '@/components/layout/AppShell';

const NAV = [
  { href: '/passenger', label: 'Ride' },
  { href: '/passenger/history', label: 'History' },
  { href: '/passenger/wallet', label: 'TeslaPay' },
];

export default function PassengerLayout({ children }: LayoutProps<'/passenger'>) {
  return (
    <RoleGate role="PASSENGER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RoleGate>
  );
}
