import { accessAreas, type AccessOption, type ShopSuggestion } from './area-access';
import { meetingAreas, meetingCities } from './meeting-areas';
import { parseShopPlan, record, ScheduleError, textField, type ShopPlan } from './schedule';

export interface AreaPollResponse {
  id: string;
  name: string;
  allowedAreaIds: string[];
  preferredAreaIds: string[];
  cannotAttend: boolean;
  updatedAt: string;
}

export interface AreaPoll {
  decisionEpoch?: number;
  attendanceBased?: boolean;
  eligibleResponseIds?: string[];
  method?: 'access-demo';
  accessOptions?: AccessOption[];
  suggestions?: ShopSuggestion[];
  id: string;
  cityId: string;
  expectedCount: number;
  shopPlan?: ShopPlan;
  mode: '食事' | 'カフェ・軽食';
  scheduleId: string | null;
  scheduleOptionId: string | null;
  areaIds: string[];
  responses: AreaPollResponse[];
  selectedAreaId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AreaCandidate {
  areaId: string;
  preferenceCount: number;
}

export function parseAreaPollInput(value: unknown): Pick<AreaPoll, 'cityId' | 'expectedCount' | 'mode' | 'scheduleId' | 'areaIds' | 'method' | 'shopPlan'> {
  const input = record(value);
  if (typeof input.cityId !== 'string' || !Object.hasOwn(meetingCities, input.cityId)) {
    throw new ScheduleError('集まる都市を選んでください。');
  }
  if (!Number.isInteger(input.expectedCount) || Number(input.expectedCount) < 2 || Number(input.expectedCount) > 8) {
    throw new ScheduleError('参加人数は幹事を含めて2〜8人で指定してください。');
  }
  if (input.mode !== '食事' && input.mode !== 'カフェ・軽食') {
    throw new ScheduleError('食事かカフェ・軽食を選んでください。');
  }
  const scheduleId = textField(input.scheduleId, '日程調整ID', 80, false) || null;
  if (scheduleId && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(scheduleId)) {
    throw new ScheduleError('日程調整IDを確認してください。');
  }
  const shopPlan = parseShopPlan(input.shopPlan);
  if (input.method !== undefined && (input.method !== 'access-demo' || input.cityId !== 'tokyo')) throw new ScheduleError('この都市では利用できない調整方法です。');
  if (input.method === 'access-demo') return { shopPlan, cityId: 'tokyo', expectedCount: Number(input.expectedCount), mode: input.mode, areaIds: [...accessAreas], scheduleId, method: 'access-demo' };
  const areaIds = meetingAreas.filter(area => area.cityId === input.cityId).map(area => area.id);
  if (!areaIds.length) throw new ScheduleError('この都市には調整できるエリアがありません。');
  return { shopPlan, cityId: input.cityId, expectedCount: Number(input.expectedCount), mode: input.mode, scheduleId, areaIds };
}

function areaIdsField(value: unknown, label: string, allowedIds: string[], minimum: number, maximum: number): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
    value.some(id => typeof id !== 'string' || !allowedIds.includes(id)) || new Set(value).size !== value.length) {
    throw new ScheduleError(`${label}を確認してください。${minimum ? '1つ以上選んでください。' : ''}`);
  }
  return [...value] as string[];
}

export function parseAreaPollResponse(value: unknown, poll: AreaPoll): { name: string; allowedAreaIds: string[]; preferredAreaIds: string[]; cannotAttend: boolean } {
  const input = record(value);
  if (input.cannotAttend !== undefined && typeof input.cannotAttend !== 'boolean') throw new ScheduleError('行けるエリアの回答を確認してください。');
  const cannotAttend = input.cannotAttend === true;
  const allowedAreaIds = areaIdsField(input.allowedAreaIds, '行けるエリア', poll.areaIds, cannotAttend ? 0 : 1, cannotAttend ? 0 : poll.areaIds.length);
  const preferredAreaIds = areaIdsField(input.preferredAreaIds ?? [], '特に行きたいエリア', allowedAreaIds, 0, cannotAttend ? 0 : 2);
  return { name: textField(input.name, 'お名前', 40, false), allowedAreaIds, preferredAreaIds, cannotAttend };
}

/** No response means unknown, never consent. Preferences never widen permission. */
export function commonAreaCandidates(poll: AreaPoll): AreaCandidate[] {
  if (poll.responses.length !== poll.expectedCount || new Set(poll.responses.map(response => response.id)).size !== poll.expectedCount) return [];
  return poll.areaIds
    .filter(areaId => poll.responses.every(response => response.allowedAreaIds.includes(areaId)))
    .map(areaId => ({ areaId, preferenceCount: poll.responses.filter(response => response.preferredAreaIds.includes(areaId)).length }))
    .sort((left, right) => right.preferenceCount - left.preferenceCount || poll.areaIds.indexOf(left.areaId) - poll.areaIds.indexOf(right.areaId));
}

export function summarizeArea(poll: AreaPoll, areaId: string): { allowedCount: number; preferredCount: number; pendingCount: number } {
  return {
    allowedCount: poll.responses.filter(response => response.allowedAreaIds.includes(areaId)).length,
    preferredCount: poll.responses.filter(response => response.allowedAreaIds.includes(areaId) && response.preferredAreaIds.includes(areaId)).length,
    pendingCount: Math.max(0, poll.expectedCount - poll.responses.length),
  };
}
