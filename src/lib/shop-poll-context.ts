import crypto from 'node:crypto';
import { meetingAreas, meetingCities, type MeetingCityId } from './meeting-areas';
import { defaultDiscoveryConfig } from './instant/discovery-session';
import { areas as discoveryAreas, modes, type DiscoveryConfig } from './instant/discovery';
import type { AreaPoll } from './area-poll';
import { record, ScheduleError, type SchedulePoll } from './schedule';
import type { ShopPoll } from './shop-poll';
import { shouldFindShop } from './shop-plan';

export type SurveyContext = Omit<ShopPoll, 'selectedShopId' | 'shortlistVersion' | 'candidates'> & { legacyContextKey?: string };
export type ShopSetup = {
  source: 'standalone' | 'schedule';
  id: string;
  createdAt: string;
  title: string;
  config: DiscoveryConfig;
  hostHash?: string;
};
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function requireShopPlan(schedule?: SchedulePoll, area?: AreaPoll) {
  if (!shouldFindShop(schedule, area)) {
    const message = schedule?.shopPlan === 'known' || area?.shopPlan === 'known'
      ? 'この集まりのお店は決まっています。' : 'この集まりではお店を調整しません。';
    throw new ScheduleError(message, 409);
  }
}

function ensurePartySize(partySize: number) {
  if (!Number.isInteger(partySize) || partySize < 2 || partySize > 8) {
    throw new ScheduleError('参加人数は2〜8人で指定してください。');
  }
}

export function parseShopConfig(value: unknown, attendeeCount?: number): DiscoveryConfig {
  const { areaId, radius, mode, partySize } = record(value);
  if (typeof areaId !== 'string' || !Object.hasOwn(discoveryAreas, areaId) || !meetingAreas.some(area => area.discoveryAreaId === areaId)) {
    throw new ScheduleError('集合エリアを選んでください。');
  }
  if (typeof radius !== 'number' || ![500, 1000, 2000].includes(radius)) throw new ScheduleError('検索する範囲を選んでください。');
  if (typeof mode !== 'string' || !modes.includes(mode)) throw new ScheduleError('探したいお店を選んでください。');
  if (attendeeCount === undefined && typeof partySize !== 'number') throw new ScheduleError('参加人数を入力してください。');
  const size = attendeeCount ?? Number(partySize);
  ensurePartySize(size);
  return { areaId, radius, mode, partySize: size };
}

function rosterKey(people: {id: string}[]) { return people.map(person => person.id).sort(); }
function participants(people: {id: string; name: string}[]) {
  return people.map(({id, name}) => ({id, name, answered: false}));
}

export function confirmedSchedule(schedule: SchedulePoll) {
  requireShopPlan(schedule);
  const dateOption = schedule.options.find(option => option.id === schedule.selectedOptionId);
  if (!dateOption) throw new ScheduleError('日程が決まると、お店の希望を回答できます。', 409);
  const attendees = schedule.responses.filter(response => response.answers[dateOption.id] === 'yes');
  if (attendees.length < 2) throw new ScheduleError('当日参加する人を2人以上選んでください。', 409);
  return { dateOption, attendees };
}

function confirmedAreaId(area: AreaPoll) {
  requireShopPlan(undefined, area);
  const decision = meetingAreas.find(item => item.id === area.selectedAreaId);
  if (!decision) throw new ScheduleError('集合エリアが決まると、お店の希望を回答できます。', 409);
  return decision.discoveryAreaId;
}

export function standaloneContext(setup: ShopSetup): SurveyContext {
  return { id: setup.id, source: 'standalone', scheduleId: null, dateOption: null, timezone: '', title: setup.title,
    config: setup.config, contextKey: digest(JSON.stringify(['standalone', setup.id, setup.config])),
    participants: [], suggestions: [], createdAt: setup.createdAt };
}
export function scheduleContext(schedule: SchedulePoll, setup: ShopSetup): SurveyContext {
  const { dateOption, attendees } = confirmedSchedule(schedule);
  const config = { ...setup.config, partySize: attendees.length };
  return { id: schedule.id, source: 'schedule', scheduleId: schedule.id, dateOption, timezone: schedule.timezone,
    title: schedule.title, config, participants: participants(attendees), suggestions: [],
    contextKey: digest(JSON.stringify(['schedule', schedule.id, dateOption, schedule.decisionEpoch ?? 0, config, rosterKey(attendees)])),
    createdAt: setup.createdAt };
}
// An area-independent preference can be collected before the first decision.
// Reopening either upstream decision starts another ballot round.
function preferenceRoundKey(area: AreaPoll, schedule?: SchedulePoll) {
  return digest(JSON.stringify(['area-preferences', area.id, area.mode, area.cityId, area.decisionEpoch ?? 0,
    schedule?.id ?? null, schedule?.decisionEpoch ?? 0]));
}

function pendingContext(area: AreaPoll, schedule?: SchedulePoll): SurveyContext {
  const cityId = area.cityId as MeetingCityId;
  if (!Object.hasOwn(meetingCities, cityId)) throw new ScheduleError('集合する都市を確認してください。', 409);
  const areaIds = meetingAreas.filter(item => item.cityId === cityId && area.areaIds.includes(item.id))
    .map(item => item.discoveryAreaId);
  const dateOption = schedule?.options.find(option => option.id === schedule.selectedOptionId) ?? null;
  const dateRoster = schedule && new Set(schedule.responses.filter(person => {
    if (dateOption) return person.answers[dateOption.id] === 'yes';
    return Object.values(person.answers).some(answer => answer !== 'no');
  }).map(person => person.id));
  const eligible = area.responses.filter(person => !person.cannotAttend && (!dateRoster || dateRoster.has(person.id)));
  return {
    id: area.id,
    areaPollId: area.id,
    scheduleId: schedule?.id ?? null,
    source: schedule ? undefined : 'area',
    title: schedule?.title ?? meetingCities[cityId].label + 'で' + area.mode,
    dateOption,
    timezone: schedule?.timezone ?? '',
    pendingArea: { cityId, areaIds },
    config: { areaId: '', radius: defaultDiscoveryConfig.radius, mode: area.mode, partySize: area.expectedCount },
    participants: participants(eligible),
    contextKey: preferenceRoundKey(area, schedule),
    suggestions: [],
    createdAt: area.createdAt,
  };
}

export function areaContext(area: AreaPoll): SurveyContext {
  if (area.shopPlan === 'adjust' && !area.selectedAreaId) return pendingContext(area);
  const areaId = confirmedAreaId(area);
  const attendees = area.responses.filter(person => !person.cannotAttend);
  if (attendees.length < 2) throw new ScheduleError('集合エリアの参加者を確認してください。', 409);
  const config = { areaId, radius: defaultDiscoveryConfig.radius, mode: area.mode, partySize: attendees.length };
  const previousKey = digest(JSON.stringify(['area', area.id, area.decisionEpoch ?? 0, config, rosterKey(attendees)]));
  return { id: area.id, source: 'area', scheduleId: null, areaPollId: area.id, dateOption: null, timezone: '',
    title: (meetingAreas.find(item => item.id === area.selectedAreaId)?.label ?? '') + 'で' + area.mode,
    config, participants: participants(attendees), suggestions: area.suggestions ?? [],
    contextKey: area.shopPlan === 'adjust' ? preferenceRoundKey(area) : previousKey, legacyContextKey: previousKey,
    createdAt: area.createdAt };
}

export function linkedContext(schedule: SchedulePoll, area: AreaPoll): SurveyContext {
  requireShopPlan(schedule, area);
  if (area.scheduleId !== schedule.id || (area.scheduleOptionId && area.scheduleOptionId !== schedule.selectedOptionId)) {
    throw new ScheduleError('日程が変わりました。集合エリアを確認してください。', 409);
  }
  const early = area.shopPlan === 'adjust' && schedule.shopPlan === 'adjust' && area.attendanceBased;
  if (early && (!schedule.selectedOptionId || !area.selectedAreaId)) return pendingContext(area, schedule);
  const { dateOption, attendees } = confirmedSchedule(schedule);
  const areaId = confirmedAreaId(area);
  const roster = rosterKey(attendees);
  if (area.expectedCount !== roster.length ||
    (area.eligibleResponseIds && JSON.stringify([...area.eligibleResponseIds].sort()) !== JSON.stringify(roster))) {
    throw new ScheduleError('当日の参加者が変わりました。集合エリアを確認してください。', 409);
  }
  const config = { areaId, radius: defaultDiscoveryConfig.radius, mode: area.mode, partySize: attendees.length };
  // The existing linked poll key must stay stable for ballots created before other sources existed.
  const contextKey = digest(JSON.stringify([schedule.id, dateOption, schedule.decisionEpoch ?? 0,
    area.id, area.decisionEpoch ?? 0, config, roster]));
  return { id: area.id, scheduleId: schedule.id, areaPollId: area.id, title: schedule.title, timezone: schedule.timezone, dateOption, config,
    contextKey: early ? preferenceRoundKey(area, schedule) : contextKey, legacyContextKey: contextKey,
    participants: participants(attendees), suggestions: area.attendanceBased ? area.suggestions ?? [] : [] };
}
