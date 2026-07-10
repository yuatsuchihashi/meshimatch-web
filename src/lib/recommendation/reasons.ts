import type {
  AreaReasonCode,
  RestaurantReasonCode,
} from "@/lib/recommendation/types";

const AREA_REASON_TAGS: Record<AreaReasonCode, string> = {
  easy_gather: "集まりやすい",
  practical_midpoint: "中間候補",
  strong_supply: "店数が多い",
  large_group_safe: "大人数向き",
  preferred_area_bonus: "希望エリア寄り",
  discovery_pick: "穴場寄り",
};

const RESTAURANT_REASON_TAGS: Record<RestaurantReasonCode, string> = {
  budget_overlap: "予算が合う",
  budget_safe: "上限内に収まりやすい",
  preferred_genre_match: "好みに近い",
  drink_focus_fit: "飲み会向き",
  food_focus_fit: "食事メイン向き",
  atmosphere_fit: "雰囲気が合う",
  restriction_friendly: "制約に配慮しやすい",
  group_size_fit: "人数に合う",
};

const AREA_REASON_PHRASES: Record<AreaReasonCode, string> = {
  easy_gather: "集まりやすく",
  practical_midpoint: "移動の偏りが出にくく",
  strong_supply: "店の選択肢が十分あり",
  large_group_safe: "大人数でも候補を確保しやすく",
  preferred_area_bonus: "参加者の希望エリアにも寄っていて",
  discovery_pick: "定番すぎない選択肢としても機能し",
};

const RESTAURANT_REASON_PHRASES: Record<RestaurantReasonCode, string> = {
  budget_overlap: "提出された予算帯に収まりやすく",
  budget_safe: "上限予算を超えにくく",
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

export function buildRestaurantExplanation(
  reasons: RestaurantReasonCode[],
  context?: { genreName?: string | null; area?: string | null }
) {
  const phrases = reasons
    .slice(0, 3)
    .map((reason) => RESTAURANT_REASON_PHRASES[reason]);
  if (phrases.length === 0) {
    // 理由コードが無い低シグナル候補でも、全カード同一文にならないよう
    // ジャンル・エリアで文を固有化する (spec §3-3)
    const genre = context?.genreName ?? null;
    const area = context?.area ?? null;
    if (genre && area) {
      return `${area}の${genre}。強い一致はまだ少ないけれど、基本情報で選びやすい候補です。`;
    }
    if (genre) {
      return `${genre}のお店。強い一致はまだ少ないけれど、基本情報で選びやすい候補です。`;
    }
    if (area) {
      return `${area}の一軒。強い一致はまだ少ないけれど、基本情報で選びやすい候補です。`;
    }
    return "このお店は今回の条件全体に対して無難に合わせやすい候補です。";
  }
  return `このお店は${joinPhrases(phrases)}、候補として相性が良いです。`;
}
