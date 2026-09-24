import { RoleGate } from '@/components/auth/RoleGate';
import { AppShell, type NavItem } from '@/components/layout/AppShell';

const NAV: NavItem[] = [
  { href: '/passenger', label: 'Ride', icon: 'ride' },
  { href: '/passenger/history', label: 'My rides', icon: 'history' },
  { href: '/passenger/wallet', label: 'TeslaPay', icon: 'wallet' },
];

export default function PassengerLayout({ children }: LayoutProps<'/passenger'>) {
  return (
    <RoleGate role="PASSENGER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RoleGate>
  );
}
