import ebisuFixture from "@/lib/places/__fixtures__/ebisu-restaurants.json";
import labelSeeds from "../../../data/quality/label-seeds.json";

export type LabelingCatalogRestaurant = {
  external_id: string;
  place_id: string;
  name: string;
  area: string;
  price_band: string;
  rating: number | null;
  rating_count: number | null;
  reviews: string[];
  photo_refs: string[];
  lat: number | null;
  lng: number | null;
  resolved_url: string | null;
  short_url: string | null;
  source: "label_seed" | "fixture";
};

type FixturePlace = {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: { name?: string }[];
  reviews?: { text?: { text?: string } }[];
};

type FixtureCatalog = {
  area?: string;
  places?: FixturePlace[];
};

type LabelSeed = {
  short?: string;
  resolved?: string;
  name?: string;
  lat?: number;
  lng?: number;
  ftid?: string;
};

const priceBandLabels: Record<string, string> = {
  PRICE_LEVEL_FREE: "無料",
  PRICE_LEVEL_INEXPENSIVE: "安め",
  PRICE_LEVEL_MODERATE: "普通",
  PRICE_LEVEL_EXPENSIVE: "高め",
  PRICE_LEVEL_VERY_EXPENSIVE: "かなり高め",
};

function shortCode(shortUrl: string | undefined): string {
  if (!shortUrl) return "";
  return shortUrl.split("/").filter(Boolean).at(-1) ?? shortUrl;
}

function toSeedCatalogRestaurant(seed: LabelSeed): LabelingCatalogRestaurant {
  const externalId = seed.ftid?.trim() || shortCode(seed.short);
  return {
    external_id: externalId,
    place_id: externalId,
    name: seed.name?.trim() || externalId,
    area: "創業者seed",
    price_band: "未取得",
    rating: null,
    rating_count: null,
    reviews: [],
    photo_refs: [],
    lat: typeof seed.lat === "number" ? seed.lat : null,
    lng: typeof seed.lng === "number" ? seed.lng : null,
    resolved_url: seed.resolved?.trim() || null,
    short_url: seed.short?.trim() || null,
    source: "label_seed",
  };
}

function toCatalogRestaurant(place: FixturePlace, area: string): LabelingCatalogRestaurant {
  return {
    external_id: place.id,
    place_id: place.id,
    name: place.displayName?.text ?? place.id,
    area,
    price_band: priceBandLabels[place.priceLevel ?? ""] ?? "不明",
    rating: typeof place.rating === "number" ? place.rating : null,
    rating_count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    reviews: (place.reviews ?? [])
      .map((review) => review.text?.text?.trim())
      .filter((text): text is string => Boolean(text))
      .slice(0, 5),
    photo_refs: (place.photos ?? [])
      .map((photo) => photo.name?.trim())
      .filter((name): name is string => Boolean(name)),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    resolved_url: null,
    short_url: null,
    source: "fixture",
  };
}

export function getLabelingCatalogRestaurants(): LabelingCatalogRestaurant[] {
  const seeds = labelSeeds as LabelSeed[];
  if (seeds.length > 0) return seeds.map(toSeedCatalogRestaurant);

  const fixture = ebisuFixture as FixtureCatalog;
  const area = fixture.area ?? "恵比寿";
  return (fixture.places ?? []).map((place) => toCatalogRestaurant(place, area));
}
