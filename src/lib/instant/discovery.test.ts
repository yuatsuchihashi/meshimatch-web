import { describe, expect, it } from 'vitest';
import {
  areas, availableGenres, discoveryShops, firstGenres, freshAnswer, menusFor,
  nearbyShops, rankShops, resolveDiscoveryAgreement, scoreMenu,
  type DiscoveryConfig, type DiscoveryShop,
} from './discovery';
import { newDiscoverySession, parseDiscoverySession } from './discovery-session';

const config: DiscoveryConfig = { areaId: 'shinjuku', radius: 2000, mode: '食事', partySize: 2 };

describe('menu-aware instant discovery', () => {
  it('uses the selected area and radius and exposes every available genre', () => {
    expect(nearbyShops({ ...config, radius: 500 }).length).toBeLessThan(nearbyShops(config).length);
    expect(nearbyShops({ ...config, areaId: 'buenosaires' }).every(shop => shop.currency === 'ARS')).toBe(true);
    const all = availableGenres(config, freshAnswer());
    expect(all.length).toBeGreaterThan(6);
    expect(firstGenres(all)).toHaveLength(6);
    expect(new Set(firstGenres(all).map(genre => genre.family)).size).toBeGreaterThan(3);
  });

  it('requires a single dish to meet all dietary, price and heat conditions', () => {
    const shop = discoveryShops[0];
    const [fish, plant] = shop.menus;
    const answer = { ...freshAnswer(), diet: ['vegan', 'glutenFree'], heat: '0', budget: '1500' };
    expect(menusFor(config, shop, answer).map(menu => menu.name)).toEqual([plant.name]);
    const split: DiscoveryShop = { ...shop, menus: [fish, { ...plant, dietary: { ...plant.dietary, glutenFree: false } }] };
    expect(menusFor(config, split, answer)).toEqual([]);
    const unknown = { ...plant, evidence: { ...plant.evidence, status: 'unknown' } };
    expect(menusFor(config, { ...shop, menus: [unknown] }, answer)).toEqual([]);
    expect(menusFor(config, { ...shop, menus: [{ ...plant, heat: null }] }, answer)).toEqual([]);
  });

  it('evaluates the price of the preferred dish without borrowing a cheap unrelated menu', () => {
    const shop = discoveryShops[0];
    const sushi = { ...shop.menus[0], price: 2000 };
    const other = { ...sushi, genreId: 'pizza', price: 100 };
    const answer = { ...freshAnswer(), genres: ['sushi'], priorities: ['price'] };
    const expensive = Math.max(...[sushi, other].map(menu => scoreMenu(config, shop, menu, answer)!));
    const affordable = scoreMenu(config, shop, { ...sushi, price: 1000 }, answer)!;
    expect(expensive).toBeLessThan(affordable);
  });

  it('supports main, café and mixed needs with individual feasible dishes', () => {
    const cafe = discoveryShops.find(shop => shop.acceptsDrinkOnly)!;
    const mixed = { ...config, mode: 'どちらでも' };
    expect(menusFor(mixed, cafe, { ...freshAnswer(), need: 'drink' }).every(menu => menu.kind === 'drink')).toBe(true);
    expect(menusFor(config, cafe, freshAnswer()).every(menu => menu.portion === 'main')).toBe(true);
    expect(rankShops(mixed, [{ ...freshAnswer(), need: 'drink' }, { ...freshAnswer(), need: 'main' }]).every(candidate => candidate.shop.acceptsDrinkOnly)).toBe(true);
    expect(rankShops(config, [])).toEqual([]);
  });

  it('requires every vote and unanimous approval, using ranked order for ties', () => {
    expect(resolveDiscoveryAgreement(['A', 'B'], [['A'], ['B']], 2)).toBeNull();
    expect(resolveDiscoveryAgreement(['A', 'B'], [['A']], 2)).toBeNull();
    expect(resolveDiscoveryAgreement(['A', 'B'], [['A'], []], 2)).toBeNull();
    expect(resolveDiscoveryAgreement(['A', 'B'], [['B', 'A'], ['A', 'B']], 2)).toBe('A');
  });

  it('restores versioned native sessions and rejects invalid or legacy data', () => {
    const session = newDiscoverySession(config);
    expect(parseDiscoverySession(JSON.stringify(session))).toEqual(session);
    for (const raw of [null, '', '{', '{}', JSON.stringify({ ...session, version: 2 }), JSON.stringify({ ...session, config: { ...config, areaId: '__proto__' } }), JSON.stringify({ ...session, answers: [{}] })]) {
      expect(parseDiscoverySession(raw)).toBeNull();
    }
  });

  it('keeps every hard condition and spice monotonicity across 1600 deterministic groups', () => {
    let seed = 7361;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let index = 0; index < 1600; index++) {
      const current = { ...config, areaId: index % 2 ? 'shinjuku' : 'buenosaires', radius: [500, 1000, 2000][index % 3], mode: ['食事', 'カフェ・軽食', 'どちらでも'][index % 3] };
      const answers = Array.from({ length: 2 + index % 7 }, () => ({ ...freshAnswer(),
        need: ['main', 'cafe', 'drink', 'any'][Math.floor(random() * 4)],
        diet: random() > .5 ? ['vegan'] : [], heat: String(Math.floor(random() * 4)),
        budget: random() > .5 ? String(areas[current.areaId].priceAnchor) : '', priorities: ['price'],
      }));
      for (const candidate of rankShops(current, answers)) {
        candidate.choices.forEach((menus, person) => {
          expect(menus.length).toBeGreaterThan(0);
          for (const menu of menus) {
            const answer = answers[person];
            expect(menu.heat!).toBeLessThanOrEqual(Number(answer.heat));
            if (answer.budget) expect(menu.price).toBeLessThanOrEqual(Number(answer.budget));
            expect(answer.diet.every(key => menu.dietary[key] === true)).toBe(true);
          }
        });
      }
      const shop = nearbyShops(current)[0];
      expect(menusFor(current, shop, { ...answers[0], heat: '0' }).length).toBeLessThanOrEqual(menusFor(current, shop, { ...answers[0], heat: '3' }).length);
    }
  });
});

describe('café uncertainty and order budgets', () => {
  const cafeConfig = { ...config, mode: 'カフェ・軽食' };
  const cafe = discoveryShops.find(shop => shop.id === 's12')!;

  it('checks a drink and cake against the combined budget including any seat charge', async () => {
    const { cafeOrdersFor, freshCafePreferences } = await import('./discovery');
    const answer = { ...freshAnswer(), budget: '1000', cafe: { ...freshCafePreferences(), plan: 'drink-dessert' } };
    expect(cafeOrdersFor(cafeConfig, cafe, answer)).toEqual([]);
    const orders = cafeOrdersFor(cafeConfig, cafe, { ...answer, budget: '1500' });
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every(order => order.total <= 1500 && order.menus.length === 2)).toBe(true);
    expect(cafeOrdersFor(cafeConfig, { ...cafe, seatCharge: 1000 }, { ...answer, budget: '1500' })).toEqual([]);
  });

  it('keeps a café without cake eligible for a tentative cake preference', async () => {
    const { freshCafePreferences } = await import('./discovery');
    const answer = { ...freshAnswer(), cafe: { ...freshCafePreferences(), interests: ['dessert'], details: { dessert: ['cake'] } } };
    const candidates = rankShops(cafeConfig, [answer, { ...freshAnswer(), cafe: freshCafePreferences() }]);
    expect(candidates.some(candidate => candidate.shop.menus.every(menu => menu.category !== 'cake'))).toBe(true);
  });

  it('retains weaker influence for a nice-to-have after normalizing within one person', async () => {
    const { freshCafePreferences, scoreCafeOrder, cafeOrdersFor } = await import('./discovery');
    const preferences = { ...freshCafePreferences(), interests: ['dessert'], details: { dessert: ['cake'] } };
    const weak = { ...freshAnswer(), cafe: preferences };
    const strong = { ...weak, cafe: { ...preferences, important: ['dessert'] } };
    const order = cafeOrdersFor(cafeConfig, cafe, weak).find(order => order.menus.some(menu => menu.category === 'cake'))!;
    expect(scoreCafeOrder(cafeConfig, cafe, order, weak)).toBeLessThan(scoreCafeOrder(cafeConfig, cafe, order, strong)!);
  });

  it('lets a sufficiently better reputation compensate for a tentative cake preference', async () => {
    const { freshCafePreferences } = await import('./discovery');
    const answer = { ...freshAnswer(), cafe: { ...freshCafePreferences(), interests: ['dessert', 'rating'],
      details: { dessert: ['cake'] }, important: ['rating'] } };
    const withoutCake = { ...cafe, id: 'without', rating: 4.9, reviewCount: 500,
      menus: cafe.menus.filter(menu => menu.kind === 'drink') };
    const withCake = { ...cafe, id: 'with', rating: 4.1, reviewCount: 500 };
    expect(rankShops(cafeConfig, [answer], [withCake, withoutCake])[0].shop.id).toBe('without');
  });

  it('does not invent a direction for an undecided atmosphere preference', async () => {
    const { freshCafePreferences, cafeOrdersFor, scoreCafeOrder } = await import('./discovery');
    const answer = { ...freshAnswer(), cafe: { ...freshCafePreferences(), interests: ['atmosphere'], undecided: ['atmosphere'] } };
    const order = cafeOrdersFor(cafeConfig, cafe, answer)[0];
    expect(scoreCafeOrder(cafeConfig, cafe, order, answer)).toBeNull();
  });

  it('offers a compromise outside the three highest group averages and avoids already seen stores', async () => {
    const { selectDiscoveryShortlist } = await import('./discovery');
    const source = [
      { shop: { ...cafe, id: 'a' }, choices: [], score: .67, personScores: [1, 1, 0] },
      { shop: { ...cafe, id: 'b' }, choices: [], score: .66, personScores: [1, .98, 0] },
      { shop: { ...cafe, id: 'c' }, choices: [], score: .65, personScores: [.99, .96, 0] },
      { shop: { ...cafe, id: 'd' }, choices: [], score: .6, personScores: [.6, .6, .6] },
    ];
    expect(selectDiscoveryShortlist(source).some(candidate => candidate.shop.id === 'd')).toBe(true);
    expect(selectDiscoveryShortlist(source, ['a', 'b', 'c']).map(candidate => candidate.shop.id)).toEqual(['d']);
  });

  it('restores more-information feedback without treating it as approval', async () => {
    const { freshCafePreferences } = await import('./discovery');
    const { discoverySessionShortlist } = await import('./discovery-session');
    const session = newDiscoverySession(cafeConfig);
    session.answers = [0, 1].map(() => ({ ...freshAnswer(), cafe: freshCafePreferences() }));
    const ids = discoverySessionShortlist(session, rankShops(cafeConfig, session.answers)).map(candidate => candidate.shop.id);
    session.feedback = [ids.map(shopId => ({ shopId, status: 'more' })), ids.map(shopId => ({ shopId, status: 'yes' }))];
    session.votes = [[], ids];
    session.ballotPhase = 'result';
    expect(parseDiscoverySession(JSON.stringify(session))).toEqual(session);
    expect(resolveDiscoveryAgreement(ids, session.votes, 2)).toBeNull();
  });
});

describe('restaurant taxonomy and wishes', () => {
  it('keeps Italian, pizza and pasta as separate choices', async () => {
    const { restaurantGenres, restaurantGenreLabels, freshRestaurantPreferences, scoreRestaurantMenu } = await import('./discovery');
    const italian = restaurantGenres.find(genre => genre.id === 'italian')!;
    expect(italian.types).toEqual(['italian_restaurant']);
    expect(italian.dishIds).toEqual(['pizza', 'pasta']);
    expect(restaurantGenres.some(genre => genre.id === 'pizza')).toBe(true);
    expect(restaurantGenres.find(genre => genre.id === 'pasta')?.matchSource).toBe('menu');
    const shop = discoveryShops.find(shop => shop.id === 's06')!;
    expect(restaurantGenreLabels(shop)).toEqual(['イタリアン', 'ピザ', 'パスタ']);
    const pizza = shop.menus.find(menu => menu.genreId === 'pizza')!;
    const pasta = shop.menus.find(menu => menu.genreId === 'pasta')!;
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), genres: ['italian'] } };
    expect(scoreRestaurantMenu(config, shop, pizza, answer)).toBe(scoreRestaurantMenu(config, shop, pasta, answer));
    const specific = { ...answer, restaurant: { ...answer.restaurant, genres: ['pizza'] } };
    expect(scoreRestaurantMenu(config, shop, pizza, specific)).toBeGreaterThan(scoreRestaurantMenu(config, shop, pasta, specific)!);
    expect(rankShops(config, [specific], [{ ...shop, menus: [pasta] }])).toHaveLength(1);
  });

  it('uses the stored Google place types in matching, alongside the eligible menu', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu } = await import('./discovery');
    const shop = discoveryShops.find(shop => shop.id === 's06')!;
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), genres: ['italian'] } };
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], answer)).toBeGreaterThan(0);
    expect(scoreRestaurantMenu(config, { ...shop, types: ['chinese_restaurant'] }, shop.menus[0], answer)).toBe(0);
  });

  it('treats selected restaurant genres as alternatives and keeps strengths distinct', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu } = await import('./discovery');
    const shop = discoveryShops.find(shop => shop.id === 's06')!;
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), genres: ['italian', 'sushi'] } };
    const single = { ...answer, restaurant: { ...answer.restaurant, genres: ['italian'] } };
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], answer)).toBe(scoreRestaurantMenu(config, shop, shop.menus[0], single));
    const strong = { ...single, restaurant: { ...single.restaurant, important: ['italian'] } };
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], strong)).toBeGreaterThan(scoreRestaurantMenu(config, shop, shop.menus[0], single)!);
  });

  it('restores restaurant sessions using the same adaptive shortlist that received the votes', async () => {
    const { freshRestaurantPreferences } = await import('./discovery');
    const { discoverySessionShortlist } = await import('./discovery-session');
    const session = newDiscoverySession(config);
    session.answers = [0, 1].map(() => ({ ...freshAnswer(), restaurant: freshRestaurantPreferences() }));
    const ids = discoverySessionShortlist(session, rankShops(config, session.answers)).map(candidate => candidate.shop.id);
    session.votes = [[ids[0]], [ids[0]]]; session.ballotPhase = 'result'; session.winnerId = ids[0];
    expect(parseDiscoverySession(JSON.stringify(session))).toEqual(session);
    expect(parseDiscoverySession(JSON.stringify({ ...session, answers: [{ ...freshAnswer(), restaurant: {} }] }))).toBeNull();
  });
});

describe('restaurant-specific criteria', () => {
  it('matches Japanese-style pasta without classifying the shop as Italian', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu, restaurantGenreLabels } = await import('./discovery');
    const shop = discoveryShops.find(shop => shop.id === 's19')!;
    const pasta = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), genres: ['pasta'] } };
    const italian = { ...pasta, restaurant: { ...pasta.restaurant, genres: ['italian'] } };
    expect(shop.types).not.toContain('italian_restaurant');
    expect(restaurantGenreLabels(shop)).toEqual(['パスタ']);
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], pasta)).toBeGreaterThan(0);
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], italian)).toBe(0);
  });

  it('does not apply old restaurant aesthetic preferences to new ranking criteria', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu, restaurantVenuePreferenceLabels } = await import('./discovery');
    const shop = discoveryShops[0];
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), important: ['atmosphere'], styles: [shop.style] } };
    expect(restaurantVenuePreferenceLabels).not.toHaveProperty('atmosphere');
    expect(scoreRestaurantMenu(config, shop, shop.menus[0], answer)).toBeNull();
  });

  it('uses review counts in the explicitly provisional review adjustment', async () => {
    const { adjustedReviewRating } = await import('./discovery');
    expect(adjustedReviewRating(4.9, 3)).toBeCloseTo(4.264, 3);
    expect(adjustedReviewRating(4.5, 500)).toBeCloseTo(4.483, 3);
    expect(adjustedReviewRating(4.9, 3)).toBeLessThan(adjustedReviewRating(4.5, 500));
  });
});

describe('restaurant conversation scenarios', () => {
  it.each([
    { conversation: '久しぶりにゆっくり話したい → 静かに落ち着いて食べたい', accepted: ['quiet'], expected: 'quiet' },
    { conversation: '今日はみんなでワイワイ食べたい → にぎやかな店がいい', accepted: ['lively'], expected: 'lively' },
    { conversation: '静かでも多少活気があってもいい → どちらも許容する', accepted: ['quiet', 'moderate'], expected: 'quiet' },
  ])('$conversation', async ({ accepted, expected }) => {
    const { freshRestaurantPreferences } = await import('./discovery');
    const base = discoveryShops[0];
    const shops = ['quiet', 'moderate', 'lively'].map((noise, index) => ({ ...base, id: String(index), noise, estimatedWaitMinutes: 10 }));
    const answers = [
      { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), important: ['noise'], noisePreferences: accepted } },
      { ...freshAnswer(), restaurant: freshRestaurantPreferences() },
    ];
    const ranked = rankShops(config, answers, shops);
    expect(ranked[0].shop.noise).toBe(expected);
    expect(ranked).toHaveLength(3);
    expect(ranked.filter(candidate => accepted.includes(candidate.shop.noise)).every(candidate => candidate.score === 1)).toBe(true);
  });

  it('並ぶなら別のお店にしよう → 入店待ちが短い店を優先する', async () => {
    const { freshRestaurantPreferences } = await import('./discovery');
    const base = discoveryShops[0];
    const shops = [30, 10, 0].map((estimatedWaitMinutes, index) => ({ ...base, id: String(index), estimatedWaitMinutes }));
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), important: ['wait'] } };
    expect(rankShops(config, [answer], shops).map(candidate => candidate.shop.estimatedWaitMinutes)).toEqual([0, 10, 30]);
  });

  it('評判が良ければ少し待ってもいい → 待つ店も候補に残せる', async () => {
    const { freshRestaurantPreferences } = await import('./discovery');
    const base = discoveryShops[0];
    const popular = { ...base, id: 'popular', rating: 4.8, reviewCount: 500, estimatedWaitMinutes: 20 };
    const quick = { ...base, id: 'quick', rating: 4.1, reviewCount: 500, estimatedWaitMinutes: 0 };
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), important: ['rating'] } };
    expect(rankShops(config, [answer], [quick, popular])[0].shop.id).toBe('popular');
  });

  it('おまかせ → にぎやかさの好みを自動では設定しない', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu } = await import('./discovery');
    const base = discoveryShops[0];
    const answer = { ...freshAnswer(), restaurant: freshRestaurantPreferences() };
    expect(scoreRestaurantMenu(config, { ...base, noise: 'quiet' }, base.menus[0], answer)).toBeNull();
    expect(scoreRestaurantMenu(config, { ...base, noise: 'lively' }, base.menus[0], answer)).toBeNull();
    const noDirection = { ...answer, restaurant: { ...answer.restaurant, important: ['noise'] } };
    expect(scoreRestaurantMenu(config, base, base.menus[0], noDirection)).toBeNull();
  });

  it('keeps unknown wait estimates unknown and restores noise preferences', async () => {
    const { freshRestaurantPreferences, scoreRestaurantMenu } = await import('./discovery');
    const base = discoveryShops[0];
    const answer = { ...freshAnswer(), restaurant: { ...freshRestaurantPreferences(), important: ['wait'] } };
    expect(scoreRestaurantMenu(config, { ...base, estimatedWaitMinutes: null }, base.menus[0], answer)).toBeNull();
    const session = newDiscoverySession(config);
    session.answers = [{ ...answer, restaurant: { ...answer.restaurant, noisePreferences: ['quiet', 'moderate'] } }];
    expect(parseDiscoverySession(JSON.stringify(session))).toEqual(session);
  });
});

describe('host purpose selection', () => {
  it('offers two purposes for new sessions and can restore an existing mixed-purpose session', async () => {
    const { modes } = await import('./discovery');
    expect(modes).toEqual(['食事', 'カフェ・軽食']);
    expect(newDiscoverySession({ ...config, mode: 'どちらでも' }).config.mode).toBe('食事');
    const existing = {
      ...newDiscoverySession(config), config: { ...config, mode: 'どちらでも' },
      answers: [{ ...freshAnswer(), need: 'main' }],
    };
    expect(parseDiscoverySession(JSON.stringify(existing))).toEqual(existing);
  });
});
