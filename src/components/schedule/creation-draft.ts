import { MAX_SCHEDULE_OPTIONS, timePeriods, validDate, type ScheduleOption } from '@/lib/schedule';

export type DraftDay = { id: string; date: string; slots: ScheduleOption[]; individual?: boolean };
export type ScheduleDraft = {
  title: string;
  description: string;
  expectedCount: number;
  timezone: string;
  days: DraftDay[];
  commonSlots: ScheduleOption[];
};

export const creationDraftKey = (id: string) => 'meshimatch_create_schedule_v1_' + id;

function validSlot(value: Partial<ScheduleOption> | null): boolean {
  return Boolean(value && typeof value.id === 'string' && typeof value.period === 'string' && Object.hasOwn(timePeriods, value.period));
}

export function readCreationDraft(id: string): ScheduleDraft | undefined {
  try {
    const raw = sessionStorage.getItem(creationDraftKey(id));
    if (!raw) return;
    const draft: ScheduleDraft = JSON.parse(raw);
    if (typeof draft.title !== 'string' || typeof draft.description !== 'string' ||
      !Number.isInteger(draft.expectedCount) || draft.expectedCount < 2 || draft.expectedCount > 8 ||
      !['Asia/Tokyo', 'America/Argentina/Buenos_Aires', 'UTC'].includes(draft.timezone) ||
      !Array.isArray(draft.commonSlots) || !draft.commonSlots.every(validSlot) ||
      !Array.isArray(draft.days) || draft.days.length > MAX_SCHEDULE_OPTIONS ||
      !draft.days.every(day => day && typeof day.id === 'string' && validDate(day.date) && Array.isArray(day.slots) && day.slots.every(validSlot))) return;
    return draft;
  } catch { return; }
}
