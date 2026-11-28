import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commonAreaCandidates, parseAreaPollInput, summarizeArea, type AreaPoll } from './area-poll';
import { createAreaPollStore } from './area-poll-store';
import { accessShortlist, parseTrip } from './area-access';
import { meetingAreas } from './meeting-areas';
import { createScheduleStore } from './schedule-store';

const tokyoIds = meetingAreas.filter(area => area.cityId === 'tokyo').map(area => area.id);
const [first, second, third] = tokyoIds;
const input = () => ({ cityId: 'tokyo', expectedCount: 3, mode: '食事' });
const directories: string[] = [];
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meshimatch-area-poll-'));
  directories.push(directory);
  const schedules = createScheduleStore(path.join(directory, 'schedules'));
  const store = createAreaPollStore(path.join(directory, 'areas'), schedules);
  const created = store.create(input());
  return { ...created, directory, store, schedules };
}
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function respond(store: ReturnType<typeof createAreaPollStore>, pollId: string, person: number,
  allowedAreaIds = [first, second], preferredAreaIds: string[] = [], name?: string) {
  return store.update(pollId, { action: 'respond', responseId: `person-${person}`, token: `private-area-poll-token-${person}`,
    allowedAreaIds, preferredAreaIds, name });
}
function confirmedSchedule(schedules: ReturnType<typeof createScheduleStore>) {
  const created = schedules.create({ title: '', timezone: 'Asia/Tokyo', expectedCount: 3,
    options: [{ id: 'day', date: '2099-11-27', period: 'lunch' }, { id: 'other', date: '2099-11-28', period: 'evening' }] });
  for (let person = 1; person <= 3; person++) schedules.update(created.poll.id, { action: 'respond', responseId: `person-${person}`,
    token: `schedule-response-token-${person}`, name: `参加者${person}`, answers: { day: 'yes', other: 'yes' } });
  const poll = schedules.update(created.poll.id, { action: 'confirm', token: created.hostToken, optionId: 'day' });
  return { ...created, poll };
}

describe('area poll validation and agreement', () => {
  it('snapshots candidate IDs from the selected city, not from untrusted client candidates', () => {
    const parsed = parseAreaPollInput({ ...input(), areaIds: ['made-up'] });
    expect(parsed.areaIds).toEqual(tokyoIds);
    expect(parsed.scheduleId).toBeNull();
    expect(() => parseAreaPollInput({ ...input(), cityId: 'missing' })).toThrow('都市');
    expect(() => parseAreaPollInput({ ...input(), cityId: '__proto__' })).toThrow('都市');
    expect(() => parseAreaPollInput({ ...input(), mode: 'どちらでも' })).toThrow('食事');
    expect(() => parseAreaPollInput({ ...input(), expectedCount: 9 })).toThrow('参加人数');
    expect(() => parseAreaPollInput({ ...input(), expectedCount: 2.5 })).toThrow('参加人数');
    expect(() => parseAreaPollInput({ ...input(), scheduleId: '../secret' })).toThrow('日程調整ID');
  });
  it('does not infer consent from missing respondents, even if every current response agrees', () => {
    const { poll, store } = setup();
    const partial = respond(store, poll.id, 1);
    expect(commonAreaCandidates(partial)).toEqual([]);
    expect(summarizeArea(partial, first)).toEqual({ allowedCount: 1, preferredCount: 0, pendingCount: 2 });
  });
  it('uses the allowed intersection first and preference votes only inside it', () => {
    const { poll, store } = setup();
    respond(store, poll.id, 1, [first, second], [first]);
    respond(store, poll.id, 2, [first, second], [second]);
    const result = respond(store, poll.id, 3, [first, second, third], [second, third]);
    expect(commonAreaCandidates(result)).toEqual([{ areaId: second, preferenceCount: 2 }, { areaId: first, preferenceCount: 1 }]);
    expect(commonAreaCandidates(result).some(candidate => candidate.areaId === third)).toBe(false);
  });
  it('keeps the catalog order on a preference tie and supports explicit all-area acceptance', () => {
    const { poll, store } = setup();
    for (let person = 1; person <= 3; person++) respond(store, poll.id, person, tokyoIds);
    expect(commonAreaCandidates(store.get(poll.id)).map(candidate => candidate.areaId)).toEqual(tokyoIds);
  });
  it('returns no common candidate on a conflict rather than relaxing one person’s choices', () => {
    const { poll, hostToken, store } = setup();
    respond(store, poll.id, 1, [first]); respond(store, poll.id, 2, [second]);
    const result = respond(store, poll.id, 3, [first, second]);
    expect(commonAreaCandidates(result)).toEqual([]);
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, areaId: first })).toThrow('全員が行ける');
  });
  it('counts an explicit no-area response as complete without inventing agreement', () => {
    const { poll, hostToken, store } = setup();
    respond(store, poll.id, 1); respond(store, poll.id, 2);
    const completed = store.update(poll.id, { action: 'respond', responseId: 'person-3', token: 'private-area-poll-token-3',
      allowedAreaIds: [], preferredAreaIds: [], cannotAttend: true });
    expect(completed.responses).toHaveLength(3);
    expect(completed.responses[2]).toMatchObject({ cannotAttend: true, allowedAreaIds: [], preferredAreaIds: [] });
    expect(summarizeArea(completed, first)).toMatchObject({ allowedCount: 2, pendingCount: 0 });
    expect(commonAreaCandidates(completed)).toEqual([]);
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, areaId: first })).toThrow('全員が行ける');
    const revised = respond(store, poll.id, 3, [first]);
    expect(revised.responses[2].cannotAttend).toBe(false);
    expect(commonAreaCandidates(revised).map(candidate => candidate.areaId)).toEqual([first]);
  });
  it('requires an explicit no-area flag for empty choices and rejects contradictory answers', () => {
    const { poll, store } = setup();
    const payload = { action: 'respond', responseId: 'person-1', token: 'private-area-poll-token-1', allowedAreaIds: [], preferredAreaIds: [] };
    expect(() => store.update(poll.id, { ...payload, cannotAttend: false })).toThrow('行けるエリア');
    expect(() => store.update(poll.id, payload)).toThrow('行けるエリア');
    expect(() => store.update(poll.id, { ...payload, cannotAttend: true, allowedAreaIds: [first] })).toThrow('行けるエリア');
    expect(() => store.update(poll.id, { ...payload, cannotAttend: true, preferredAreaIds: [first] })).toThrow('特に行きたい');
    expect(() => store.update(poll.id, { ...payload, cannotAttend: 'true' })).toThrow('行けるエリア');
    expect(store.get(poll.id).responses).toHaveLength(0);
  });
  it('rejects empty, duplicate and outside-city choices and preferences outside accepted areas', () => {
    const { poll, store } = setup();
    expect(() => respond(store, poll.id, 1, [])).toThrow('行けるエリア');
    expect(() => respond(store, poll.id, 1, [first, first])).toThrow('行けるエリア');
    expect(() => respond(store, poll.id, 1, ['made-up'])).toThrow('行けるエリア');
    const otherCityId = meetingAreas.find(area => area.cityId !== 'tokyo')?.id;
    if (otherCityId) expect(() => respond(store, poll.id, 1, [otherCityId])).toThrow('行けるエリア');
    expect(() => respond(store, poll.id, 1, [first], [second])).toThrow('特に行きたい');
    expect(() => respond(store, poll.id, 1, [first], [first, first])).toThrow('特に行きたい');
    expect(() => respond(store, poll.id, 1, [first, second, third], [first, second, third])).toThrow('特に行きたい');
    expect(store.get(poll.id).responses).toHaveLength(0);
  });
  it('never counts duplicated respondent IDs as a completed group', () => {
    const { poll, store } = setup();
    const partial = respond(store, poll.id, 1);
    const corrupted: AreaPoll = { ...partial, responses: [partial.responses[0], partial.responses[0], partial.responses[0]] };
    expect(commonAreaCandidates(corrupted)).toEqual([]);
  });
});

describe('area poll persistence and edit capabilities', () => {
  it('provides stable anonymous names and idempotent retries across store restarts', () => {
    const { poll, store, directory, schedules } = setup();
    respond(store, poll.id, 1); respond(store, poll.id, 2, [first], [], '友人');
    const reopened = createAreaPollStore(path.join(directory, 'areas'), schedules);
    const retried = respond(reopened, poll.id, 1, [second]);
    expect(retried.responses).toHaveLength(2);
    expect(retried.responses[0]).toMatchObject({ name: '参加者1', allowedAreaIds: [second] });
    expect(retried.responses[1]).toMatchObject({ name: '友人', allowedAreaIds: [first] });
    expect(store.get(poll.id)).toEqual(retried);
  });
  it('restores previous stored responses as ordinary area answers', () => {
    const { poll, store, directory } = setup();
    respond(store, poll.id, 1);
    const file = path.join(directory, 'areas', `${poll.id}.json`);
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete stored.responses[0].cannotAttend;
    fs.writeFileSync(file, JSON.stringify(stored));
    expect(store.get(poll.id).responses[0]).toMatchObject({ cannotAttend: false, allowedAreaIds: [first, second] });
  });
  it('keeps edit secrets out of every public response and rejects unauthorized changes', () => {
    const { poll, store, hostToken } = setup();
    respond(store, poll.id, 1);
    expect(JSON.stringify(store.get(poll.id))).not.toMatch(/Hash|private-area-poll-token|hostToken/);
    expect(JSON.stringify(store.get(poll.id))).not.toContain(hostToken);
    expect(() => store.update(poll.id, { action: 'reopen', token: 'invalid-host-token-long-enough' })).toThrow('権限');
    expect(() => store.update(poll.id, { action: 'respond', responseId: 'person-1', token: 'invalid-edit-token-long-enough', allowedAreaIds: [second] })).toThrow('権限');
  });
  it('requires all responses before confirming, locks afterwards, and supports reopening', () => {
    const { poll, store, hostToken } = setup();
    respond(store, poll.id, 1); respond(store, poll.id, 2);
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, areaId: first })).toThrow('全員が行ける');
    respond(store, poll.id, 3);
    expect(store.update(poll.id, { action: 'confirm', token: hostToken, areaId: first }).selectedAreaId).toBe(first);
    expect(() => respond(store, poll.id, 1, [second])).toThrow('決定済み');
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, areaId: second })).toThrow('再開');
    store.update(poll.id, { action: 'reopen', token: hostToken });
    expect(respond(store, poll.id, 1, [second]).selectedAreaId).toBeNull();
  });
  it('caps participant count and prevents public-ID path traversal', () => {
    const { poll, store } = setup();
    for (let person = 1; person <= 3; person++) respond(store, poll.id, person);
    expect(() => respond(store, poll.id, 4)).toThrow('予定人数');
    expect(() => store.get('../schedules')).toThrow('見つかりません');
    expect(() => store.get('00000000-0000-0000-0000-000000000000')).toThrow('見つかりません');
  });
  it('requires an existing confirmed schedule and matching participant count when linked', () => {
    const { store, schedules } = setup();
    const created = schedules.create({ title: '', timezone: 'Asia/Tokyo', expectedCount: 3,
      options: [{ id: 'day', date: '2099-11-27', period: 'lunch' }] });
    expect(() => store.create({ ...input(), scheduleId: created.poll.id })).toThrow('先に日程');
    const confirmed = confirmedSchedule(schedules);
    expect(() => store.create({ ...input(), expectedCount: 2, scheduleId: confirmed.poll.id })).toThrow('参加人数');
    expect(store.create({ ...input(), scheduleId: confirmed.poll.id }).poll.scheduleId).toBe(confirmed.poll.id);
    expect(() => store.create({ ...input(), scheduleId: '00000000-0000-0000-0000-000000000000' })).toThrow('見つかりません');
  });
  it('revalidates the linked schedule before confirming an area', () => {
    const { store, schedules } = setup();
    const schedule = confirmedSchedule(schedules);
    const created = store.create({ ...input(), scheduleId: schedule.poll.id });
    for (let person = 1; person <= 3; person++) respond(store, created.poll.id, person);
    schedules.update(schedule.poll.id, { action: 'reopen', token: schedule.hostToken });
    expect(() => store.update(created.poll.id, { action: 'confirm', token: created.hostToken, areaId: first })).toThrow('日程が変更');
    expect(() => respond(store, created.poll.id, 1)).toThrow('日程が変更');
    expect(store.get(created.poll.id).responses).toHaveLength(3);
  });
  it('does not reuse previous answers for a different confirmed schedule option', () => {
    const { store, schedules } = setup();
    const schedule = confirmedSchedule(schedules);
    const created = store.create({ ...input(), scheduleId: schedule.poll.id });
    expect(created.poll.scheduleOptionId).toBe('day');
    for (let person = 1; person <= 3; person++) respond(store, created.poll.id, person);
    schedules.update(schedule.poll.id, { action: 'reopen', token: schedule.hostToken });
    schedules.update(schedule.poll.id, { action: 'confirm', token: schedule.hostToken, optionId: 'other' });
    expect(() => respond(store, created.poll.id, 1, [second])).toThrow('日程が変更');
    expect(() => store.update(created.poll.id, { action: 'confirm', token: created.hostToken, areaId: first })).toThrow('日程が変更');
    store.update(created.poll.id, { action: 'reopen', token: created.hostToken });
    expect(store.get(created.poll.id).scheduleOptionId).toBe('day');
    expect(store.create({ ...input(), scheduleId: schedule.poll.id }).poll.scheduleOptionId).toBe('other');
  });
});

describe('trip-based Tokyo prototype', () => {
  it('counts an anywhere answer without adding a trip or weakening someone else’s route preference', () => {
    const { store } = setup();
    const { poll } = store.create({ ...input(), method: 'access-demo', expectedCount: 2 });
    const first = { action: 'respond', responseId: 'one', token: 'private-access-demo-token-one' };
    const second = { ...first, responseId: 'two', token: 'private-access-demo-token-two' };
    const route = { origin: 'asakusa', onward: 'unknown', wish: '' };
    expect(parseTrip({ ...route, anywhere: true })).toEqual({ origin: '', onward: '', wish: '', anywhere: true });
    expect(() => parseTrip({})).toThrow('出発駅');
    expect(store.update(poll.id, { ...first, anywhere: true }).accessOptions).toEqual([]);
    const mixed = store.update(poll.id, { ...second, ...route });
    expect(mixed.responses).toHaveLength(2);
    expect(mixed.accessOptions).toEqual(accessShortlist([route], '食事'));
    const suggestion = { text: 'おすすめのお店', areaId: 'ueno' };
    const result = store.update(poll.id, { ...second, anywhere: true, suggestion });
    expect(result.accessOptions).toHaveLength(3);
    expect(result.accessOptions?.[0]).toMatchObject({ areaId: 'ueno', reason: '参加者のおすすめのお店がある街' });
    expect(result.accessOptions?.every(option => option.worst === null && option.inboundRange === null)).toBe(true);
    expect(result.responses).toHaveLength(2);
  });
  it('keeps endpoints private, supports edits and confirms only a shortlisted area', () => {
    const { store } = setup();
    const { poll, hostToken } = store.create({ ...input(), method: 'access-demo', expectedCount: 2 });
    const answer = (id: string, origin: string, onward: string, wish: string) => store.update(poll.id, {
      action: 'respond', responseId: id, token: 'private-access-demo-token-' + id, origin, onward, wish,
    });
    expect(answer('a', 'tokyo', 'omiya', 'marunouchi').accessOptions).toEqual([]);
    expect(() => answer('b', 'invalid', 'unknown', '')).toThrow();
    answer('b', 'asakusa', 'return', '');
    const result = answer('b', 'asakusa', 'unknown', '');
    expect(result.responses).toHaveLength(2);
    expect(result.accessOptions?.map(o => o.areaId)).toContain('marunouchi');
    expect(result.accessOptions!.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(store.get(poll.id))).not.toMatch(/omiya|onward|asakusa|"trips"/);
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, areaId: 'invalid' })).toThrow();
    expect(store.update(poll.id, { action: 'confirm', token: hostToken, areaId: 'marunouchi' }).selectedAreaId).toBe('marunouchi');
  });
});

it('shares a suggested shop without publishing endpoints and removes it on an unchecked edit', () => {
  const { store } = setup();
  const { poll } = store.create({ ...input(), method: 'access-demo', expectedCount: 2 });
  const answer = { action: 'respond', responseId: 'one', token: 'private-access-demo-token-one', origin: 'asakusa', onward: 'unknown' };
  const suggestion = { text: 'お気に入りの洋食屋', areaId: 'marunouchi' };
  expect(store.update(poll.id, { ...answer, suggestion }).suggestions).toEqual([suggestion]);
  const result = store.update(poll.id, { ...answer, responseId: 'two' });
  expect(result.accessOptions?.find(option => option.areaId === suggestion.areaId)?.reason).toContain('おすすめ');
  expect(JSON.stringify(result)).not.toContain('asakusa');
  expect(store.update(poll.id, answer).suggestions).toEqual([]);
});

it('opens one shared area poll while dates are pending and carries it through date confirmation', () => {
  const { schedules, store } = setup();
  const date = schedules.create({ placePlan: 'adjust', timezone: 'Asia/Tokyo', expectedCount: 3, options: [{ id: 'lunch', date: '2099-11-27', period: 'lunch' }] });
  const payload = { ...input(), scheduleId: date.poll.id, scheduleHostToken: date.hostToken };
  expect(() => store.create({ ...payload, scheduleHostToken: 'invalid-host-token-long-enough' })).toThrow('権限');
  const area = store.create(payload);
  expect(schedules.get(date.poll.id).areaPollId).toBe(area.poll.id);
  expect(area.poll.scheduleOptionId).toBeNull();
  respond(store, area.poll.id, 1);
  expect(store.create(payload).poll.responses).toHaveLength(1);
  for (let i = 1; i <= 3; i++) schedules.update(date.poll.id, { action: 'respond', responseId: String(i), name: String(i), token: 'schedule-response-token-' + i, answers: { lunch: 'yes' } });
  schedules.update(date.poll.id, { action: 'confirm', token: date.hostToken, optionId: 'lunch' });
  for (let i = 2; i <= 3; i++) respond(store, area.poll.id, i);
  expect(store.update(area.poll.id, { action: 'confirm', token: area.hostToken, areaId: first }).selectedAreaId).toBe(first);
});

it('uses only the five definite attendees out of seven in a linked survey and keeps the host vote separate from setup', () => {
  const { store, schedules } = setup();
  const date = schedules.create({ placePlan: 'adjust', timezone: 'Asia/Tokyo', expectedCount: 7,
    options: [{ id: 'day', date: '2099-11-27', period: 'lunch' }, { id: 'next', date: '2099-11-28', period: 'evening' }] });
  const area = store.create({ ...input(), expectedCount: 7, scheduleId: date.poll.id, scheduleHostToken: date.hostToken,
    attendanceBased: true, method: 'access-demo' });
  const person = (i: number) => ({ responseId: 'voter-' + i, token: 'personal-test-response-token-' + i, name: '参加者' + i });
  const send = (i: number) => store.update(area.poll.id, { action: 'respond', ...person(i), anywhere: true,
    suggestion: { text: 'お店' + i, areaId: 'ueno' } });
  expect(date.poll.responses).toHaveLength(0);
  expect(() => send(1)).toThrow('先に日程');
  for (let i = 1; i <= 7; i++) {
    schedules.update(date.poll.id, { action: 'respond', ...person(i), answers: { day: i <= 5 ? 'yes' : i === 6 ? 'maybe' : 'no', next: 'yes' } });
    if (i !== 3) send(i);
  }
  expect(() => store.update(area.poll.id, { action: 'respond', ...person(3), token: person(2).token, anywhere: true })).toThrow('権限');
  schedules.update(date.poll.id, { action: 'confirm', token: date.hostToken, optionId: 'day' });
  const partial = store.get(area.poll.id);
  expect(partial.expectedCount).toBe(5);
  expect(partial.responses).toHaveLength(4);
  expect(partial.suggestions?.map(s => s.text)).toEqual(['お店1', 'お店2', 'お店4', 'お店5']);
  expect(partial.accessOptions).toEqual([]);
  expect(() => send(6)).toThrow('参加する人');
  const full = send(3);
  const selected = full.accessOptions![0].areaId;
  store.update(area.poll.id, { action: 'confirm', token: area.hostToken, areaId: selected });
  expect(store.get(area.poll.id).selectedAreaId).toBe(selected);
  schedules.update(date.poll.id, { action: 'reopen', token: date.hostToken });
  expect(store.get(area.poll.id).selectedAreaId).toBeNull();
  schedules.update(date.poll.id, { action: 'confirm', token: date.hostToken, optionId: 'next' });
  expect(store.get(area.poll.id)).toMatchObject({ selectedAreaId: null, expectedCount: 7 });
  expect(store.get(area.poll.id).responses).toHaveLength(7);
});

describe('area coordination independent of shop selection', () => {
  it('permits each confirmed area respondent to continue under their own identity', () => {
    const { store, poll, hostToken } = setup();
    for (const person of [1, 2, 3]) respond(store, poll.id, person);
    store.update(poll.id, { action: 'confirm', token: hostToken, areaId: first });
    expect(() => store.verifyHost(poll.id, hostToken)).not.toThrow();
    expect(store.verifyRespondent(poll.id, 'person-1', 'private-area-poll-token-1').id).toBe('person-1');
    expect(() => store.verifyHost(poll.id, 'private-area-poll-token-1')).toThrow('権限');
    expect(() => store.verifyRespondent(poll.id, 'person-2', 'private-area-poll-token-1')).toThrow('権限');
    expect(() => store.verifyRespondent(poll.id, 'unknown', hostToken)).toThrow('場所に回答');
  });

  it.each(['known', 'skip'] as const)('ignores shop suggestions, mode and catalogue counts for a %s shop plan', shopPlan => {
    const { store } = setup();
    expect(() => store.create({ ...input(), shopPlan: 'other' })).toThrow();
    const { poll, hostToken } = store.create({ ...input(), method: 'access-demo', expectedCount: 2, shopPlan });
    expect(store.get(poll.id).shopPlan).toBe(shopPlan);
    for (const person of ['one', 'two']) store.update(poll.id, {
      action: 'respond', responseId: person, token: 'area-answer-test-token-' + person,
      origin: 'asakusa', onward: 'unknown', wish: 'kuramae',
      suggestion: { text: '別のお店', areaId: 'marunouchi' },
    });
    const result = store.get(poll.id);
    expect(result.suggestions).toEqual([]);
    expect(result.accessOptions?.every(option => !option.shop && !option.menu)).toBe(true);
    expect(result.accessOptions?.some(option => option.areaId === 'kuramae')).toBe(true);
    expect(JSON.stringify(result.accessOptions)).not.toMatch(/店舗|この一品|お店/);
    expect(store.update(poll.id, { action: 'confirm', token: hostToken, areaId: 'kuramae' }).selectedAreaId).toBe('kuramae');
  });

  it('uses the linked schedule choice even when an area client sends a different choice', () => {
    const { store, schedules } = setup();
    for (const plan of ['known', 'adjust', 'skip'] as const) {
      const schedule = schedules.create({ placePlan: 'adjust', shopPlan: plan, timezone: 'Asia/Tokyo',
        expectedCount: 3, options: [{ id: 'lunch', date: '2099-11-27', period: 'lunch' }] });
      const payload = { ...input(), scheduleId: schedule.poll.id, scheduleHostToken: schedule.hostToken,
        shopPlan: plan === 'known' ? 'adjust' : 'known' };
      const area = store.create(payload);
      expect(store.get(area.poll.id).shopPlan).toBe(plan);
      expect(store.create(payload).poll.shopPlan).toBe(plan);
    }
  });
});
