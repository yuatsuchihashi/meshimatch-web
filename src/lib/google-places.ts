// ============================================================
// Google Places data layer (R6a)
// ============================================================
// Compliance boundary:
// - long-term tables may keep only place_id plus MeshiMatch-owned catalog/provenance fields
// - Google detail payloads are cache-only and must carry expires_at
// - live API calls are disabled unless an explicit runtime flag is present
// ============================================================

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const LIVE_FLAG = process.env.GOOGLE_PLACES_LIVE === "1";

export const DEFAULT_PLACES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type GooglePlacePriceLevel =
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE"
  | null;

export interface GooglePlacePhotoRef {
  name: string;
  widthPx?: number | null;
  heightPx?: number | null;
}

export interface GooglePlaceReview {
  rating: number | null;
  text: string;
  time: string | null;
}

export interface GooglePlaceOpeningHours {
  weekdayDescriptions: string[];
  openNow?: boolean | null;
}

export interface GooglePlaceLocation {
  latitude: number;
  longitude: number;
}

export interface GooglePlaceDetails {
  placeId: string;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: GooglePlacePriceLevel;
  photos: GooglePlacePhotoRef[];
  reviews: GooglePlaceReview[];
  openingHours: GooglePlaceOpeningHours | null;
  displayName: string | null;
  formattedAddress: string | null;
  location: GooglePlaceLocation | null;
  businessStatus?: string | null;
}

export interface PlacesSearchOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  maxResultCount?: number;
  languageCode?: string;
  live?: boolean;
}

export interface PlacesDetailsOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  languageCode?: string;
  live?: boolean;
}

export interface PlacesCacheEntry {
  placeId: string;
  rawDetails: unknown;
  fetchedAt: string;
  expiresAt: string;
}

export interface PlacesCacheStore {
  get(placeId: string): Promise<PlacesCacheEntry | null>;
  upsert(entry: PlacesCacheEntry): Promise<void>;
}

export interface PersistablePlaceIdentity {
  place_id: string;
  external_id: `place:${string}`;
}

export interface PlacesEnrichment {
  placeId: string;
  closed: boolean;
  rating: number | null;
  photoUrl: string | null;
}

function liveAllowed(optionsLive?: boolean): boolean {
  return (optionsLive ?? LIVE_FLAG) === true;
}

function requireLiveApi(options: { apiKey?: string; live?: boolean }) {
  const apiKey = options.apiKey ?? API_KEY;
  if (!liveAllowed(options.live) || !apiKey) {
    throw new Error(
      "Google Places live calls are disabled. Set GOOGLE_PLACES_LIVE=1 and GOOGLE_PLACES_API_KEY only after budget approval."
    );
  }
  return apiKey;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readTextObject(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return asString((value as { text?: unknown }).text);
}

function normalizePriceLevel(value: unknown): GooglePlacePriceLevel {
  if (typeof value !== "string") return null;
  if (
    value === "PRICE_LEVEL_FREE" ||
    value === "PRICE_LEVEL_INEXPENSIVE" ||
    value === "PRICE_LEVEL_MODERATE" ||
    value === "PRICE_LEVEL_EXPENSIVE" ||
    value === "PRICE_LEVEL_VERY_EXPENSIVE"
  ) {
    return value;
  }
  return null;
}

export function placesEnabled(): boolean {
  return Boolean(API_KEY && LIVE_FLAG);
}

export function toPersistablePlaceIdentity(placeId: string): PersistablePlaceIdentity {
  return {
    place_id: placeId,
    external_id: `place:${placeId}`,
  };
}

export function mapGooglePlaceDetails(raw: unknown): GooglePlaceDetails {
  const place = (raw ?? {}) as {
    id?: unknown;
    name?: unknown;
    rating?: unknown;
    userRatingCount?: unknown;
    priceLevel?: unknown;
    photos?: unknown;
    reviews?: unknown;
    regularOpeningHours?: unknown;
    currentOpeningHours?: unknown;
    displayName?: unknown;
    formattedAddress?: unknown;
    location?: unknown;
    businessStatus?: unknown;
  };

  const location = (place.location ?? null) as {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
  const latitude = asNumber(location?.latitude);
  const longitude = asNumber(location?.longitude);

  const openingHours = (place.regularOpeningHours ??
    place.currentOpeningHours ??
    null) as {
    weekdayDescriptions?: unknown;
    openNow?: unknown;
  } | null;
  const weekdayDescriptions = Array.isArray(openingHours?.weekdayDescriptions)
    ? openingHours.weekdayDescriptions.filter(
        (value): value is string => typeof value === "string"
      )
    : [];

  const photos: GooglePlacePhotoRef[] = Array.isArray(place.photos)
    ? place.photos
        .map((photo): GooglePlacePhotoRef | null => {
          const row = photo as { name?: unknown; widthPx?: unknown; heightPx?: unknown };
          const name = asString(row.name);
          if (!name) return null;
          return {
            name,
            widthPx: asNumber(row.widthPx),
            heightPx: asNumber(row.heightPx),
          };
        })
        .filter((photo): photo is GooglePlacePhotoRef => photo !== null)
    : [];

  const reviews = Array.isArray(place.reviews)
    ? place.reviews
        .slice(0, 5)
        .map((review) => {
          const row = review as {
            rating?: unknown;
            text?: unknown;
            originalText?: unknown;
            publishTime?: unknown;
            time?: unknown;
          };
          return {
            rating: asNumber(row.rating),
            text: readTextObject(row.text) ?? readTextObject(row.originalText) ?? "",
            time: asString(row.publishTime) ?? asString(row.time),
          };
        })
    : [];

  return {
    placeId: asString(place.id) ?? asString(place.name)?.replace(/^places\//, "") ?? "",
    rating: asNumber(place.rating),
    userRatingCount: asNumber(place.userRatingCount),
    priceLevel: normalizePriceLevel(place.priceLevel),
    photos,
    reviews,
    openingHours:
      openingHours || weekdayDescriptions.length > 0
        ? {
            weekdayDescriptions,
            openNow:
              typeof openingHours?.openNow === "boolean" ? openingHours.openNow : null,
          }
        : null,
    displayName: readTextObject(place.displayName),
    formattedAddress: asString(place.formattedAddress),
    location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    businessStatus: asString(place.businessStatus),
  };
}

export async function searchArea(
  textQuery: string,
  options: PlacesSearchOptions = {}
): Promise<string[]> {
  const apiKey = requireLiveApi(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      textQuery,
      includedType: "restaurant",
      languageCode: options.languageCode ?? "ja",
      maxResultCount: options.maxResultCount ?? 20,
    }),
  });
  if (!res.ok) throw new Error(`Google Places search failed: ${res.status}`);
  const json = (await res.json()) as { places?: { id?: string }[] };
  return (json.places ?? []).map((place) => place.id).filter((id): id is string => Boolean(id));
}

export async function fetchDetails(
  placeId: string,
  options: PlacesDetailsOptions = {}
): Promise<GooglePlaceDetails> {
  const apiKey = requireLiveApi(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const fieldMask = [
    "id",
    "rating",
    "userRatingCount",
    "priceLevel",
    "photos",
    "reviews",
    "regularOpeningHours",
    "displayName",
    "formattedAddress",
    "location",
    "businessStatus",
  ].join(",");
  const res = await fetchImpl(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        "Accept-Language": options.languageCode ?? "ja",
      },
    }
  );
  if (!res.ok) throw new Error(`Google Places details failed: ${res.status}`);
  return mapGooglePlaceDetails(await res.json());
}

export async function fetchDetailsWithCache(params: {
  placeId: string;
  cache: PlacesCacheStore;
  now?: Date;
  ttlMs?: number;
  fetcher?: (placeId: string) => Promise<unknown>;
}): Promise<GooglePlaceDetails> {
  const now = params.now ?? new Date();
  const cached = await params.cache.get(params.placeId);
  if (cached && new Date(cached.expiresAt).getTime() > now.getTime()) {
    return mapGooglePlaceDetails(cached.rawDetails);
  }

  const rawDetails = params.fetcher
    ? await params.fetcher(params.placeId)
    : await fetchDetails(params.placeId);
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + (params.ttlMs ?? DEFAULT_PLACES_CACHE_TTL_MS)
  ).toISOString();
  await params.cache.upsert({
    placeId: params.placeId,
    rawDetails,
    fetchedAt,
    expiresAt,
  });
  return mapGooglePlaceDetails(rawDetails);
}

export async function lookupPlace(params: {
  name: string;
  lat: number;
  lng: number;
  radius?: number;
}): Promise<PlacesEnrichment | null> {
  if (!placesEnabled()) return null;

  try {
    const ids = await searchArea(params.name, { maxResultCount: 1 });
    const placeId = ids[0];
    if (!placeId) return null;
    const details = await fetchDetails(placeId);
    return {
      placeId,
      closed: details.businessStatus === "CLOSED_PERMANENTLY",
      rating: details.rating,
      // R6a stores photo refs only. Existing callers may keep this nullable.
      photoUrl: null,
    };
  } catch {
    return null;
  }
}
