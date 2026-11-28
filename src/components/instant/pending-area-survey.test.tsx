import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { availableRestaurantGenres, freshAnswer, surveyCurrency } from '@/lib/instant/discovery';
import { parseShopAnswer, shopShortlist } from '@/lib/shop-poll';
import { CafeSurvey } from './CafeSurvey';
import { RestaurantSurvey } from './RestaurantSurvey';

const pending = { areaId: '', radius: 1000, partySize: 2, mode: '食事' };

describe('taking the shop survey before the meeting area is chosen', () => {
  it.each([
    ['tokyo', ['shibuya', 'ikebukuro'], 'JPY'],
    ['buenosaires', ['palermo', 'recoleta'], 'ARS'],
  ] as const)('offers the genres served across the candidate areas of %s', (cityId, areaIds, currency) => {
    const answer = freshAnswer();
    const firstArea = availableRestaurantGenres({ ...pending, areaId: areaIds[0] }, answer);
    const secondArea = availableRestaurantGenres({ ...pending, areaId: areaIds[1] }, answer);
    const all = availableRestaurantGenres(pending, answer, areaIds);
    expect(firstArea).not.toEqual(secondArea);
    expect(new Set(all)).toEqual(new Set([...firstArea, ...secondArea]));
    expect(all.length).toBe(new Set(all).size);
    expect(availableRestaurantGenres(pending, { ...answer, budget: '1' }, areaIds)).toEqual([]);
    expect(surveyCurrency(pending, cityId)).toBe(currency);
    for (const areaId of areaIds) expect(surveyCurrency({ ...pending, areaId })).toBe(currency);
  });

  it('keeps a saved genre editable when the final area or budget has no compatible menu', () => {
    const config = { ...pending, areaId: 'shibuya' };
    const draft = parseShopAnswer({ restaurant: { genres: ['sushi'] }, budget: '1' }, config);
    const html = renderToStaticMarkup(<RestaurantSurvey config={config} draft={draft} lastPerson
      onChange={() => {}} onSubmit={() => {}} />);
    expect(html).toMatch(/選択済みの希望[^<]*<\/legend>.*?aria-pressed="true"[^>]*>寿司<\/button>/);
  });

  it('collects café preferences before deciding the area and applies the same final shortlist', () => {
    const config = { ...pending, mode: 'カフェ・軽食' };
    const pendingArea = { cityId: 'buenosaires' as const, areaIds: ['palermo', 'recoleta'] };
    const input = { cafe: { interests: ['dessert'], important: ['rating'] }, budget: '20000' };
    const early = parseShopAnswer(input, config);
    const html = renderToStaticMarkup(<CafeSurvey config={config} pendingArea={pendingArea} draft={early}
      lastPerson onChange={() => {}} onSubmit={() => {}} />);
    expect(html).toContain('何か食べたいものはある？');
    expect(shopShortlist(config, [early, early], [])).toEqual([]);
    const finalConfig = { ...config, areaId: 'recoleta' };
    const late = parseShopAnswer(input, finalConfig);
    const candidates = shopShortlist(finalConfig, [early, early], []);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(({ shop }) => shop.areaId === 'recoleta')).toBe(true);
    expect(candidates).toEqual(shopShortlist(finalConfig, [late, late], []));
  });
});
