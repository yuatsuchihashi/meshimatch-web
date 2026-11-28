export const MAX_SCHEDULE_OPTIONS = 30;
export const timePeriods = {
  anytime: '時間はあとで', morning: '朝', lunch: 'ランチ', afternoon: '午後', evening: '夜', custom: '時刻を指定',
} as const;
export type TimePeriod = keyof typeof timePeriods;
export type Availability = 'yes' | 'maybe' | 'no';
export const availabilityLabels: Record<Availability, string> = { yes: '参加できる', maybe: '条件付き', no: '難しい' };
export const availabilitySymbols: Record<Availability, string> = { yes: '○', maybe: '△', no: '×' };
export interface ScheduleOption {
  id: string;
  date: string;
  period: TimePeriod;
  start?: string;
  end?: string;
}
export interface ScheduleResponse {
  id: string;
  name: string;
  answers: Record<string, Availability>;
  comment: string;
  updatedAt: string;
}
export type PlacePlan = 'known' | 'adjust';
export type ShopPlan = PlacePlan | 'skip';
export interface SchedulePoll {
  decisionEpoch?: number;
  attendanceBased?: boolean;
  placePlan?: PlacePlan;
  shopPlan?: ShopPlan;
  areaPollId?: string;
  id: string;
  title: string;
  description: string;
  timezone: string;
  expectedCount: number;
  options: ScheduleOption[];
  responses: ScheduleResponse[];
  selectedOptionId: string | null;
  createdAt: string;
  updatedAt: string;
}
export class ScheduleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ScheduleError('入力内容を確認してください。');
  return value as Record<string, unknown>;
}
export function textField(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new ScheduleError(`${label}を${required ? '1〜' : ''}${max}文字で入力してください。`);
  }
  return value.trim();
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d\d-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseOption(value: unknown): ScheduleOption {
  const input = record(value);
  if (!validDate(input.date) || typeof input.period !== 'string' || !Object.hasOwn(timePeriods, input.period)) {
    throw new ScheduleError('候補日と時間帯を確認してください。');
  }
  const id = textField(input.id, '候補ID', 80);
  if (!/^[\w-]+$/.test(id)) throw new ScheduleError('候補IDを確認してください。');
  const option: ScheduleOption = { id, date: input.date, period: input.period as TimePeriod };
  if (option.period === 'custom') {
    const isTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!isTime(input.start) || !isTime(input.end) || input.start >= input.end) {
      throw new ScheduleError('開始・終了時刻を指定してください。終了は開始より後にしてください。');
    }
    option.start = input.start; option.end = input.end;
  }
  return option;
}
export function optionKey(option: ScheduleOption): string {
  return [option.date, option.period, option.start ?? '', option.end ?? ''].join('|');
}
export function parseShopPlan(value: unknown): ShopPlan | undefined {
  if (value === undefined || value === 'known' || value === 'adjust' || value === 'skip') return value;
  throw new ScheduleError('お店の設定を確認してください。');
}
export function parsePollInput(value: unknown): Pick<SchedulePoll, 'title' | 'description' | 'expectedCount' | 'timezone' | 'options' | 'placePlan' | 'shopPlan'> {
  const input = record(value);
  const title = textField(input.title, '集まりの名前', 80, false) || 'みんなの日程調整';
  const description = textField(input.description, 'ひとこと', 500, false);
  const timezone = textField(input.timezone, 'タイムゾーン', 80);
  try { new Intl.DateTimeFormat('ja', { timeZone: timezone }).format(); }
  catch { throw new ScheduleError('タイムゾーンを確認してください。'); }
  if (!Number.isInteger(input.expectedCount) || Number(input.expectedCount) < 2 || Number(input.expectedCount) > 8) {
    throw new ScheduleError('参加人数は幹事を含めて2〜8人で指定してください。');
  }
  if (!Array.isArray(input.options) || input.options.length < 1 || input.options.length > MAX_SCHEDULE_OPTIONS) {
    throw new ScheduleError(`候補日時を1〜${MAX_SCHEDULE_OPTIONS}件選んでください。`);
  }
  const options = input.options.map(parseOption);
  if (new Set(options.map(optionKey)).size !== options.length || new Set(options.map(option => option.id)).size !== options.length) {
    throw new ScheduleError('同じ候補日時が重複しています。');
  }
  const placePlan = input.placePlan;
  if (placePlan !== undefined && placePlan !== 'known' && placePlan !== 'adjust') throw new ScheduleError('集合場所の設定を確認してください。');
  const shopPlan = parseShopPlan(input.shopPlan);
  return { ...(placePlan ? { placePlan } : {}), ...(shopPlan ? { shopPlan } : {}), title, description, timezone, expectedCount: Number(input.expectedCount), options };
}
export function summarizeOption(poll: SchedulePoll, optionId: string) {
  const count = { yes: 0, maybe: 0, no: 0, pending: 0 };
  for (const response of poll.responses) {
    const answer = response.answers[optionId];
    if (answer) count[answer]++;
  }
  count.pending = Math.max(0, poll.expectedCount - count.yes - count.maybe - count.no);
  const status: 'unavailable' | 'waiting' | 'discuss' | 'ready' = count.no > 0 ? 'unavailable' : count.pending > 0 ? 'waiting' : count.maybe > 0 ? 'discuss' : 'ready';
  return { ...count, status };
}
export function completedResponses(poll: SchedulePoll): number {
  return poll.responses.filter(response => poll.options.every(option => response.answers[option.id])).length;
}
export function periodLabel(option: ScheduleOption): string {
  return option.period === 'custom' ? `${option.start}–${option.end}` : timePeriods[option.period];
}
export function dateLabel(date: string, long = false): string {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short', ...(long ? { year: 'numeric' } : {}) })
    .format(new Date(`${date}T12:00:00Z`));
}
export function todayInZone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function timezoneLabel(timezone: string): string {
  return ({ 'Asia/Tokyo': '日本時間', 'America/Argentina/Buenos_Aires': 'ブエノスアイレス時間', UTC: 'UTC' } as Record<string, string>)[timezone] ?? timezone;
}

export function canConfirmDate(poll: SchedulePoll, optionId: string) {
  const count = summarizeOption(poll, optionId);
  return count.status === 'ready' || (poll.attendanceBased === true && count.pending === 0 && count.yes >= 2);
}

export function attendingIds(poll: SchedulePoll): string[] | undefined {
  const dateId = poll.selectedOptionId;
  if (!poll.attendanceBased || !dateId) return;
  return poll.responses.filter(person => person.answers[dateId] === 'yes').map(person => person.id);
}
