import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shop-polls/route';
import { GET, PATCH } from '@/app/api/shop-polls/[id]/route';
import { createAreaPollStore } from './area-poll-store';
import { createScheduleStore } from './schedule-store';
import { createShopPollStore, shopPollStore } from './shop-poll-store';
import { freshAnswer, freshCafePreferences, freshRestaurantPreferences } from './instant/discovery';

let directory: string;
beforeEach(() => { directory = mkdtempSync(path.join(os.tmpdir(), 'meshi-remote-shop-')); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

function stores() {
  const schedules = createScheduleStore(path.join(directory, 'dates'));
  const areas = createAreaPollStore(path.join(directory, 'areas'), schedules);
  return { schedules, areas, shops: createShopPollStore(path.join(directory, 'shops'), schedules, areas) };
}

const config = { areaId: 'shinjuku', radius: 1000, mode: '食事', partySize: 2 } as const;
const standalone = () => ({ id: randomUUID(), hostToken: randomUUID(), config });
const guest = (name = '同じ表示名') => ({ responseId: randomUUID(), token: randomUUID(), name });
const meal = (budget = '') => ({ ...freshAnswer(), restaurant: freshRestaurantPreferences(), budget });
const cafe = () => ({ ...freshAnswer(), cafe: freshCafePreferences() });
const choices = [{ id: 'lunch', date: '2099-06-12', period: 'lunch' }, { id: 'night', date: '2099-06-13', period: 'evening' }];

describe('shop surveys answered through separate invitation links', () => {
  it('retries organizer creation without resetting the roster, and does not reserve a seat for an abandoned form', () => {
    const { shops } = stores();
    const creation = standalone();
    const { poll } = shops.create(creation);
    expect(poll.source).toBe('standalone');
    expect(poll.config.partySize).toBe(2);
    expect(poll.participants).toHaveLength(0);
    expect(shops.get(poll.id).dateOption).toBeNull();
    const first = guest();
    const query = { action: 'mine', contextKey: poll.contextKey, ...first };
    expect(shops.update(poll.id, query).answer).toBeNull();
    expect(() => shops.update(poll.id, { ...query, action: 'respond', answer: meal('-1') })).toThrow();
    expect(shops.get(poll.id).participants).toHaveLength(0);
    shops.update(poll.id, { ...query, action: 'respond', answer: meal('2197') });
    const reloaded = stores().shops;
    expect(reloaded.create(creation).poll.participants).toHaveLength(1);
    expect(reloaded.get(poll.id).candidates).toHaveLength(0);
    expect(reloaded.update(poll.id, query).answer?.budget).toBe('2197');
    expect(() => reloaded.create({ ...creation, hostToken: randomUUID() })).toThrow();
  });

  it('keeps separate namesake ballots, prevents a third submission, and gives only the host the final choice', () => {
    const { shops } = stores();
    const creation = standalone();
    const { poll: { id, contextKey } } = shops.create(creation);
    const first = guest(), second = guest();
    const vote = { action: 'respond', contextKey, ...first, answer: meal('2197') };
    shops.update(id, vote);
    const originalVersion = shops.get(id).shortlistVersion;
    shops.update(id, vote);
    expect(shops.get(id).shortlistVersion).toBe(originalVersion);
    const { poll: complete } = shops.update(id, { ...vote, ...second, answer: meal() });
    expect(complete.participants.map(person => person.name)).toEqual([first.name, second.name]);
    expect(complete.candidates.length).toBeGreaterThan(0);
    expect(() => shops.update(id, { ...vote, ...guest() })).toThrow();
    expect(() => shops.update(id, { ...vote, token: second.token })).toThrow();
    expect(() => shops.update(id, { ...vote, action: 'mine', token: creation.hostToken })).toThrow();
    const publicResult = JSON.stringify(shops.get(id));
    for (const secret of [first.token, second.token, creation.hostToken, '2197']) expect(publicResult).not.toContain(secret);
    const pick = { action: 'confirm', contextKey, shortlistVersion: complete.shortlistVersion, shopId: complete.candidates[0].shopId };
    expect(() => shops.update(id, { ...pick, token: first.token })).toThrow();
    const closed = shops.update(id, { ...pick, token: creation.hostToken }).poll;
    expect(closed.selectedShopId).toBe(pick.shopId);
    const reopened = shops.update(id, { action: 'reopen', token: creation.hostToken, contextKey, shortlistVersion: closed.shortlistVersion }).poll;
    expect(reopened.selectedShopId).toBeNull();
    expect(reopened.participants).toHaveLength(2);
  });

  it('uses only the confirmed date attendees and invalidates answers when another date is chosen', () => {
    const { shops, schedules } = stores();
    const date = schedules.create({ shopPlan: 'adjust', placePlan: 'known', timezone: 'Asia/Tokyo', expectedCount: 3, options: choices });
    const [first, second, third] = [guest('一人目'), guest('二人目'), guest('三人目')];
    for (const person of [first, second, third]) {
      schedules.update(date.poll.id, { action: 'respond', ...person, answers: { lunch: person === third ? 'no' : 'yes', night: 'yes' } });
    }
    const create = { scheduleId: date.poll.id, hostToken: date.hostToken, config };
    expect(() => shops.create(create)).toThrow();
    const decide = (optionId: string) => schedules.update(date.poll.id, { action: 'confirm', optionId, token: date.hostToken });
    decide('lunch');
    expect(() => shops.create({ ...create, hostToken: randomUUID() })).toThrow();
    const { poll } = shops.create(create);
    expect(poll.source).toBe('schedule');
    expect(poll.id).toBe(date.poll.id);
    expect(poll.config.partySize).toBe(2);
    expect(poll.participants.map(person => person.id).sort()).toEqual([first.responseId, second.responseId].sort());
    const vote = { action: 'respond', contextKey: poll.contextKey, ...first, answer: meal() };
    shops.update(poll.id, vote);
    expect(() => shops.update(poll.id, { ...vote, ...third })).toThrow();
    schedules.update(poll.id, { action: 'reopen', token: date.hostToken });
    expect(() => shops.get(poll.id)).toThrow();
    decide('night');
    const changed = shops.get(poll.id);
    expect(changed.config.partySize).toBe(3);
    expect(changed.contextKey).not.toBe(poll.contextKey);
    expect(changed.participants.every(person => !person.answered)).toBe(true);
    expect(() => shops.update(poll.id, vote)).toThrow();
    expect(shops.update(poll.id, { ...vote, ...third, contextKey: changed.contextKey }).poll.participants.some(person => person.answered)).toBe(true);
  });

  it('uses the area poll guest and host credentials for the confirmed café without asking people to join again', () => {
    const { shops, areas } = stores();
    const { poll: { id }, hostToken } = areas.create({ cityId: 'tokyo', expectedCount: 2, shopPlan: 'adjust', mode: 'カフェ・軽食' });
    const attendees = [guest(), guest()];
    for (const person of attendees) {
      areas.update(id, { action: 'respond', ...person, allowedAreaIds: ['shibuya'], preferredAreaIds: [] });
    }
    const confirmArea = () => areas.update(id, { action: 'confirm', areaId: 'shibuya', token: hostToken });
    expect(shops.get(id)).toMatchObject({ pendingArea: { cityId: 'tokyo' }, candidates: [] });
    confirmArea();
    const poll = shops.get(id);
    expect(poll.source).toBe('area');
    expect(poll.dateOption).toBeNull();
    expect(poll.config).toMatchObject({ mode: 'カフェ・軽食', partySize: 2, areaId: 'shibuya' });
    const vote = { action: 'respond', contextKey: poll.contextKey, answer: cafe() };
    expect(() => shops.update(id, { ...vote, ...guest() })).toThrow();
    for (const person of attendees) shops.update(id, { ...vote, ...person });
    const full = shops.get(id);
    expect(full.candidates.length).toBeGreaterThan(0);
    shops.update(id, { action: 'confirm', shopId: full.candidates[0].shopId, token: hostToken, contextKey: poll.contextKey, shortlistVersion: full.shortlistVersion });
    areas.update(id, { action: 'reopen', token: hostToken });
    expect(shops.get(id)).toMatchObject({ pendingArea: { cityId: 'tokyo' }, candidates: [] });
    confirmArea();
    const reopened = shops.get(id);
    expect(reopened.contextKey).not.toBe(full.contextKey);
    expect(reopened.selectedShopId).toBeNull();
    expect(() => shops.update(id, { ...vote, ...attendees[0] })).toThrow();
  });

  it.each(['known', 'skip'])('keeps shop surveys disabled when %s is selected', shopPlan => {
    const { shops, schedules, areas } = stores();
    const date = schedules.create({ shopPlan, placePlan: 'known', expectedCount: 2, options: choices, timezone: 'Asia/Tokyo' });
    const area = areas.create({ shopPlan, cityId: 'tokyo', expectedCount: 2, mode: '食事' });
    for (const person of [guest(), guest()]) {
      schedules.update(date.poll.id, { action: 'respond', ...person, answers: { lunch: 'yes', night: 'yes' } });
      areas.update(area.poll.id, { action: 'respond', ...person, allowedAreaIds: ['shibuya'], preferredAreaIds: [] });
    }
    schedules.update(date.poll.id, { action: 'confirm', token: date.hostToken, optionId: 'lunch' });
    areas.update(area.poll.id, { action: 'confirm', token: area.hostToken, areaId: 'shibuya' });
    expect(() => shops.create({ scheduleId: date.poll.id, hostToken: date.hostToken, config })).toThrow();
    expect(() => shops.get(area.poll.id)).toThrow();
  });

  it('creates an invitation over HTTP, accepts independent responses, and blocks different-origin and nonlocal creation', async () => {
    vi.stubEnv('MESHIMATCH_LOCAL_MODE', '1');
    const { shops } = stores();
    vi.spyOn(shopPollStore, 'create').mockImplementation(shops.create);
    vi.spyOn(shopPollStore, 'get').mockImplementation(shops.get);
    vi.spyOn(shopPollStore, 'update').mockImplementation(shops.update);
    const origin = 'http://127.0.0.1:4317';
    const base = origin + '/api/shop-polls';
    const creation = standalone();
    const endpoint = base + '/' + creation.id;
    const ctx = { params: Promise.resolve({ id: creation.id }) };
    const request = (url: string, method: string, data: unknown, from = origin) => new Request(url, {
      method, headers: { origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    expect((await POST(request(base, 'POST', creation, 'https://elsewhere.example'))).status).toBe(403);
    const created = await POST(request(base, 'POST', creation));
    expect(created.status).toBe(201);
    const { poll } = await created.json();
    const submit = async () => PATCH(request(endpoint, 'PATCH', { action: 'respond', ...guest(), contextKey: poll.contextKey, answer: meal() }), ctx);
    const writes = await Promise.all([submit(), submit(), submit()]);
    expect(writes.map(result => result.status).sort()).toEqual([200, 200, 409]);
    const read = await GET(new Request(endpoint), ctx);
    expect(read.headers.get('Cache-Control')).toContain('no-store');
    expect((await read.json()).poll.participants).toHaveLength(2);
    vi.stubEnv('MESHIMATCH_LOCAL_MODE', '0');
    vi.stubEnv('NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE', '0');
    expect((await POST(request(base, 'POST', standalone()))).status).toBe(404);
  });
});
