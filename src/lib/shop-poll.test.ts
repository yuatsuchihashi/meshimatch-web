import { describe, expect, it } from 'vitest';
import { areas, discoveryShops, rankShops, type DiscoveryConfig, type DiscoveryShop } from './instant/discovery';
import { meetingAreas } from './meeting-areas';
import { parseShopAnswer, shopShortlist } from './shop-poll';

const config: DiscoveryConfig = { areaId: 'shinjuku', radius: 2000, mode: '食事', partySize: 2 };
const cafe = { ...config, mode: 'カフェ・軽食' };
const neutral = parseShopAnswer({}, config);
const pair = [neutral, neutral];
const baseShop = discoveryShops[0];
const [fish, plant] = baseShop.menus;
function fixture(id: string, menus: DiscoveryShop['menus'] = [plant]): DiscoveryShop {
  return { ...baseShop, id, name: id + '（サンプル）', coordinates: areas.shinjuku.center, menus };
}

describe('shared shop survey', () => {
  it('keeps an optional answer neutral in its own survey mode', () => {
    expect(neutral.restaurant?.genres).toEqual([]);
    expect(neutral.cafe).toBeUndefined();
    expect(parseShopAnswer({}, cafe).cafe?.plan).toBe('onsite');
  });

  it('round trips meal and cafe choices with a canonical budget and unique choices', () => {
    const answer = parseShopAnswer({ budget: '01300', diet: ['vegan', 'vegan'], heat: '0',
      restaurant: { genres: ['italian', 'pasta'], important: ['noise', 'pasta'], noisePreferences: ['quiet'] } }, config);
    expect(answer).toMatchObject({ budget: '1300', diet: ['vegan'], heat: '0',
      restaurant: { genres: ['italian', 'pasta'], noisePreferences: ['quiet'] } });
    const original = parseShopAnswer({ cafe: { foodDecision: 'selected', interests: ['dessert'], details: { dessert: ['cake'] },
      important: ['rating'], undecided: [], plan: 'onsite' } }, cafe);
    expect(parseShopAnswer(original, cafe)).toEqual(original);
    expect(parseShopAnswer({ budget: '1.5e3' }, cafe).budget).toBe('1500');
  });

  it.each([
    [{ diet: ['unverified'] }, config], [{ diet: 'vegan' }, config], [{ budget: '0' }, config],
    [{ budget: '100.5' }, config], [{ heat: '4' }, config], [{ heat: '1' }, cafe],
    [{ cafe: {} }, config], [{ restaurant: {} }, cafe], [{ cafe: { plan: 'small' } }, cafe],
    [{ restaurant: { important: ['constructor'] } }, config], [{ cafe: { details: { dessert: ['ramen'] } } }, cafe],
  ] as const)('refuses invalid input %o', (input, cfg) => {
    expect(() => parseShopAnswer(input, cfg)).toThrow();
  });

  it('waits for all attending respondents and keeps score and personal orders private', () => {
    expect(shopShortlist(config, [], [])).toEqual([]);
    expect(shopShortlist(config, [neutral], [])).toEqual([]);
    const picks = shopShortlist(config, pair, []);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map(pick => pick.shopId)).size).toBe(3);
    expect(Object.keys(picks[0]).sort()).toEqual(['groupReason', 'recommended', 'shop', 'shopId']);
    expect(picks.every(pick => pick.shop.areaId === 'shinjuku')).toBe(true);
  });

  it('requires one affordable sufficiently mild verified dish per person, including nominated shops', () => {
    const answer = parseShopAnswer({ budget: '1300', heat: '0', diet: ['vegan'] }, config);
    const shops = [
      fixture('A', [fish, { ...plant, heat: 1 }, { ...plant, price: 1301 }]),
      fixture('B', [{ ...plant, dietary: { ...plant.dietary, vegan: null } }]),
      fixture('C', [{ ...plant, evidence: { ...plant.evidence, status: 'unknown' } }]),
      fixture('D'),
    ];
    const recommendations = shops.map(shop => ({ areaId: 'shinjuku', text: shop.name }));
    expect(shopShortlist(config, [answer, neutral], recommendations, shops).map(pick => pick.shopId)).toEqual(['D']);
    expect(shopShortlist(config, [answer, neutral], recommendations, shops.slice(0, 3))).toEqual([]);
  });

  it('validates a cafe order including the drink, dessert and seat charge', () => {
    const menus = [
      { ...plant, name: '珈琲', kind: 'drink', portion: null, price: 400 },
      { ...plant, name: 'ケーキ', kind: 'dessert', portion: 'light', price: 350 },
    ];
    const shop = { ...fixture('喫茶', menus), acceptsDrinkOnly: true, drinkRequired: true, seatCharge: 100 };
    const answer = parseShopAnswer({ budget: '849', cafe: { plan: 'drink-dessert' } }, cafe);
    const other = parseShopAnswer({}, cafe);
    expect(shopShortlist(cafe, [answer, other], [], [shop])).toEqual([]);
    expect(shopShortlist(cafe, [{ ...answer, budget: '850' }, other], [], [shop])).toHaveLength(1);
  });

  it('reserves a slot for an eligible exact nomination without displacing the first two recommendations', () => {
    const shops = ['A', 'B', 'C', 'D', 'E'].map(id => fixture(id));
    const baseline = shopShortlist(config, pair, [], shops);
    const outside = shops.find(shop => !baseline.some(c => c.shopId === shop.id))!;
    const nominees = [{ areaId: config.areaId, text: outside.id.toLowerCase() }];
    const result = shopShortlist(config, pair, nominees, shops);
    expect(result.slice(0, 2)).toEqual(baseline.slice(0, 2));
    expect(result[2]).toMatchObject({ recommended: true, shopId: outside.id });
    expect(shopShortlist(config, pair, [{ areaId: 'ueno', text: outside.name }], shops)).toEqual(baseline);
    expect(shopShortlist(config, pair, [{ areaId: '', text: 'https://example.org/' + outside.id }], shops)).toEqual(baseline);
  });

  it('does not resolve ambiguous branch names even if only one of the branches passes the hard conditions', () => {
    const shops = [fixture('A'), { ...fixture('B', []), name: 'A' }];
    expect(rankShops(config, pair, shops)).toHaveLength(1);
    const result = shopShortlist(config, pair, [{ areaId: config.areaId, text: 'A' }], shops);
    expect(result[0].recommended).toBe(false);
  });

  it('supports a neutral group in every selectable area, including smaller neighborhoods', () => {
    for (const { discoveryAreaId } of meetingAreas) {
      for (const mode of ['食事', 'カフェ・軽食']) {
        const local = { ...config, mode, areaId: discoveryAreaId, radius: 1000 };
        const a = parseShopAnswer({}, local);
        const shortlist = shopShortlist(local, [a, a], []);
        expect(shortlist.length, discoveryAreaId + mode).toBeGreaterThan(0);
        expect(shortlist.every(c => c.shop.areaId === discoveryAreaId)).toBe(true);
      }
    }
  });

  it('shows distinct meal and café candidates and uses the selected city currency', () => {
    const ar = { ...config, areaId: 'buenosaires' };
    const arCafe = { ...ar, mode: cafe.mode };
    const meal = shopShortlist(ar, pair, []);
    const c = parseShopAnswer({}, arCafe);
    const cafes = shopShortlist(arCafe, [c, c], []);
    expect(meal).toHaveLength(3);
    expect(cafes.length).toBeGreaterThan(0);
    expect(cafes.every(item => item.shop.currency === 'ARS' && item.shop.acceptsDrinkOnly)).toBe(true);
    expect(meal.map(pick => pick.shopId)).not.toEqual(cafes.map(pick => pick.shopId));
  });
});
