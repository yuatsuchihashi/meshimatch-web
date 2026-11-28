import { notFound } from 'next/navigation';
import { isLocalMode } from '@/lib/local-mode';
import { ScheduleCreate } from '@/components/schedule/ScheduleFlow';

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ place?: string | string[]; shop?: string | string[]; draft?: string }> }) {
  if (!isLocalMode()) notFound();
  const { place, shop, draft } = await searchParams;
  return <ScheduleCreate draftId={typeof draft === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(draft) ? draft : 'direct'}
    shopPlan={shop === 'known' || shop === 'adjust' || shop === 'skip' ? shop : undefined}
    placePlan={place === 'known' || place === 'adjust' ? place : undefined} />;
}
