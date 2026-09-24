import { RoleGate } from '@/components/auth/RoleGate';
import { AppShell } from '@/components/layout/AppShell';

const NAV = [
  { href: '/driver', label: 'Trip' },
  { href: '/driver/history', label: 'History' },
];

export default function DriverLayout({ children }: LayoutProps<'/driver'>) {
  return (
    <RoleGate role="DRIVER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RoleGate>
  );
}
