import type { SchedulePoll } from '@/lib/schedule';
import type { AreaPoll } from '@/lib/area-poll';
import { sharedShopStage } from '@/lib/shared-shop-stage';
import type { ShopPoll } from '@/lib/shop-poll';
import { noMember, type DeviceRecord, type Gathering } from './gathering';

const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

function deviceRecords() {
  const dates = new Map<string, DeviceRecord>();
  const areas = new Map<string, DeviceRecord>();
  const shops = new Map<string, DeviceRecord>();
  const indexes = { schedule: dates, area_poll: areas, shop: shops };
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    const match = key?.match(/^meshimatch_(schedule|area_poll|shop)_v1_(.+)$/);
    if (!key || !match || !uuid.test(match[2])) continue;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!stored || !Array.isArray(stored.responses)) continue;
      const host = typeof stored.hostToken === 'string' && stored.hostToken.length > 0;
      const ids = stored.responses.flatMap((person: { id?: string; token?: string } | null) =>
        person && typeof person.id === 'string' && typeof person.token === 'string' && person.token.length > 0 ? [person.id] : []);
      if (host || ids.length) indexes[match[1] as keyof typeof indexes].set(match[2], { host, ids });
    } catch { /* A malformed record shouldn't hide other gatherings. */ }
  }
  return { dates, areas, shops };
}

async function fetchPoll<T>(url: string, signal: AbortSignal, allowConflict = false): Promise<T | undefined> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (response.status === 404 || (allowConflict && response.status === 409)) return;
  if (!response.ok) throw new Error('集まりを読み込めませんでした。');
  const data = await response.json();
  return data.poll;
}

async function forEachBatch<T>(items: T[], work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += 5) await Promise.all(items.slice(i, i + 5).map(work));
}

export async function loadDeviceGatherings(signal: AbortSignal) {
  const records = deviceRecords();
  const dates = new Map<string, SchedulePoll>();
  const areas = new Map<string, AreaPoll>();
  let retry = false;

  async function load<T>(kind: string, ids: string[], target: Map<string, T>) {
    await forEachBatch(ids, async id => {
      signal.throwIfAborted();
      try {
        const poll = await fetchPoll<T>('/api/' + kind + '/' + encodeURIComponent(id), signal);
        if (poll) target.set(id, poll);
      } catch (error) {
        if (signal.aborted) throw error;
        retry = true;
      }
    });
  }

  await load('schedules', [...records.dates.keys()], dates);
  const areaIds = new Set(records.areas.keys());
  for (const date of dates.values()) if (date.areaPollId) areaIds.add(date.areaPollId);
  await load('area-polls', [...areaIds], areas);

  // A participant in an older place poll can have an area credential only.
  const linkedIds = new Set<string>();
  for (const area of areas.values()) {
    if (area.scheduleId && !records.dates.has(area.scheduleId)) linkedIds.add(area.scheduleId);
  }
  await load('schedules', [...linkedIds], dates);
  const currentAreaIds = new Set<string>();
  for (const date of dates.values()) {
    if (date.areaPollId && !areaIds.has(date.areaPollId)) currentAreaIds.add(date.areaPollId);
  }
  await load('area-polls', [...currentAreaIds], areas);

  const entries: Gathering[] = [];
  const includedAreas = new Set<string>();
  for (const schedule of dates.values()) {
    const area = schedule.areaPollId ? areas.get(schedule.areaPollId) :
      [...areas.values()].find(item => item.scheduleId === schedule.id && item.scheduleOptionId === schedule.selectedOptionId);
    if (area) includedAreas.add(area.id);
    entries.push({ id: 'schedule-' + schedule.id, schedule, area, dateMember: records.dates.get(schedule.id) ?? noMember, areaMember: records.areas.get(area?.id ?? '') ?? noMember });
  }
  for (const area of areas.values()) {
    if (includedAreas.has(area.id) || (area.scheduleId && dates.has(area.scheduleId))) continue;
    entries.push({ id: 'area-' + area.id, area, dateMember: noMember, areaMember: records.areas.get(area.id) ?? noMember });
  }

  await forEachBatch(entries, async entry => {
    const stage = sharedShopStage(entry.schedule, entry.area);
    if (!stage) return;
    signal.throwIfAborted();
    try {
      entry.shop = await fetchPoll<ShopPoll>('/api/shop-polls/' + encodeURIComponent(stage.id), signal, true);
    } catch (error) {
      if (signal.aborted) throw error;
      retry = true;
    }
  });
  const standalone = new Map<string, ShopPoll>();
  await load('shop-polls', [...records.shops.keys()], standalone);
  for (const shop of standalone.values()) {
    const member = records.shops.get(shop.id);
    if (shop.source !== 'standalone' || !member) continue;
    if (!member.host && !shop.participants.some(person => member.ids.includes(person.id))) continue;
    entries.push({ id: 'shop-' + shop.id, shop, shopMember: member, dateMember: noMember, areaMember: noMember });
  }
  const updated = (entry: Gathering) => [entry.schedule?.updatedAt, entry.area?.updatedAt, entry.shop?.updatedAt, entry.shop?.createdAt].filter(Boolean).sort().at(-1) ?? '';
  entries.sort((a, b) => updated(b).localeCompare(updated(a)) || a.id.localeCompare(b.id));
  return { entries, retry };
}
