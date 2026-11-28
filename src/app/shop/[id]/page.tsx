import { notFound } from 'next/navigation';
import { isLocalMode } from '@/lib/local-mode';
import { ScheduleError } from '@/lib/schedule';
import { shopPollStore } from '@/lib/shop-poll-store';
import { ShopPollFlow } from '@/components/shop/ShopPollFlow';
import { ShopSurveyPreview } from '@/components/shop/ShopSurveyPreview';

export default async function SharedShopPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ person?: string; view?: string }>;
}) {
  if (!isLocalMode()) notFound();
  const { id } = await params;
  const { person, view } = await searchParams;
  if (view === 'preview') {
    let poll;
    try {
      poll = shopPollStore.get(id);
    } catch (error) {
      if (error instanceof ScheduleError && (error.status === 404 || error.status === 409)) notFound();
      throw error;
    }
    const sharePath = poll.scheduleId ? '/share/schedule/' + poll.scheduleId
      : poll.areaPollId ? '/share/area/' + poll.areaPollId : '/shop/' + poll.id;
    const previousPath = poll.areaPollId ? '/area/' + poll.areaPollId + '?view=preview' : sharePath;
    return <ShopSurveyPreview config={poll.config} pendingArea={poll.pendingArea}
      previousPath={previousPath} sharePath={sharePath} />;
  }
  return <ShopPollFlow key={id + (person ?? '')} id={id} requestedPerson={typeof person === 'string' ? person : undefined} />;
}
