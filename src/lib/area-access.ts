import { discoveryShops, freshAnswer, menusFor } from './instant/discovery';
import { record, ScheduleError, textField } from './schedule';

// Fictional station-to-neighborhood travel times, fixed for this interactive demo.
// Both directions use the same fixture. Each value includes walking to the sample venue.
export const accessAreas = ['marunouchi', 'shinjuku', 'ueno', 'kuramae'] as const;
export const accessStations = [
  { id: 'tokyo', label: '東京', minutes: [6, 24, 16, 27] },
  { id: 'omiya', label: '大宮（埼玉方面）', minutes: [46, 40, 34, 50] },
  { id: 'shinjuku', label: '新宿', minutes: [24, 6, 31, 36] },
  { id: 'shibuya', label: '渋谷', minutes: [30, 13, 39, 43] },
  { id: 'ueno', label: '上野', minutes: [16, 31, 5, 14] },
  { id: 'asakusa', label: '浅草', minutes: [30, 41, 17, 9] },
  { id: 'kuramae', label: '蔵前', minutes: [27, 36, 14, 5] },
  { id: 'ikebukuro', label: '池袋', minutes: [29, 15, 22, 37] },
];
export type ShopSuggestion = { text: string; areaId: string };
export type AccessTrip = { anywhere?: boolean; origin: string; onward: string; wish: string; suggestion?: ShopSuggestion };
export function suggestionLink(text: string): string | undefined {
  try {
    const url = new URL(text);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* A shop name is also valid. */ }
}

export type AccessOption = { areaId: string; reason: string; shop?: string; menu?: string; worst: number | null; inboundRange: [number, number] | null };

export function parseTrip(input: Record<string, unknown>): AccessTrip {
  const { origin, onward, wish = '' } = input;
  let sharedShop: ShopSuggestion | undefined;
  if (input.suggestion != null) {
    const suggestion = record(input.suggestion);
    const text = textField(suggestion.text, '店名またはリンク', 2000);
    const areaId = textField(suggestion.areaId, 'お店のエリア', 50, false);
    if (areaId && !accessAreas.some(id => id === areaId)) throw new ScheduleError('お店のエリアを確認してください。');
    sharedShop = { text, areaId };
  }
  const suggestion = sharedShop ? { suggestion: sharedShop } : {};
  if (input.anywhere === true) return { anywhere: true, origin: '', onward: '', wish: '', ...suggestion };
  const validStation = (id: unknown) => accessStations.some(station => station.id === id);
  if (typeof origin !== 'string' || !validStation(origin)) throw new ScheduleError('出発駅を選んでください。');
  if (typeof onward !== 'string' || !(['return', 'unknown'].includes(onward) || validStation(onward))) throw new ScheduleError('解散後の行き先を選んでください。');
  if (typeof wish !== 'string' || (wish && !accessAreas.some(area => area === wish))) throw new ScheduleError('希望の街を確認してください。');
  return { origin, onward, wish, ...suggestion };
}

export function tripMinutes(trip: AccessTrip, areaId: string) {
  if (trip.anywhere) return null;
  const index = accessAreas.findIndex(id => id === areaId);
  const origin = accessStations.find(s => s.id === trip.origin);
  const onward = accessStations.find(s => s.id === (trip.onward === 'return' ? trip.origin : trip.onward));
  if (index < 0 || !origin || (!onward && trip.onward !== 'unknown')) return null;
  return { inbound: origin.minutes[index], onward: onward?.minutes[index] ?? null };
}

function areaVenues(areaId: string, mode: string, partySize: number) {
  const config = { areaId, mode, partySize, radius: 500 };
  const shops = discoveryShops.filter(shop => shop.areaId === areaId && (mode === '食事' || shop.acceptsDrinkOnly));
  return shops.map(shop => ({ shop, menus: menusFor(config, shop, freshAnswer()) })).filter(entry => entry.menus.length);
}

export function accessShortlist(trips: AccessTrip[], mode: string | null): AccessOption[] {
  if (!trips.length) return [];
  const travelers = trips.filter(trip => !trip.anywhere);
  const venues = accessAreas.flatMap(areaId => {
    const matches = mode ? areaVenues(areaId, mode, trips.length) : [];
    if (mode && !matches.length) return [];
    const legs = travelers.map(trip => tripMinutes(trip, areaId));
    if (legs.some(leg => !leg)) return [];
    const times = legs.map(leg => leg!.inbound + (leg!.onward ?? 0));
    const arrivals = legs.map(leg => leg!.inbound);
    const inboundRange: [number, number] | null = arrivals.length ? [Math.min(...arrivals), Math.max(...arrivals)] : null;
    const featured = matches[0];
    return [{ areaId, times, inboundRange, count: matches.length, suggested: trips.some(t => t.suggestion?.areaId === areaId),
      wishes: trips.filter(t => (t.suggestion?.areaId || t.wish) === areaId).length,
      shop: featured?.shop.name, menu: featured?.menus.find(m => m.kind !== 'drink')?.name ?? featured?.menus[0].name }];
  });
  if (!venues.length) return [];
  if (!travelers.length) {
    return [...venues].sort((a, b) => b.wishes - a.wishes || b.count - a.count).slice(0, 3)
      .map(({ areaId, suggested, count, shop, menu }) => ({
        areaId, shop, menu, worst: null, inboundRange: null,
        reason: !mode ? 'みんなが集まれる街' : suggested ? '参加者のおすすめのお店がある街' : `今回の用途に合うお店が${count}軒`,
      }));
  }
  const minima = travelers.map((_, i) => Math.min(...venues.map(v => v.times[i])));
  const rows = venues.map(v => ({ ...v, worst: Math.max(...v.times.map((time, i) => time - minima[i])), total: v.times.reduce((a,b) => a+b, 0) }));
  const floor = Math.min(...rows.map(v => v.worst));
  const fair = rows.filter(v => v.worst <= floor + 5).sort((a,b) => a.total-b.total || a.worst-b.worst)[0];
  const choices: AccessOption[] = [];
  function add(row: typeof fair, reason: string) {
    if (choices.length >= 3 || choices.some(c => c.areaId === row.areaId)) return;
    choices.push({ areaId: row.areaId, reason, shop: row.shop, menu: row.menu, worst: row.worst, inboundRange: row.inboundRange });
  }
  add(fair, fair.suggested ? '集まりやすく、おすすめのお店もある街' : fair.wishes ? '集まりやすく、希望もある街' : 'みんなが集まりやすい街');
  for (const row of [...rows].filter(v => v.wishes).sort((a,b) => b.wishes-a.wishes || a.worst-b.worst)) add(row, row.suggested ? 'おすすめのお店がある街' : '参加者が行きたい街');
  if (!mode) {
    for (const row of [...rows].sort((a, b) => a.worst - b.worst || a.total - b.total)) {
      add(row, '移動時間を比べる候補');
    }
    return choices;
  }
  const variety = [...rows].sort((a,b) => b.count-a.count || a.worst-b.worst)[0];
  if (variety.count > fair.count) add(variety, '用途に合うお店が多い街');
  // Surface a specific food people cannot get in an already displayed area.
  const discovery = [...rows].sort((a,b) => a.worst-b.worst).find(v => !choices.some(c => c.areaId === v.areaId || c.menu === v.menu));
  if (discovery) add(discovery, 'この一品を目当てに');
  return choices;
}
