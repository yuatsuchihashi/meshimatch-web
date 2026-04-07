import { HOTPEPPER_BASE_URL } from "./constants";
import type {
  HotPepperSearchParams,
  HotPepperResponse,
  HotPepperShop,
} from "./types";

const API_KEY = process.env.HOTPEPPER_API_KEY;

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>
): string {
  const url = new URL(`${HOTPEPPER_BASE_URL}/${endpoint}`);
  url.searchParams.set("key", API_KEY!);
  url.searchParams.set("format", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function searchRestaurants(
  params: HotPepperSearchParams
): Promise<{ shops: HotPepperShop[]; total: number }> {
  if (!API_KEY) {
    throw new Error("HOTPEPPER_API_KEY is not set");
  }

  const url = buildUrl("gourmet/v1/", {
    keyword: params.keyword,
    large_area: params.large_area,
    middle_area: params.middle_area,
    small_area: params.small_area,
    lat: params.lat,
    lng: params.lng,
    range: params.range,
    genre: params.genre,
    budget: params.budget,
    count: params.count ?? 30,
    start: params.start ?? 1,
    order: params.order,
    private_room: params.private_room,
    free_drink: params.free_drink,
    free_food: params.free_food,
    lunch: params.lunch,
    midnight: params.midnight,
  });

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Hot Pepper API error: ${res.status}`);
  }

  const data: HotPepperResponse = await res.json();

  if (data.results.error) {
    throw new Error(
      `Hot Pepper API error: ${data.results.error.map((e) => e.message).join(", ")}`
    );
  }

  return {
    shops: data.results.shop ?? [],
    total: data.results.results_available,
  };
}

export async function fetchGenres(): Promise<
  { code: string; name: string }[]
> {
  if (!API_KEY) throw new Error("HOTPEPPER_API_KEY is not set");

  const url = buildUrl("genre/v1/", {});
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Genre API error: ${res.status}`);

  const data = await res.json();
  return data.results.genre ?? [];
}

export async function fetchLargeAreas(): Promise<
  { code: string; name: string }[]
> {
  if (!API_KEY) throw new Error("HOTPEPPER_API_KEY is not set");

  const url = buildUrl("large_area/v1/", {});
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Area API error: ${res.status}`);

  const data = await res.json();
  return data.results.large_area ?? [];
}

export async function fetchMiddleAreas(
  largeAreaCode: string
): Promise<{ code: string; name: string }[]> {
  if (!API_KEY) throw new Error("HOTPEPPER_API_KEY is not set");

  const url = buildUrl("middle_area/v1/", { large_area: largeAreaCode });
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Area API error: ${res.status}`);

  const data = await res.json();
  return data.results.middle_area ?? [];
}

export async function fetchSmallAreas(
  middleAreaCode: string
): Promise<{ code: string; name: string }[]> {
  if (!API_KEY) throw new Error("HOTPEPPER_API_KEY is not set");

  const url = buildUrl("small_area/v1/", { middle_area: middleAreaCode });
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Area API error: ${res.status}`);

  const data = await res.json();
  return data.results.small_area ?? [];
}
