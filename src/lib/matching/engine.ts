import { MOODS, DIETARY_RESTRICTIONS } from "@/lib/hotpepper/constants";
import type { HotPepperSearchParams, HotPepperShop } from "@/lib/hotpepper/types";
import type { ScoredRestaurant } from "@/types/search";
import type { MoodId } from "@/lib/hotpepper/constants";

type MemberPreferences = {
  user_id: string;
  genres: { genre_code: string; preference: number }[];
  dietary_restrictions: string[];
};

type MatchInput = {
  members: MemberPreferences[];
  mood?: MoodId;
  locationCode?: string;
  locationText?: string;
  timeSlot?: "lunch" | "dinner" | "late_night";
};

export function computeSearchParams(input: MatchInput): {
  searchParams: HotPepperSearchParams;
  excludedGenres: Set<string>;
  boostedGenres: Map<string, number>;
} {
  const excludedGenres = new Set<string>();
  const genreLikeCounts = new Map<string, number>();

  // Aggregate genre preferences across all members
  for (const member of input.members) {
    for (const gp of member.genres) {
      if (gp.preference === -1) {
        excludedGenres.add(gp.genre_code);
      } else if (gp.preference === 1) {
        genreLikeCounts.set(
          gp.genre_code,
          (genreLikeCounts.get(gp.genre_code) ?? 0) + 1
        );
      }
    }
  }

  // Remove any genre from "liked" if it's also disliked by someone
  for (const excluded of excludedGenres) {
    genreLikeCounts.delete(excluded);
  }

  // Build keyword from dietary restrictions
  const allRestrictions = new Set<string>();
  for (const member of input.members) {
    for (const r of member.dietary_restrictions) {
      allRestrictions.add(r);
    }
  }

  const dietaryKeywords = Array.from(allRestrictions)
    .map((r) => {
      const def = DIETARY_RESTRICTIONS.find((d) => d.id === r);
      return def?.keyword ?? "";
    })
    .filter(Boolean);

  // Mood keyword
  const moodDef = input.mood
    ? MOODS.find((m) => m.id === input.mood)
    : undefined;
  const moodKeyword = moodDef?.hpKeyword ?? "";

  const keywords = [...dietaryKeywords, moodKeyword].filter(Boolean).join(" ");

  // Mood-specific HP params
  const needsPrivateRoom =
    input.mood === "business" || input.mood === "date" || input.mood === "calm";

  // Time slot
  const isLunch = input.timeSlot === "lunch";
  const isLateNight = input.timeSlot === "late_night";

  // Build search params (no genre filter since we filter post-fetch)
  const searchParams: HotPepperSearchParams = {
    keyword: keywords || undefined,
    large_area: input.locationCode,
    count: 100, // Fetch more to allow post-filtering
    start: 1,
    private_room: needsPrivateRoom ? 1 : undefined,
    free_drink: input.mood === "lively" ? 1 : undefined,
    lunch: isLunch ? 1 : undefined,
    midnight: isLateNight ? 1 : undefined,
  };

  return {
    searchParams,
    excludedGenres,
    boostedGenres: genreLikeCounts,
  };
}

export function scoreRestaurants(
  shops: HotPepperShop[],
  excludedGenres: Set<string>,
  boostedGenres: Map<string, number>,
  memberCount: number
): ScoredRestaurant[] {
  const scored: ScoredRestaurant[] = [];

  for (const shop of shops) {
    // Skip excluded genres
    if (excludedGenres.has(shop.genre.code)) {
      continue;
    }

    // Compute match score
    let matchScore = 50; // base score

    // Boost for liked genres
    const likeCount = boostedGenres.get(shop.genre.code) ?? 0;
    matchScore += likeCount * 10;

    // Bonus if all members like this genre
    if (likeCount === memberCount) {
      matchScore += 20;
    }

    // Rating score (Hot Pepper doesn't have a direct rating, use catch text length as proxy)
    const ratingScore = Math.min(100, 50 + (shop.catch?.length ?? 0));

    scored.push({
      id: shop.id,
      name: shop.name,
      genre_code: shop.genre.code,
      genre_name: shop.genre.name,
      address: shop.address,
      lat: shop.lat,
      lng: shop.lng,
      budget_name: shop.budget?.name ?? "",
      budget_average: shop.budget?.average ?? "",
      photo_l: shop.photo?.pc?.l ?? "",
      photo_s: shop.photo?.pc?.s ?? "",
      open: shop.open ?? "",
      close: shop.close ?? "",
      catch_text: shop.catch ?? "",
      url: shop.urls?.pc ?? "",
      private_room: shop.private_room === "あり",
      free_drink: shop.free_drink === "あり",
      free_food: shop.free_food === "あり",
      match_score: matchScore,
      rating_score: ratingScore,
    });
  }

  return scored;
}

export function sortByMatchScore(restaurants: ScoredRestaurant[]): ScoredRestaurant[] {
  return [...restaurants].sort((a, b) => b.match_score - a.match_score);
}

export function sortByRating(restaurants: ScoredRestaurant[]): ScoredRestaurant[] {
  return [...restaurants].sort((a, b) => b.rating_score - a.rating_score);
}

export function sortByDistance(
  restaurants: ScoredRestaurant[],
  lat: number,
  lng: number
): ScoredRestaurant[] {
  return [...restaurants]
    .map((r) => {
      const dLat = r.lat - lat;
      const dLng = r.lng - lng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // rough km
      return { ...r, distance_km: Math.round(distance * 10) / 10 };
    })
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
}
