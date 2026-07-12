import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/lib/places/__fixtures__/ebisu-restaurants.json";
import {
  fetchDetailsWithCache,
  mapGooglePlaceDetails,
  placesEnabled,
  searchArea,
  type PlacesCacheEntry,
  type PlacesCacheStore,
} from "@/lib/google-places";

class MemoryPlacesCache implements PlacesCacheStore {
  entries = new Map<string, PlacesCacheEntry>();

  async get(placeId: string) {
    return this.entries.get(placeId) ?? null;
  }

  async upsert(entry: PlacesCacheEntry) {
    this.entries.set(entry.placeId, entry);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Google Places data layer", () => {
  it("maps fixture details into the R6a fetch shape", () => {
    const details = mapGooglePlaceDetails(fixture.places[0]);

    expect(details).toMatchObject({
      placeId: "fixtures/ebisu-test-a",
      rating: 4.2,
      userRatingCount: 128,
      priceLevel: "PRICE_LEVEL_MODERATE",
      displayName: "恵比寿テスト食堂A",
      formattedAddress: "東京都渋谷区恵比寿1丁目（fixture）",
      location: { latitude: 35.6472, longitude: 139.7101 },
    });
    expect(details.photos.map((photo) => photo.name)).toEqual([
      "fixtures/photos/ebisu-test-a-1",
      "fixtures/photos/ebisu-test-a-2",
    ]);
    expect(details.reviews).toHaveLength(2);
    expect(details.reviews[0]).toEqual({
      rating: 4,
      text: "[fixture] 少人数の食事会で使いやすい雰囲気でした。",
      time: "2026-04-01T09:00:00Z",
    });
    expect(details.openingHours?.weekdayDescriptions).toContain("金曜日: 17:00～24:00");
  });

  it("uses cached raw details until TTL expiry, then refetches", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T00:00:00.000Z"));

    const cache = new MemoryPlacesCache();
    const placeId = fixture.places[0].id;
    const fetcher = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(fixture.places[0])
      .mockResolvedValueOnce(fixture.places[1]);

    const first = await fetchDetailsWithCache({
      placeId,
      cache,
      ttlMs: 60_000,
      fetcher,
    });
    const second = await fetchDetailsWithCache({
      placeId,
      cache,
      ttlMs: 60_000,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.displayName).toBe("恵比寿テスト食堂A");
    expect(second.displayName).toBe("恵比寿テスト食堂A");

    vi.setSystemTime(new Date("2026-07-12T00:02:00.000Z"));
    const third = await fetchDetailsWithCache({
      placeId,
      cache,
      ttlMs: 60_000,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(third.displayName).toBe("恵比寿テストビストロB");
  });

  it("does not allow live search without the explicit live flag", async () => {
    expect(placesEnabled()).toBe(false);
    await expect(searchArea("恵比寿 レストラン")).rejects.toThrow(
      "Google Places live calls are disabled"
    );
  });
});
