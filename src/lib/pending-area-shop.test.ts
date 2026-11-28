import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScheduleStore } from './schedule-store';
import { createAreaPollStore } from './area-poll-store';
import { createShopPollStore } from './shop-poll-store';
import { freshAnswer, freshCafePreferences, freshRestaurantPreferences } from './instant/discovery';

let directory: string;
beforeEach(() => { directory = mkdtempSync(path.join(os.tmpdir(), 'meshi-pending-area-')); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

function reloadStores() {
  const dates = createScheduleStore(path.join(directory, 'dates'));
  const areas = createAreaPollStore(path.join(directory, 'areas'), dates);
  const shops = createShopPollStore(path.join(directory, 'shops'), dates, areas);
  return { dates, areas, shops };
}

const guest = () => ({ responseId: randomUUID(), token: randomUUID(), name: '同じ名前' });
const places = { allowedAreaIds: ['shibuya', 'shinjuku'], preferredAreaIds: [] };
const cafeAnswer = (budget = '', diet: string[] = []) => ({ ...freshAnswer(), budget, diet,
  cafe: { ...freshCafePreferences(), interests: ['dessert'], details: { dessert: ['cake'] } } });

describe('collecting personal shop preferences in the same invitation before area confirmation', () => {
  it('lets each café guest submit in sequence, protects private ballots, and applies their saved budgets in the chosen area', () => {
    const { shops, areas } = reloadStores();
    const { poll: { id }, hostToken } = areas.create({ cityId: 'tokyo', mode: 'カフェ・軽食', shopPlan: 'adjust', expectedCount: 2 });
    const first = guest(), second = guest();
    areas.update(id, { action: 'respond', ...first, ...places });
    const initial = shops.get(id);
    expect(initial.pendingArea?.cityId).toBe('tokyo');
    expect(initial.pendingArea?.areaIds).toContain('shinjuku');
    expect(initial.config.areaId).toBe('');
    expect(initial.config.partySize).toBe(2);
    const vote = { action: 'respond', contextKey: initial.contextKey, ...first, answer: cafeAnswer('1', ['vegan']) };
    expect(() => shops.update(id, { ...vote, ...second })).toThrow();
    shops.update(id, vote);
    const mine = { action: 'mine', contextKey: initial.contextKey, ...first };
    for (const token of [hostToken, second.token]) expect(() => shops.update(id, { ...mine, token })).toThrow();
    const readBack = reloadStores().shops.update(id, mine).answer;
    expect(readBack?.cafe?.details.dessert).toEqual(['cake']);
    expect(readBack?.budget).toBe('1');
    expect(readBack?.diet).toEqual(['vegan']);
    areas.update(id, { action: 'respond', ...second, ...places });
    const { poll: pending } = shops.update(id, { ...vote, ...second, contextKey: shops.get(id).contextKey, answer: cafeAnswer() });
    expect(pending.participants.filter(person => person.answered)).toHaveLength(2);
    expect(pending.candidates).toEqual([]);
    expect(JSON.stringify(pending)).not.toContain(first.token);
    expect(JSON.stringify(pending)).not.toContain('"budget"');
    expect(() => shops.update(id, { action: 'confirm', contextKey: pending.contextKey, shortlistVersion: pending.shortlistVersion, token: hostToken, shopId: 'shinjuku-cafe' })).toThrow();

    areas.update(id, { action: 'confirm', areaId: 'shinjuku', token: hostToken });
    const final = reloadStores().shops.get(id);
    expect(final.pendingArea).toBeUndefined();
    expect(final.config.areaId).toBe('shinjuku');
    expect(final.participants.every(person => person.answered)).toBe(true);
    expect(final.candidates).toEqual([]);
    const revised = shops.update(id, { ...vote, contextKey: final.contextKey, answer: cafeAnswer('2900', ['vegan']) }).poll;
    expect(revised.candidates.length).toBeGreaterThan(0);
    expect(revised.candidates.every(candidate => candidate.shop.areaId === 'shinjuku')).toBe(true);
    expect(revised.candidates.every(({ shop }) => shop.menus.some(menu =>
      menu.evidence.status === 'confirmed' && menu.dietary.vegan === true))).toBe(true);

    areas.update(id, { action: 'reopen', token: hostToken });
    expect(shops.get(id).participants.every(person => !person.answered)).toBe(true);
    expect(() => shops.update(id, vote)).toThrow();
  });

  it('filters precollected restaurant ballots down to the five attending guests before ranking', () => {
    const { dates, areas, shops } = reloadStores();
    const date = dates.create({ expectedCount: 7, timezone: 'Asia/Tokyo', shopPlan: 'adjust', placePlan: 'adjust',
      options: [{ id: 'dinner', date: '2099-07-02', period: 'evening' }, { id: 'lunch', date: '2099-07-03', period: 'lunch' }] });
    const id = date.poll.id;
    const area = areas.create({ mode: '食事', expectedCount: 7, cityId: 'tokyo', method: 'access-demo',
      scheduleId: id, scheduleHostToken: date.hostToken, attendanceBased: true });
    const guests = Array.from({ length: 7 }, guest);
    guests.forEach((person, index) => {
      dates.update(id, { ...person, action: 'respond', answers: { dinner: index < 5 ? 'yes' : 'no', lunch: 'yes' } });
      areas.update(id, { ...person, action: 'respond', fromSchedule: true, anywhere: true });
      const pending = shops.get(id);
      expect(pending.dateOption).toBeNull();
      expect(pending.candidates).toEqual([]);
      shops.update(id, { ...person, action: 'respond', contextKey: pending.contextKey,
        answer: { ...freshAnswer(), restaurant: freshRestaurantPreferences(), budget: index < 5 ? '' : '1' } });
    });
    expect(shops.get(id).participants.filter(person => person.answered)).toHaveLength(7);
    dates.update(id, { action: 'confirm', token: date.hostToken, optionId: 'dinner' });
    const waiting = shops.get(id);
    expect(waiting.config.partySize).toBe(5);
    expect(waiting.participants.filter(person => person.answered)).toHaveLength(5);
    expect(waiting.candidates).toEqual([]);
    expect(() => shops.update(id, { action: 'mine', contextKey: waiting.contextKey, ...guests[6] })).toThrow();
    const selectedArea = areas.get(id).accessOptions![0].areaId;
    areas.update(id, { action: 'confirm', areaId: selectedArea, token: area.hostToken });
    const final = shops.get(id);
    expect(final.candidates.length).toBeGreaterThan(0);
    expect(final.participants.map(person => person.id).sort()).toEqual(guests.slice(0, 5).map(person => person.responseId).sort());
    dates.update(id, { action: 'reopen', token: date.hostToken });
    expect(() => shops.update(id, { action: 'mine', contextKey: final.contextKey, ...guests[0] })).toThrow();
    dates.update(id, { action: 'confirm', token: date.hostToken, optionId: 'lunch' });
    expect(shops.get(id).participants.filter(person => person.answered)).toHaveLength(0);
  });

  it('requires a saved, attending area response even when the respondent has their own valid area token', () => {
    const { shops, areas } = reloadStores();
    const { poll: { id } } = areas.create({ expectedCount: 2, mode: '食事', cityId: 'tokyo', shopPlan: 'adjust' });
    const absent = guest(), other = guest();
    areas.update(id, { ...other, ...places, action: 'respond' });
    areas.update(id, { ...absent, action: 'respond', cannotAttend: true, allowedAreaIds: [] });
    const poll = shops.get(id);
    expect(poll.participants.map(person => person.id)).not.toContain(absent.responseId);
    expect(() => shops.update(id, { ...absent, action: 'respond', contextKey: poll.contextKey, answer: {} })).toThrow();
  });

  it.each(['skip', 'known', undefined])('keeps pending collection closed for the %s choice', shopPlan => {
    const { areas, shops } = reloadStores();
    const { poll: { id } } = areas.create({ expectedCount: 2, mode: 'カフェ・軽食', cityId: 'tokyo', shopPlan });
    areas.update(id, { action: 'respond', ...guest(), ...places });
    expect(() => shops.get(id)).toThrow();
  });
});
