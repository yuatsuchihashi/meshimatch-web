import { describe, expect, it } from 'vitest';
import { AREA_CENTERS, SURVEY_AREAS } from './areas';
import { meetingAreas, meetingCities } from './meeting-areas';
import { areas, dietLabels, discoveryShops, freshAnswer, freshCafePreferences, nearbyShops, rankShops } from './instant/discovery';

describe('meeting area catalogue and discovery handoff', () => {
  it('uses one consistent discovery ID and groups the original Tokyo survey areas by city', () => {
    expect(Object.keys(meetingCities)).toEqual(['tokyo', 'buenosaires']);
    expect(meetingAreas.filter(area => area.cityId === 'tokyo').map(area => area.label)).toEqual([...SURVEY_AREAS, '丸の内', '蔵前']);
    expect(meetingAreas.filter(area => area.cityId === 'buenosaires')).toHaveLength(5);
    expect(new Set(meetingAreas.map(area => area.id)).size).toBe(meetingAreas.length);
    for (const candidate of meetingAreas) {
      expect(candidate.discoveryAreaId).toBe(candidate.id);
      expect(areas[candidate.discoveryAreaId]).toBeDefined();
    }
  });

  it('keeps the original fixtures intact and uses the existing approximate Tokyo anchors', () => {
    expect(discoveryShops.filter(shop => shop.areaId === 'shinjuku')).toHaveLength(19);
    expect(discoveryShops.filter(shop => shop.areaId === 'buenosaires')).toHaveLength(14);
    expect(discoveryShops[0].id).toBe('s01');
    expect(areas.shinjuku.center).toEqual({ lat: 35.6909, lng: 139.7003 });
    expect(areas.buenosaires.center).toEqual({ lat: -34.6037, lng: -58.3816 });
    for (const candidate of meetingAreas.filter(area => area.cityId === 'tokyo' && area.id !== 'shinjuku')) {
      if (AREA_CENTERS[candidate.label]) expect(areas[candidate.id].center).toEqual(AREA_CENTERS[candidate.label]);
    }
  });

  it('offers restaurant and café choices from every selected area even at the smallest radius', () => {
    for (const area of meetingAreas) {
      for (const mode of ['食事', 'カフェ・軽食']) {
        const config = { areaId: area.id, radius: 500, mode, partySize: 2 };
        const answer = mode === 'カフェ・軽食' ? { ...freshAnswer(), cafe: freshCafePreferences() } : freshAnswer();
        expect(nearbyShops(config).length).toBeGreaterThan(0);
        const candidates = rankShops(config, [answer, answer]);
        expect(candidates.length, `${area.label} ${mode}`).toBeGreaterThanOrEqual(2);
        expect(candidates.every(candidate => candidate.shop.areaId === area.id)).toBe(true);
      }
    }
  });

  it('marks every added venue as a sample and retains complete synthetic menu evidence', () => {
    const additional = discoveryShops.filter(shop => shop.areaId !== 'shinjuku' && shop.areaId !== 'buenosaires');
    expect(additional).toHaveLength(15 * 6);
    expect(new Set(discoveryShops.map(shop => shop.id)).size).toBe(discoveryShops.length);
    const menuIds = discoveryShops.flatMap(shop => shop.menus.map(menu => menu.id));
    expect(new Set(menuIds).size).toBe(menuIds.length);
    for (const shop of additional) {
      expect(shop.name).toContain('サンプル');
      expect(shop.currency).toBe(areas[shop.areaId].currency);
      for (const menu of shop.menus) {
        expect(menu.evidence.source).toBe('synthetic-fixture');
        expect(Object.keys(menu.dietary).sort()).toEqual(Object.keys(dietLabels).sort());
        expect(Object.values(menu.dietary).every(flag => typeof flag === 'boolean')).toBe(true);
        expect(menu.price).toBeGreaterThan(0);
      }
    }
  });
});
