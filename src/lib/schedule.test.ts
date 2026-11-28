import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { attendingIds, completedResponses, parsePollInput, summarizeOption, todayInZone, validDate } from './schedule';
import { createScheduleStore } from './schedule-store';

const input = () => ({ title: '週末ごはん', description: '', expectedCount: 3, timezone: 'Asia/Tokyo', options: [
  { id: 'fri', date: '2099-11-27', period: 'evening' },
  { id: 'sat', date: '2099-11-28', period: 'lunch' },
] });
const temporary: string[] = [];
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meshimatch-schedule-'));
  temporary.push(directory);
  const store = createScheduleStore(directory);
  const created = store.create(input());
  return { ...created, store, directory };
}
function respond(store: ReturnType<typeof createScheduleStore>, id: string, person: number, answers = { fri: 'yes', sat: 'yes' }) {
  return store.update(id, { action: 'respond', responseId: `person-${person}`, token: `private-response-token-${person}`, name: `参加者${person}`, answers });
}
afterEach(() => { for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe('schedule input and time semantics', () => {
  it.each(['', ' \t　', undefined, null])('creates a usable default title when the optional name is %s', title => {
    expect(parsePollInput({ ...input(), title }).title).toBe('みんなの日程調整');
  });
  it('preserves the legacy shop flow for old input and rejects unrecognized shop plans', () => {
    expect(parsePollInput(input())).not.toHaveProperty('shopPlan');
    expect(() => parsePollInput({ ...input(), placePlan: 'skip' })).toThrow('集合場所の設定');
    for (const invalid of [null, 'later', true]) {
      expect(() => parsePollInput({ ...input(), shopPlan: invalid })).toThrow('お店の設定');
    }
  });
  it('accepts a broad meal period without demanding a 30-minute grid', () => {
    expect(parsePollInput(input()).options[0]).toEqual(input().options[0]);
    expect(parsePollInput({ ...input(), options: [{ ...input().options[0], period: 'morning' }] }).options[0].period).toBe('morning');
  });
  it('accepts arbitrary minute-precision custom times', () => {
    const value = input();
    const data = { ...value, options: [{ id: 'custom', date: '2099-11-27', period: 'custom', start: '18:17', end: '20:09' }] };
    expect(parsePollInput(data).options[0].start).toBe('18:17');
    expect(() => parsePollInput({ ...data, options: [{ ...data.options[0], end: '18:00' }] })).toThrow('終了');
  });
  it.each(['2026-02-30', '2026-13-01', '2026-11-31', '../secrets', ''])('rejects invalid calendar date %s', date => expect(validDate(date)).toBe(false));
  it('allows different periods on the same day, but rejects duplicate options and IDs', () => {
    const first = input().options[0];
    expect(parsePollInput({ ...input(), options: [first, { ...first, id: 'lunch', period: 'lunch' }] }).options).toHaveLength(2);
    expect(() => parsePollInput({ ...input(), options: [first, { ...first, id: 'duplicate' }] })).toThrow('重複');
    expect(() => parsePollInput({ ...input(), options: [first, { ...first, period: 'lunch' }] })).toThrow('重複');
  });
  it('validates participant counts, option limits and timezone names', () => {
    expect(() => parsePollInput({ ...input(), expectedCount: 1 })).toThrow('参加人数');
    expect(() => parsePollInput({ ...input(), expectedCount: 9 })).toThrow('参加人数');
    expect(() => parsePollInput({ ...input(), expectedCount: 2.5 })).toThrow('参加人数');
    expect(() => parsePollInput({ ...input(), options: [] })).toThrow('候補');
    expect(() => parsePollInput({ ...input(), timezone: 'made/up' })).toThrow('タイムゾーン');
    expect(() => parsePollInput({ ...input(), options: Array.from({ length: 31 }, (_, i) => ({ ...input().options[0], id: String(i) })) })).toThrow('候補');
  });
  it('calculates today in the event timezone, independent of the host clock timezone', () => {
    const now = new Date('2026-11-26T01:00:00Z');
    expect(todayInZone('Asia/Tokyo', now)).toBe('2026-11-26');
    expect(todayInZone('America/Argentina/Buenos_Aires', now)).toBe('2026-11-25');
  });
});

describe('schedule agreement and durable edits', () => {
  it.each(['known', 'adjust'] as const)('preserves the planned area step (%s) after date confirmation and reload', placePlan => {
    const { store, directory } = setup();
    const { poll, hostToken } = store.create({ ...input(), placePlan });
    for (let person = 1; person <= 3; person++) respond(store, poll.id, person);
    store.update(poll.id, { action: 'confirm', token: hostToken, optionId: 'fri' });
    expect(createScheduleStore(directory).get(poll.id)).toMatchObject({ placePlan, selectedOptionId: 'fri' });
  });
  it('selects the attending group for the restaurant survey when the area is known', () => {
    const { store } = setup();
    const { poll, hostToken } = store.create({ ...input(), placePlan: 'known', shopPlan: 'adjust' });
    for (const person of [1, 2]) respond(store, poll.id, person);
    const confirm = () => store.update(poll.id, { action: 'confirm', token: hostToken, optionId: 'fri' });
    expect(confirm).toThrow('全員の回答');
    respond(store, poll.id, 3, { fri: 'no', sat: 'yes' });
    expect(attendingIds(confirm())).toEqual(['person-1', 'person-2']);
  });
  it.each(['known', 'adjust', 'skip'] as const)('retains the shop decision %s after voting and reopening', shopPlan => {
    const { store, directory } = setup();
    const { poll, hostToken } = store.create({ ...input(), placePlan: 'known', shopPlan });
    expect(poll.shopPlan).toBe(shopPlan);
    for (let person = 1; person <= 3; person++) respond(store, poll.id, person);
    expect(store.update(poll.id, { action: 'confirm', token: hostToken, optionId: 'fri' }).shopPlan).toBe(shopPlan);
    store.update(poll.id, { action: 'reopen', token: hostToken });
    expect(createScheduleStore(directory).get(poll.id)).toMatchObject({ placePlan: 'known', shopPlan, selectedOptionId: null });
  });
  it('does not confuse no response, conditional response or rejection with consent', () => {
    const { store, poll } = setup();
    expect(summarizeOption(poll, 'fri')).toMatchObject({ status: 'waiting', yes: 0, pending: 3 });
    respond(store, poll.id, 1);
    respond(store, poll.id, 2);
    const mixed = respond(store, poll.id, 3, { fri: 'maybe', sat: 'no' });
    expect(summarizeOption(mixed, 'fri')).toMatchObject({ status: 'discuss', yes: 2, maybe: 1, pending: 0 });
    expect(summarizeOption(mixed, 'sat').status).toBe('unavailable');
  });
  it('requires complete consent, locks answers once confirmed, and supports reopening', () => {
    const { store, poll, hostToken } = setup();
    const confirm = () => store.update(poll.id, { action: 'confirm', token: hostToken, optionId: 'fri' });
    respond(store, poll.id, 1); respond(store, poll.id, 2);
    expect(confirm).toThrow('全員');
    respond(store, poll.id, 3, { fri: 'maybe', sat: 'yes' });
    expect(confirm).toThrow('全員');
    respond(store, poll.id, 3);
    expect(confirm().selectedOptionId).toBe('fri');
    expect(() => store.update(poll.id, { action: 'confirm', token: hostToken, optionId: 'sat' })).toThrow('再開');
    expect(() => respond(store, poll.id, 1, { fri: 'no', sat: 'yes' })).toThrow('決定済み');
    store.update(poll.id, { action: 'reopen', token: hostToken });
    expect(respond(store, poll.id, 1, { fri: 'no', sat: 'yes' }).selectedOptionId).toBeNull();
  });
  it('editing and retrying a response never adds votes or loses another participant', () => {
    const { store, poll, directory } = setup();
    respond(store, poll.id, 1); respond(store, poll.id, 2);
    const reopenedStore = createScheduleStore(directory);
    const edited = respond(reopenedStore, poll.id, 1, { fri: 'no', sat: 'yes' });
    expect(edited.responses).toHaveLength(2);
    expect(edited.responses.find(item => item.id === 'person-2')?.answers.fri).toBe('yes');
    expect(store.get(poll.id).responses).toEqual(edited.responses);
  });
  it('does not permit invitees to manage the poll or modify another response', () => {
    const { store, poll } = setup();
    respond(store, poll.id, 1);
    expect(() => store.update(poll.id, { action: 'confirm', token: 'wrong-token-that-is-long-enough', optionId: 'fri' })).toThrow('権限');
    expect(() => store.update(poll.id, { action: 'respond', responseId: 'person-1', token: 'wrong-token-that-is-long-enough', name: '他人', answers: { fri: 'no', sat: 'no' } })).toThrow('権限');
    const exposed = JSON.stringify(store.get(poll.id));
    expect(exposed).not.toContain('Hash');
    expect(exposed).not.toContain('private-response-token');
  });
  it('added options preserve existing answers and start unanswered for everyone', () => {
    const { store, poll, hostToken } = setup();
    for (const i of [1, 2, 3]) respond(store, poll.id, i);
    const updated = store.update(poll.id, { action: 'add-option', token: hostToken, option: { id: 'sun', date: '2099-11-29', period: 'afternoon' } });
    expect(summarizeOption(updated, 'fri').status).toBe('ready');
    expect(summarizeOption(updated, 'sun')).toMatchObject({ pending: 3, yes: 0, status: 'waiting' });
    expect(completedResponses(updated)).toBe(0);
    expect(() => respond(store, poll.id, 1)).toThrow('すべて');
    expect(store.get(poll.id).responses[0].answers.fri).toBe('yes');
  });
  it('blocks extra participants instead of silently changing the group size', () => {
    const { store, poll } = setup();
    for (const i of [1, 2, 3]) respond(store, poll.id, i);
    expect(() => respond(store, poll.id, 4)).toThrow('予定人数');
  });
  it('handles missing polls and prevents traversal through public IDs', () => {
    const { store } = setup();
    expect(() => store.get('../db')).toThrow('見つかりません');
    expect(() => store.get('00000000-0000-0000-0000-000000000000')).toThrow('見つかりません');
  });
});

it('adds several periods atomically, preserves votes and accepts a retry', () => {
  const { store, poll, hostToken } = setup();
  respond(store, poll.id, 1);
  const additions = ['morning', 'lunch', 'afternoon'].map(period => ({ id: period, date: '2099-11-27', period }));
  const add = (options: typeof additions) => store.update(poll.id, { action: 'add-option', token: hostToken, options });
  expect(() => add([...additions, { id: 'again', date: '2099-11-27', period: 'evening' }])).toThrow('重複');
  expect(store.get(poll.id).options).toHaveLength(2);
  add(additions);
  const updated = add(additions);
  expect(updated.options).toHaveLength(5);
  expect(summarizeOption(updated, 'morning').pending).toBe(3);
  expect(summarizeOption(updated, 'fri').yes).toBe(1);
});

it('allows 30 distinct slots at creation or after adding slots, and rejects the 31st', () => {
  const { store } = setup();
  const options = Array.from({ length: 30 }, (_, i) => ({ id: String(i), date: '2099-11-' + String(i+1).padStart(2, '0'), period: 'lunch' }));
  expect(store.create({ ...input(), options }).poll.options).toHaveLength(30);
  const { poll, hostToken } = store.create({ ...input(), options: options.slice(0, 12) });
  const add = (slots: typeof options) => store.update(poll.id, { action: 'add-option', options: slots, token: hostToken });
  expect(add(options.slice(12)).options).toHaveLength(30);
  expect(() => add([{ ...options[0], period: 'evening', id: 'extra' }])).toThrow('30');
  expect(store.get(poll.id).options).toHaveLength(30);
});
