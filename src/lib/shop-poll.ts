import type { MeetingCityId } from './meeting-areas';
import type { ShopSuggestion } from './area-access';
import {
  areas, cafeDetailLabels, cafePlanLabels, dietLabels, discoveryShops, distanceMeters, freshAnswer, heatOptions,
  modes, rankShops, restaurantGenres, restaurantNoiseLabels, restaurantVenuePreferenceLabels,
  selectDiscoveryShortlist, styleLabels, venuePreferenceLabels,
  type CafePreferences, type DiscoveryAnswer, type DiscoveryCandidate, type DiscoveryConfig, type DiscoveryShop,
} from './instant/discovery';
import { record, ScheduleError, type ScheduleOption } from './schedule';

export type { ShopSuggestion } from './area-access';

export interface ShopCandidate {
  shopId: string;
  shop: DiscoveryShop;
  recommended: boolean;
  groupReason: string;
}

export interface ShopPoll {
  id: string;
  scheduleId: string | null;
  areaPollId?: string;
  pendingArea?: { cityId: MeetingCityId; areaIds: string[] };
  source?: 'standalone' | 'schedule' | 'area';
  createdAt?: string;
  updatedAt?: string;
  title: string;
  dateOption: ScheduleOption | null;
  timezone: string;
  config: DiscoveryConfig;
  contextKey: string;
  shortlistVersion: string;
  participants: { id: string; name: string; answered: boolean }[];
  candidates: ShopCandidate[];
  suggestions: ShopSuggestion[];
  selectedShopId: string | null;
}

function choices(input: unknown, allowed: readonly string[], label: string): string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.some(value => typeof value !== 'string' || !allowed.includes(value))) {
    throw new ScheduleError(label + 'の選択肢を確認してください。');
  }
  return [...new Set<string>(input)];
}

function details(input: unknown, options: Record<string, string[]>): Record<string, string[]> {
  if (input === undefined) return {};
  return Object.fromEntries(Object.entries(record(input)).map(([key, values]) => {
    if (!Object.hasOwn(options, key)) throw new ScheduleError('料理や空間の選択肢を確認してください。');
    return [key, choices(values, options[key], '好み')];
  }));
}

function budgetLimit(input: unknown): string {
  if (input === undefined || input === '') return '';
  // The number input can submit decimal or exponential notation even with step="1".
  const amount = typeof input === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input) ? Number(input) : NaN;
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new ScheduleError('予算の上限は1以上の整数で入力してください。');
  }
  return String(amount);
}

const cafeDetails = Object.fromEntries(Object.entries(cafeDetailLabels).map(([key, labels]) => [key, Object.keys(labels)]));
const cafeKeys = [...Object.keys(cafeDetails), ...Object.keys(venuePreferenceLabels)];
const restaurantDetails = Object.fromEntries(restaurantGenres.map(genre => [genre.id, genre.dishIds]));
const restaurantGenreIds = restaurantGenres.map(genre => genre.id);
const restaurantKeys = [...restaurantGenreIds, ...Object.keys(restaurantVenuePreferenceLabels)];

export function parseShopAnswer(input: unknown, config: DiscoveryConfig): DiscoveryAnswer {
  const raw = record(input);
  const answer = freshAnswer();
  answer.diet = choices(raw.diet, Object.keys(dietLabels), '食事条件');
  answer.budget = budgetLimit(raw.budget);
  if (raw.heat !== undefined && raw.heat !== '') {
    if (config.mode !== '食事' || typeof raw.heat !== 'string' || !Object.hasOwn(heatOptions, raw.heat)) {
      throw new ScheduleError('辛さの選択肢を確認してください。');
    }
    answer.heat = raw.heat;
  }
  if (config.mode === '食事' && raw.cafe === undefined) {
    const r = record(raw.restaurant === undefined ? {} : raw.restaurant);
    answer.restaurant = {
      genres: choices(r.genres, restaurantGenreIds, '料理'),
      details: details(r.details, restaurantDetails),
      important: choices(r.important, restaurantKeys, '重視すること'),
      styles: choices(r.styles, Object.keys(styleLabels), '空間'),
      undecided: choices(r.undecided, restaurantKeys, '未定の項目'),
      noisePreferences: choices(r.noisePreferences, Object.keys(restaurantNoiseLabels), '店内のにぎやかさ'),
    };
  } else if (config.mode === 'カフェ・軽食' && raw.restaurant === undefined) {
    const c = record(raw.cafe === undefined ? {} : raw.cafe);
    const plan = c.plan === undefined ? 'onsite' : c.plan;
    if (typeof plan !== 'string' || !Object.hasOwn(cafePlanLabels, plan)) throw new ScheduleError('注文の選択肢を確認してください。');
    const foodDecision = c.foodDecision;
    if (foodDecision !== undefined && foodDecision !== 'unspecified' && foodDecision !== 'selected' && foodDecision !== 'onsite' && foodDecision !== 'none') {
      throw new ScheduleError('食べたいものの選択肢を確認してください。');
    }
    const cafe: CafePreferences = {
      interests: choices(c.interests, cafeKeys, '気になること'),
      details: details(c.details, cafeDetails),
      undecided: choices(c.undecided, ['food', ...cafeKeys], '未定の項目'),
      important: choices(c.important, cafeKeys, '重視すること'),
      plan,
    };
    if (foodDecision !== undefined) cafe.foodDecision = foodDecision;
    answer.cafe = cafe;
  } else {
    throw new ScheduleError('この集まりの用途に合うアンケートを開いてください。');
  }
  return answer;
}

function matchName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s*\(サンプル\)$/, '').trim().toLowerCase();
}

function candidateReason(candidate: DiscoveryCandidate, position: number, poolSize: number, config: DiscoveryConfig, recommended: boolean) {
  if (recommended) return '参加者のおすすめで、全員が注文を選べます。';
  if (position === 0 && candidate.score > 0) return '全員の希望を合わせたときに、最も相性がよい候補です。';
  if (position === 1 && poolSize > 3 && candidate.personScores?.some(score => score !== null && score > 0)) {
    return '一人ひとりの希望にできるだけ近づくように選んだ候補です。';
  }
  const center = areas[config.areaId].center;
  const metres = Math.round(distanceMeters(candidate.shop.coordinates, center) / 10) * 10;
  return metres === 0 ? '集合エリアの中心付近で、全員が注文を選べます。' : `集合エリアの中心から直線で約${metres}m。全員が注文を選べます。`;
}

export function shopShortlist(
  config: DiscoveryConfig, answers: DiscoveryAnswer[], suggestions: ShopSuggestion[], shops: readonly DiscoveryShop[] = discoveryShops,
): ShopCandidate[] {
  if (answers.length === 0 || answers.length !== config.partySize || !Object.hasOwn(areas, config.areaId) || !modes.includes(config.mode)) return [];
  const ranked = rankShops(config, answers, shops);
  const selected = selectDiscoveryShortlist(ranked);
  const recommended = new Set<string>();
  for (const suggestion of suggestions) {
    if (suggestion.areaId && suggestion.areaId !== config.areaId) continue;
    const name = matchName(suggestion.text);
    if (!name || /^https?:\/\//i.test(name)) continue;
    const matches = shops.filter(shop => (!suggestion.areaId || shop.areaId === suggestion.areaId) && matchName(shop.name) === name);
    if (matches.length === 1 && matches[0].areaId === config.areaId) recommended.add(matches[0].id);
  }
  // Preserve the consensus and compromise options. One eligible nomination can take the variety slot.
  if (selected.length === 3 && !selected.some(candidate => recommended.has(candidate.shop.id))) {
    const nomination = ranked.find(candidate => recommended.has(candidate.shop.id));
    if (nomination) selected[2] = nomination;
  }
  return selected.map((candidate, position) => {
    const { shop } = candidate;
    const nominated = recommended.has(shop.id);
    return { shopId: shop.id, shop, recommended: nominated, groupReason: candidateReason(candidate, position, ranked.length, config, nominated) };
  });
}
