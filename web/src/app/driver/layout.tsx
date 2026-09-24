import { RoleGate } from '@/components/auth/RoleGate';
import { AppShell, type NavItem } from '@/components/layout/AppShell';

const NAV: NavItem[] = [
  { href: '/driver', label: 'Trip', icon: 'trip' },
  { href: '/driver/history', label: 'Earnings', icon: 'history' },
];

export default function DriverLayout({ children }: LayoutProps<'/driver'>) {
  return (
    <RoleGate role="DRIVER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RoleGate>
  );
}
