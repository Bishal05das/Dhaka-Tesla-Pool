import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 block text-center">
        <span className="text-2xl font-bold">Dhaka Tesla Pool</span>
        <span className="block text-sm text-slate-500">Share a seat. Split the fare. Survive Dhaka traffic.</span>
      </Link>
      {children}
    </main>
  );
}
