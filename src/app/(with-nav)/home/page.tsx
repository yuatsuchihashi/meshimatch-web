import { cookies } from 'next/headers';
import AccountHome from '@/components/home/AccountHome';
import { LocalHome } from '@/components/home/LocalHome';
import { isLocalMode, LOCAL_AUTH_COOKIE } from '@/lib/local-mode';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!isLocalMode()) return <AccountHome />;
  const signedIn = (await cookies()).has(LOCAL_AUTH_COOKIE);
  if (signedIn && (await searchParams).view === 'account') return <AccountHome />;
  return <LocalHome signedIn={signedIn} />;
}
