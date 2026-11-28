import AccountProfile from '@/components/profile/AccountProfile';
import { DeviceProfile } from '@/components/profile/DeviceProfile';
import { isLocalMode } from '@/lib/local-mode';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!isLocalMode()) return <AccountProfile />;

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const { view } = await searchParams;
  if (user && view === 'account') return <AccountProfile />;
  return <DeviceProfile hasAccount={Boolean(user)} />;
}
