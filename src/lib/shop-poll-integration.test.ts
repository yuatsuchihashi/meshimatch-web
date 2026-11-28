import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from '@/app/api/shop-polls/[id]/route';
import { createAreaPollStore } from './area-poll-store';
import { freshAnswer, freshRestaurantPreferences } from './instant/discovery';
import { createScheduleStore } from './schedule-store';
import { createShopPollStore, shopPollStore } from './shop-poll-store';

let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meshimatch-shop-test-')); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

function stores() {
  const dates = createScheduleStore(path.join(directory, 'dates'));
  const areas = createAreaPollStore(path.join(directory, 'areas'), dates);
  const shops = createShopPollStore(path.join(directory, 'shops'), dates, areas);
  return { dates, areas, shops };
}

function member(n: number) {
  return { responseId: `member-${n}`, name: n <= 2 ? '同じ名前' : `回答者${n}`, token: `private-shop-test-member-token-${n}` };
}

function plan(shopPlan?: 'known' | 'adjust') {
  const { dates, areas, shops } = stores();
  const date = dates.create({
    title: 'テストの夕食', shopPlan, placePlan: 'adjust', timezone: 'Asia/Tokyo', expectedCount: 7,
    options: [{ id: 'day', date: '2099-11-27', period: 'evening' }, { id: 'alternate', date: '2099-11-28', period: 'lunch' }],
  });
  const id = date.poll.id;
  const area = areas.create({
    cityId: 'tokyo', mode: '食事', method: 'access-demo', expectedCount: 7,
    scheduleId: id, scheduleHostToken: date.hostToken, attendanceBased: true,
  });
  for (let n = 1; n <= 7; n++) {
    dates.update(id, { action: 'respond', ...member(n), answers: { day: n <= 5 ? 'yes' : n === 6 ? 'maybe' : 'no', alternate: 'yes' } });
    areas.update(id, { action: 'respond', ...member(n), anywhere: true, fromSchedule: true,
      ...(n > 5 && shopPlan !== 'known' ? { suggestion: { text: '今回欠席の人のおすすめ', areaId: 'ueno' } } : {}) });
  }
  const chooseDate = (optionId = 'day') => dates.update(id, { action: 'confirm', token: date.hostToken, optionId });
  const chooseArea = () => {
    const areaId = areas.get(id).accessOptions![0].areaId;
    return areas.update(id, { action: 'confirm', areaId, token: area.hostToken });
  };
  return { id, dates, areas, shops, dateToken: date.hostToken, areaToken: area.hostToken, chooseDate, chooseArea };
}

const answer = (budget = '') => ({ ...freshAnswer(), restaurant: freshRestaurantPreferences(), budget });

function fixedPlan() {
  const planData = plan();
  planData.chooseDate();
  planData.chooseArea();
  return planData;
}

describe('restaurant survey across linked date, area and shop stores', () => {
  it('opens only once date and area are fixed and counts only people attending that date', () => {
    const { id, shops, chooseDate, chooseArea } = plan();
    expect(() => shops.get(id)).toThrow();
    chooseDate();
    expect(() => shops.get(id)).toThrow();
    chooseArea();
    const poll = shops.get(id);
    expect(poll.config.partySize).toBe(5);
    expect(poll.participants.map(member => member.id).sort()).toEqual([1, 2, 3, 4, 5].map(n => member(n).responseId));
    expect(poll.participants.every(member => !member.answered)).toBe(true);
    expect(poll.candidates).toEqual([]);
    expect(JSON.stringify(poll)).not.toContain('今回欠席の人のおすすめ');
  });

  it('keeps the shop survey closed on direct reads and submissions if the host already knows the shop', () => {
    const { id, shops, chooseDate, chooseArea } = plan('known');
    chooseDate();
    chooseArea();
    expect(() => shops.get(id)).toThrow('この集まりのお店は決まっています');
    expect(() => shops.update(id, { action: 'respond', ...member(1), answer: answer() })).toThrow('この集まりのお店は決まっています');
  });

  it('keeps personal responses private, protects existing answers from other members and tolerates retries and reloads', () => {
    const { id, shops, dateToken } = fixedPlan();
    const contextKey = shops.get(id).contextKey;
    const submit = { action: 'respond', contextKey, ...member(2), answer: answer('1987') };
    const mine = { action: 'mine', contextKey, ...member(2) };
    expect(shops.update(id, mine).answer).toBeNull();
    shops.update(id, submit);
    shops.update(id, submit);
    expect(shops.get(id).participants.filter(person => person.answered)).toHaveLength(1);
    for (const token of [member(1).token, dateToken]) {
      expect(() => shops.update(id, { ...mine, token })).toThrow();
      expect(() => shops.update(id, { ...submit, token })).toThrow();
    }
    for (const n of [6, 7]) {
      expect(() => shops.update(id, { ...submit, ...member(n) })).toThrow();
      expect(() => shops.update(id, { ...mine, ...member(n) })).toThrow();
    }
    const reloaded = stores().shops;
    expect(reloaded.update(id, mine).answer?.budget).toBe('1987');
    expect(JSON.stringify(reloaded.get(id))).not.toMatch(/private-shop-test-member-token|1987|restaurantPreferences/);
    expect(reloaded.get(id).candidates).toEqual([]);
    reloaded.update(id, { ...submit, answer: answer('2987') });
    expect(reloaded.update(id, mine).answer?.budget).toBe('2987');
    expect(reloaded.get(id).participants.filter(person => person.answered)).toHaveLength(1);
  });

  it('offers current eligible candidates to the host and preserves votes when reopening the shop decision', () => {
    const { id, shops, dateToken } = fixedPlan();
    const contextKey = shops.get(id).contextKey;
    const submit = (n: number, budget = '') => shops.update(id, { action: 'respond', ...member(n), contextKey, answer: answer(budget) });
    for (let n = 1; n <= 4; n++) submit(n);
    expect(shops.get(id).candidates).toHaveLength(0);
    const { poll } = submit(5);
    expect(poll.candidates.length).toBeGreaterThan(0);
    expect(poll.candidates.length).toBeLessThanOrEqual(3);
    const confirm = { action: 'confirm', contextKey, shortlistVersion: poll.shortlistVersion, token: dateToken, shopId: poll.candidates[0].shopId };
    expect(() => shops.update(id, { ...confirm, token: member(1).token })).toThrow();
    expect(() => shops.update(id, { ...confirm, shopId: 'outside-this-shortlist' })).toThrow();
    const revised = submit(1, '100000').poll;
    expect(() => shops.update(id, confirm)).toThrow();
    expect(shops.get(id).selectedShopId).toBeNull();
    const chosen = revised.candidates[0].shopId;
    const closed = shops.update(id, { ...confirm, shortlistVersion: revised.shortlistVersion, shopId: chosen }).poll;
    expect(stores().shops.get(id).selectedShopId).toBe(chosen);
    expect(() => submit(2)).toThrow();
    const undo = { action: 'reopen', contextKey, shortlistVersion: closed.shortlistVersion, token: dateToken };
    expect(() => shops.update(id, { ...undo, token: member(2).token })).toThrow();
    const reopened = shops.update(id, undo).poll;
    expect(reopened.selectedShopId).toBeNull();
    expect(reopened.participants.filter(person => person.answered)).toHaveLength(5);
  });

  it('uses private capability checks through the HTTP route and never caches private answers', async () => {
    vi.stubEnv('MESHIMATCH_LOCAL_MODE', '1');
    const { id, shops } = fixedPlan();
    vi.spyOn(shopPollStore, 'get').mockImplementation(shops.get);
    vi.spyOn(shopPollStore, 'update').mockImplementation(shops.update);
    const context = { params: Promise.resolve({ id }) };
    const root = 'http://127.0.0.1:4317';
    const endpoint = root + '/api/shop-polls/' + id;
    const get = () => GET(new Request(endpoint), context);
    const query = (body: unknown, origin = root) => PATCH(new Request(endpoint, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', host: '127.0.0.1:4317', origin }, body: JSON.stringify(body),
    }), context);
    const publicResponse = await get();
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get('cache-control')).toContain('no-store');
    const contextKey = shops.get(id).contextKey;
    const body = { action: 'respond', ...member(1), contextKey, answer: answer('1987') };
    expect((await query(body, 'https://other.example')).status).toBe(403);
    expect(shops.get(id).participants.some(person => person.answered)).toBe(false);
    expect((await query(body)).status).toBe(200);
    const mine = { action: 'mine', ...member(1), contextKey };
    const privateResponse = await query(mine);
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.headers.get('cache-control')).toContain('no-store');
    expect((await privateResponse.json()).answer.budget).toBe('1987');
    expect((await query({ ...mine, token: member(2).token })).status).toBe(403);
    expect((await query({ ...mine, ...member(7) })).status).toBe(403);
    expect(await (await get()).text()).not.toContain('1987');
  });

  it('invalidates an old form even if a reopened area is set to the same place again', () => {
    const { id, shops, areas, chooseArea, areaToken } = fixedPlan();
    const original = shops.get(id);
    const submit = { action: 'respond', contextKey: original.contextKey, ...member(2), answer: answer() };
    shops.update(id, submit);
    areas.update(id, { action: 'reopen', token: areaToken });
    expect(() => shops.update(id, submit)).toThrow();
    chooseArea();
    const replacement = shops.get(id);
    expect(replacement.config.areaId).toBe(original.config.areaId);
    expect(replacement.contextKey).not.toBe(original.contextKey);
    expect(replacement.participants.some(person => person.answered)).toBe(false);
    expect(() => shops.update(id, submit)).toThrow();
    expect(shops.update(id, { ...submit, contextKey: replacement.contextKey }).poll.participants.filter(person => person.answered)).toHaveLength(1);
  });

  it('rebuilds the roster and requires the group to choose an area again after switching dates', () => {
    const { id, dates, areas, shops, dateToken, chooseDate, chooseArea } = fixedPlan();
    const original = shops.get(id);
    const submission = { action: 'respond', ...member(3), contextKey: original.contextKey, answer: answer('1987') };
    shops.update(id, submission);
    dates.update(id, { action: 'reopen', token: dateToken });
    chooseDate('alternate');
    expect(areas.get(id).selectedAreaId).toBeNull();
    expect(() => shops.get(id)).toThrow();
    chooseArea();
    const next = shops.get(id);
    expect(next.dateOption?.id).toBe('alternate');
    expect(next.participants).toHaveLength(7);
    expect(next.participants.every(person => !person.answered)).toBe(true);
    expect(() => shops.update(id, submission)).toThrow();
    expect(shops.update(id, { ...submission, action: 'mine', contextKey: next.contextKey }).answer).toBeNull();
    const arrived = shops.update(id, { ...submission, ...member(7), contextKey: next.contextKey }).poll;
    expect(arrived.participants.find(person => person.id === member(7).responseId)?.answered).toBe(true);
  });
});
