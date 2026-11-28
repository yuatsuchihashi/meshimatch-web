import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SchedulePoll } from '@/lib/schedule';
import type { AreaPoll } from '@/lib/area-poll';
import { defaultDiscoveryConfig } from '@/lib/instant/discovery-session';
import { discoveryShops } from '@/lib/instant/discovery';
import type { ShopPoll } from '@/lib/shop-poll';
import { loadDeviceGatherings } from './device-gatherings';
import { gatheringAction, gatheringDescription, noMember, type Gathering } from './gathering';

const id = '00000000-0000-0000-0000-000000000001';
const oldAreaId = '00000000-0000-0000-0000-000000000002';
const when = '2099-01-01T00:00:00Z';
const date: SchedulePoll = {
  id, title: '友人との夕食', areaPollId: id, placePlan: 'adjust', timezone: 'Asia/Tokyo', expectedCount: 3,
  description: '', selectedOptionId: 'night', options: [{ id: 'night', date: '2099-01-01', period: 'evening' }],
  createdAt: when, updatedAt: when,
  responses: ['alice', 'bob', 'charlie'].map(person => ({
    id: person, name: '同じ名前', comment: '', answers: { night: person === 'charlie' ? 'no' : 'yes' }, updatedAt: when,
  })),
};
const area: AreaPoll = {
  id, cityId: 'tokyo', expectedCount: 2, mode: '食事', scheduleId: id, scheduleOptionId: null, areaIds: ['shibuya'],
  responses: [], selectedAreaId: 'shibuya', createdAt: when, updatedAt: when, attendanceBased: true,
};
const shop: ShopPoll = {
  id, scheduleId: id, dateOption: date.options[0], title: date.title, timezone: date.timezone, config: defaultDiscoveryConfig,
  contextKey: 'sample', shortlistVersion: '1', participants: ['alice', 'bob'].map(id => ({ id, name: '同じ名前', answered: false })),
  candidates: [], suggestions: [], selectedShopId: null,
};
const group: Gathering = { id, schedule: date, area, shop, dateMember: { ids: ['alice'], host: false }, areaMember: noMember };
const candidate = { shopId: discoveryShops[0].id, shop: discoveryShops[0], groupReason: '', recommended: false };

afterEach(() => { vi.unstubAllGlobals(); });

describe('gathering on this device', () => {
  it('summarizes the confirmed date, place and attending headcount', () => {
    expect(gatheringDescription(group)).toMatchObject({ title: date.title, date: expect.stringContaining('夜'), location: '渋谷', count: 2 });
  });
  it('resumes an eligible respondent and explicitly leaves identity selection to a shared device', () => {
    expect(gatheringAction(group)).toMatchObject({ href: '/shop/' + id, label: 'お店の希望に回答する' });
    expect(gatheringAction({ ...group, dateMember: { ids: ['alice', 'bob'], host: false } })).toMatchObject({ href: '/shop/' + id, label: '回答する人を選ぶ' });
  });
  it('keeps nonattending members off the survey while letting a nonattending organizer decide', () => {
    const completed = { ...shop, participants: shop.participants.map(person => ({ ...person, answered: true })), candidates: [candidate] };
    const absent = { ...group, shop: completed, dateMember: { ids: ['charlie'], host: false } };
    expect(gatheringAction(absent)).toMatchObject({ href: '/schedule/' + id + '?view=results', label: '日程を確認する' });
    expect(gatheringAction({ ...absent, dateMember: { ...absent.dateMember, host: true } }).label).toBe('お店を決める');
    expect(gatheringAction({ ...group, shop: { ...completed, selectedShopId: candidate.shopId } }).venue?.name).toBe(candidate.shop.name);
  });
  it('resumes the area ballot for an attending guest and the in-person flow for a standalone area host', () => {
    expect(gatheringAction({ ...group, shop: undefined, area: { ...area, selectedAreaId: null } }).href).toBe('/area/' + id + '?view=answer&person=alice');
    expect(gatheringAction({ ...group, schedule: undefined, shop: undefined, area: { ...area, scheduleId: null }, areaMember: { ids: [], host: true } }).href).toBe('/instant?area=' + id);
  });
});

describe('device-only gathering index', () => {
  function storage(values: Record<string, string>) {
    vi.stubGlobal('localStorage', { length: Object.keys(values).length, key: (index: number) => Object.keys(values)[index], getItem: (key: string) => values[key] });
  }
  it('finishes date-only, area-only and linked gatherings when the host already chose a shop', () => {
    const host = { ids: [], host: true };
    const knownDate = { ...date, placePlan: 'known' as const, shopPlan: 'known' as const };
    const knownArea = { ...area, shopPlan: 'known' as const };
    expect(gatheringAction({ ...group, schedule: knownDate, area: undefined, shop: undefined, dateMember: host }).href).toBe('/schedule/' + id + '?view=results');
    expect(gatheringAction({ ...group, schedule: undefined, area: { ...knownArea, scheduleId: null }, areaMember: host }).href).toBe('/area/' + id + '?view=results');
    expect(gatheringAction({ ...group, area: knownArea }).label).toBe('集合エリアを見る');
    expect(gatheringDescription({ ...group, schedule: undefined, area: knownArea }).title).toBe('渋谷での集まり');
  });
  it('continues a saved area answer on the same device before choosing a café area', async () => {
    storage({ ['meshimatch_area_poll_v1_' + id]: JSON.stringify({ responses: [{ id: 'alice', token: 'area-ticket' }] }) });
    const openArea = { ...area, scheduleId: null, attendanceBased: false, selectedAreaId: null, shopPlan: 'adjust', responses: [{id: 'alice'}] };
    const pendingShop = { ...shop, source: 'area', areaPollId: id, scheduleId: null, dateOption: null,
      config: { ...shop.config, areaId: '', mode: 'カフェ・軽食' }, pendingArea: { cityId: 'tokyo', areaIds: ['shibuya'] },
      participants: [{id: 'alice', answered: false}] };
    vi.stubGlobal('fetch', async (url: string) => Response.json({ poll: url.includes('/area-polls/') ? openArea : pendingShop }));
    const loading = async () => gatheringAction((await loadDeviceGatherings(new AbortController().signal)).entries[0]);
    expect(await loading()).toMatchObject({ href: '/shop/' + id, label: 'カフェの希望に回答する' });
    pendingShop.participants[0].answered = true;
    expect(await loading()).toMatchObject({ detail: expect.stringContaining('集合エリアの決定を待って') });
    openArea.responses.push({id: 'bob'});
    storage({ ['meshimatch_area_poll_v1_' + id]: JSON.stringify({ hostToken: 'organizer', responses: [{ id: 'alice', token: 'area-ticket' }] }) });
    expect(await loading()).toMatchObject({ href: '/area/' + id + '?view=results', label: 'エリアの候補を確認する' });
  });
  it('invites the next joint participant to answer their own area before their menu preferences', () => {
    const pending: ShopPoll = { ...shop, participants: [shop.participants[1]], pendingArea: { cityId: 'tokyo', areaIds: ['shibuya'] } };
    const linked = { ...group, schedule: { ...date, selectedOptionId: null, attendanceBased: true }, area: { ...area, selectedAreaId: null }, shop: pending };
    expect(gatheringAction(linked)).toMatchObject({ href: '/area/' + id + '?view=answer&person=alice' });
    expect(gatheringAction({ ...linked, dateMember: { ids: ['bob'], host: false } })).toMatchObject({ href: '/shop/' + id });
    expect(gatheringAction({ ...linked, dateMember: { ids: ['bob'], host: true } })).toMatchObject({ href: '/schedule/' + id + '?view=results' });
  });
  it('does not request a shop poll when the event already has a shop', async () => {
    storage({ ['meshimatch_schedule_v1_' + id]: JSON.stringify({ hostToken: 'host', responses: [] }) });
    const get = vi.fn(async (url: string) => Response.json({ poll: url.includes('/schedules/') ? { ...date, shopPlan: 'known' } : area }));
    vi.stubGlobal('fetch', get);
    const { entries } = await loadDeviceGatherings(new AbortController().signal);
    expect(entries).toHaveLength(1);
    expect(get.mock.calls.some(([url]) => url.includes('shop-polls'))).toBe(false);
  });
  it('reopens an independent shop invitation from a host browser, including when no one has answered', async () => {
    const created = { ...shop, source: 'standalone', scheduleId: null, dateOption: null,
      title: '土曜のカフェ', participants: [], config: { ...shop.config, partySize: 3 } };
    storage({ ['meshimatch_shop_v1_' + id]: JSON.stringify({ hostToken: 'host-test', responses: [] }) });
    const get = vi.fn(async () => Response.json({ poll: created }));
    vi.stubGlobal('fetch', get);
    const { entries } = await loadDeviceGatherings(new AbortController().signal);
    expect(entries).toHaveLength(1);
    expect(gatheringAction(entries[0])).toMatchObject({ href: '/shop/' + id, label: '招待・自分の回答へ', detail: expect.stringContaining('0 / 3') });
    expect(gatheringDescription(entries[0])).toMatchObject({ title: '土曜のカフェ', count: 3 });
    expect(JSON.stringify(get.mock.calls)).not.toContain('host-test');
  });
  it('only includes a standalone guest gathering when the participant submitted a ballot', async () => {
    const credentials = { responses: [{ id: 'alice', token: 'local-only' }] };
    storage({ ['meshimatch_shop_v1_' + id]: JSON.stringify(credentials) });
    const created = { ...shop, source: 'standalone', scheduleId: null, dateOption: null, participants: [{ id: 'alice', name: 'Alice', answered: true }] };
    const get = vi.fn().mockResolvedValueOnce(Response.json({ poll: { ...created, participants: [] } }))
      .mockResolvedValueOnce(Response.json({ poll: created }));
    vi.stubGlobal('fetch', get);
    expect((await loadDeviceGatherings(new AbortController().signal)).entries).toHaveLength(0);
    const { entries } = await loadDeviceGatherings(new AbortController().signal);
    expect(entries).toHaveLength(1);
    expect(gatheringAction(entries[0])).toMatchObject({ label: 'お店の回答状況を見る', detail: expect.stringContaining('1 / 2') });
  });
  it('uses area credentials for the shop vote after an area-only decision', async () => {
    storage({ ['meshimatch_area_poll_v1_' + id]: JSON.stringify({ responses: [{ id: 'alice', token: 'area-ticket' }] }) });
    const onlyArea = { ...area, scheduleId: null, shopPlan: 'adjust' };
    vi.stubGlobal('fetch', async (url: string) => Response.json({ poll: url.includes('/area-polls/') ? onlyArea : { ...shop, source: 'area', scheduleId: null, areaPollId: id } }));
    const { entries } = await loadDeviceGatherings(new AbortController().signal);
    expect(gatheringAction(entries[0])).toMatchObject({ href: '/shop/' + id, label: 'お店の希望に回答する' });
  });
  it('changes a date-only host’s action from setup to the shared shop invitation after setup', async () => {
    storage({ ['meshimatch_schedule_v1_' + id]: JSON.stringify({ hostToken: 'schedule-host', responses: [] }) });
    const knownArea = { ...date, placePlan: 'known', areaPollId: undefined, shopPlan: 'adjust' };
    let prepared = false;
    vi.stubGlobal('fetch', async (url: string) => url.includes('/schedules/') ? Response.json({ poll: knownArea }) :
      prepared ? Response.json({ poll: { ...shop, source: 'schedule' } }) : new Response(null, { status: 409 }));
    const loading = () => loadDeviceGatherings(new AbortController().signal);
    expect(gatheringAction((await loading()).entries[0]).href).toBe('/instant?schedule=' + id);
    prepared = true;
    expect(gatheringAction((await loading()).entries[0]).href).toBe('/shop/' + id);
  });
  it('does not discover gatherings from preview, unrelated local keys, or a corrupt record', async () => {
    storage({ ['meshimatch_schedule_v1_' + id]: '{invalid', ['meshimatch_area_poll_v1_' + id]: '{"responses":[]}', ['meshimatch_create_schedule_v1_' + id]: '{}' });
    const get = vi.fn(); vi.stubGlobal('fetch', get);
    expect(await loadDeviceGatherings(new AbortController().signal)).toEqual({ entries: [], retry: false });
    expect(get).not.toHaveBeenCalled();
  });
  it('combines the legacy two-ID invitation using public reads without disclosing device secrets', async () => {
    const credentials = { responses: [{ id: 'alice', token: 'test-secret' }] };
    storage({ ['meshimatch_schedule_v1_' + id]: JSON.stringify(credentials), ['meshimatch_area_poll_v1_' + oldAreaId]: JSON.stringify(credentials) });
    const byUrl: Record<string, unknown> = {
      ['/api/schedules/' + id]: { ...date, areaPollId: undefined },
      ['/api/area-polls/' + oldAreaId]: { ...area, id: oldAreaId, scheduleOptionId: 'night' },
      ['/api/shop-polls/' + oldAreaId]: { ...shop, id: oldAreaId },
    };
    const get = vi.fn(async (url: string) => Response.json({ poll: byUrl[url] })); vi.stubGlobal('fetch', get);
    const { entries, retry } = await loadDeviceGatherings(new AbortController().signal);
    expect(retry).toBe(false);
    expect(entries).toHaveLength(1);
    expect(gatheringAction(entries[0]).href).toBe('/shop/' + oldAreaId);
    expect(JSON.stringify(get.mock.calls)).not.toContain('test-secret');
  });
  it('does not show a superseded area as another gathering or as its current decision', async () => {
    storage({ ['meshimatch_area_poll_v1_' + oldAreaId]: JSON.stringify({ responses: [{ id: 'alice', token: 'old-token' }] }) });
    const byUrl: Record<string, unknown> = {
      ['/api/schedules/' + id]: date,
      ['/api/area-polls/' + oldAreaId]: { ...area, id: oldAreaId, scheduleOptionId: 'another-night' },
      ['/api/area-polls/' + id]: { ...area, selectedAreaId: null },
    };
    vi.stubGlobal('fetch', (url: string) => Promise.resolve(Response.json({ poll: byUrl[url] })));
    const { entries } = await loadDeviceGatherings(new AbortController().signal);
    expect(entries).toHaveLength(1);
    expect(entries[0].area?.id).toBe(id);
    expect(gatheringDescription(entries[0]).location).toBe('東京');
    expect(gatheringAction(entries[0]).label).toBe('場所の回答状況を見る');
  });
  it('omits removed records and provides retry for a temporary network failure', async () => {
    const host = JSON.stringify({ hostToken: 'test-host', responses: [] });
    storage({ ['meshimatch_schedule_v1_' + id]: host, ['meshimatch_area_poll_v1_' + oldAreaId]: host });
    vi.stubGlobal('fetch', (url: string) => Promise.resolve(new Response(null, { status: url.includes('/schedules/') ? 404 : 503 })));
    expect(await loadDeviceGatherings(new AbortController().signal)).toEqual({ entries: [], retry: true });
  });
});
