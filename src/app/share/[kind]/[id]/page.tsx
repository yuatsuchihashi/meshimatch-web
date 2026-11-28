import { notFound } from 'next/navigation';
import { isLocalMode } from '@/lib/local-mode';
import { scheduleStore } from '@/lib/schedule-store';
import { areaPollStore } from '@/lib/area-poll-store';
import { shouldFindShop } from '@/lib/shop-plan';
import { sharedShopStage } from '@/lib/shared-shop-stage';
import { canConfirmDate, ScheduleError } from '@/lib/schedule';
import { SurveyInvitation } from '@/components/schedule/SurveyInvitation';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!isLocalMode() || (kind !== 'schedule' && kind !== 'area')) notFound();
  try {
    const schedule = kind === 'schedule' ? scheduleStore.get(id) : null;
    const areaId = schedule?.areaPollId ?? (kind === 'area' ? id : null);
    const area = areaId ? areaPollStore.get(areaId) : null;
    const linkedDate = schedule ?? (area?.scheduleId ? scheduleStore.get(area.scheduleId) : null);
    const date = linkedDate && (!area || kind === 'schedule' || linkedDate.areaPollId === area.id) ? linkedDate : null;
    return <SurveyInvitation shopStage={sharedShopStage(linkedDate, area)} findShop={shouldFindShop(linkedDate, area)} path={date ? '/schedule/' + date.id : '/area/' + id} title={date?.title} count={date?.expectedCount ?? area!.expectedCount}
      date={date ? { id: date.id, closed: Boolean(date.selectedOptionId), optionCount: date.options.length, canDecide: !date.selectedOptionId && date.options.some(option => canConfirmDate(date, option.id)),
        responses: date.responses.map(response => ({
          id: response.id, complete: date.options.every(option => Boolean(response.answers[option.id])),
          canAttend: Object.values(response.answers).some(answer => answer !== 'no'),
        })) } : undefined}
      area={area ? { id: area.id, cityId: area.cityId, mode: area.mode, count: area.expectedCount,
        closed: Boolean(area.selectedAreaId), responseIds: area.responses.map(response => response.id), eligibleIds: area.eligibleResponseIds } : undefined} />;
  } catch (err) {
    if (err instanceof ScheduleError && err.status === 404) notFound();
    throw err;
  }
}
