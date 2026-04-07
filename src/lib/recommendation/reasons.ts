import type {
  AreaReasonCode,
  RestaurantReasonCode,
} from "@/lib/recommendation/types";

const AREA_REASON_TAGS: Record<AreaReasonCode, string> = {
  easy_access: "アクセスしやすい",
  strong_restaurant: "店数が豊富",
  good_for_large_group: "大人数向き",
  matches_preference: "希望エリア",
};

const RESTAURANT_REASON_TAGS: Record<RestaurantReasonCode, string> = {
  budget_overlap: "予算帯にぴったり",
  budget_safe: "予算帯に近い",
  preferred_genre_match: "好みに近い",
  drink_focus_fit: "飲み会向き",
  food_focus_fit: "食事メイン向き",
  atmosphere_fit: "雰囲気が合う",
  restriction_friendly: "制約に配慮しやすい",
  group_size_fit: "人数に合う",
};

const AREA_REASON_PHRASES: Record<AreaReasonCode, string> = {
  easy_access: "みんなが集まりやすく",
  strong_restaurant: "店の選択肢が十分あり",
  good_for_large_group: "大人数でも候補を確保しやすく",
  matches_preference: "参加者の希望エリアに合っていて",
};

const RESTAURANT_REASON_PHRASES: Record<RestaurantReasonCode, string> = {
  budget_overlap: "グループの予算帯にぴったり収まり",
  budget_safe: "グループの予算帯に近く",
  preferred_genre_match: "提出された好みに近いジャンルで",
  drink_focus_fit: "飲み中心の集まりに向いていて",
  food_focus_fit: "食事メインの会に向いていて",
  atmosphere_fit: "今回の雰囲気設定に合いやすく",
  restriction_friendly: "制約への対応余地があり",
  group_size_fit: "人数に対して選びやすい条件がそろっていて",
};

function joinPhrases(phrases: string[]) {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]}、${phrases[1]}`;
  return `${phrases[0]}、${phrases[1]}、${phrases[2]}`;
}

export function areaReasonTags(reasons: AreaReasonCode[]) {
  return reasons.map((reason) => AREA_REASON_TAGS[reason]);
}

export function restaurantReasonTags(reasons: RestaurantReasonCode[]) {
  return reasons.map((reason) => RESTAURANT_REASON_TAGS[reason]);
}

export function buildAreaExplanation(reasons: AreaReasonCode[]) {
  const phrases = reasons.slice(0, 3).map((reason) => AREA_REASON_PHRASES[reason]);
  if (phrases.length === 0) {
    return "このエリアはアクセスと候補のバランスが取りやすい選択肢です。";
  }
  return `このエリアは${joinPhrases(phrases)}、今回の集合候補として扱いやすいです。`;
}

export function buildRestaurantExplanation(reasons: RestaurantReasonCode[]) {
  const phrases = reasons
    .slice(0, 3)
    .map((reason) => RESTAURANT_REASON_PHRASES[reason]);
  if (phrases.length === 0) {
    return "このお店は今回の条件全体に対して無難に合わせやすい候補です。";
  }
  return `このお店は${joinPhrases(phrases)}、候補として相性が良いです。`;
}
