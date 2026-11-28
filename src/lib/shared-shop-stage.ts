import type { AreaPoll } from './area-poll';
import type { SchedulePoll } from './schedule';
import { shouldFindShop } from './shop-plan';

export function sharedShopStage(schedule?: SchedulePoll | null, area?: AreaPoll | null) {
  if (!shouldFindShop(schedule, area)) return;
  if (area && (schedule ? area.scheduleId === schedule.id : !area.scheduleId)) {
    const continuous = area.shopPlan === 'adjust' && (!schedule || (schedule.shopPlan === 'adjust' && schedule.areaPollId === area.id && area.attendanceBased));
    if (continuous || (schedule?.selectedOptionId && area.selectedAreaId)) return { id: area.id };
  }
  if (schedule?.selectedOptionId && !area && !schedule.areaPollId && schedule.placePlan !== 'adjust' && schedule.shopPlan === 'adjust') {
    return { id: schedule.id, setupScheduleId: schedule.id };
  }
}
