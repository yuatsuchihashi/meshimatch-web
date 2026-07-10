export const GENRES = [
  { code: "G001", name: "居酒屋", icon: "🍶" },
  { code: "G002", name: "ダイニングバー・バル", icon: "🍷" },
  { code: "G003", name: "創作料理", icon: "🍽️" },
  { code: "G004", name: "和食", icon: "🍣" },
  { code: "G005", name: "洋食", icon: "🥩" },
  { code: "G006", name: "イタリアン・フレンチ", icon: "🍝" },
  { code: "G007", name: "中華", icon: "🥟" },
  { code: "G008", name: "焼肉・ホルモン", icon: "🥓" },
  { code: "G009", name: "アジア・エスニック料理", icon: "🍛" },
  { code: "G010", name: "各国料理", icon: "🌍" },
  { code: "G011", name: "カラオケ・パーティ", icon: "🎤" },
  { code: "G012", name: "バー・カクテル", icon: "🍸" },
  { code: "G013", name: "ラーメン", icon: "🍜" },
  { code: "G014", name: "カフェ・スイーツ", icon: "☕" },
  { code: "G015", name: "その他グルメ", icon: "🍴" },
  { code: "G016", name: "お好み焼き・もんじゃ", icon: "🫓" },
  { code: "G017", name: "韓国料理", icon: "🥘" },
] as const;

export type GenreCode = (typeof GENRES)[number]["code"];

export const GENRE_NAMES: Record<string, string> = Object.fromEntries(
  GENRES.map((genre) => [genre.code, genre.name])
);

export const DIETARY_RESTRICTIONS = [
  { id: "vegetarian", label: "ベジタリアン", keyword: "ベジタリアン 菜食" },
  { id: "vegan", label: "ヴィーガン", keyword: "ビーガン ヴィーガン" },
  { id: "halal", label: "ハラール", keyword: "ハラール ハラル" },
  { id: "gluten_free", label: "グルテンフリー", keyword: "グルテンフリー 小麦不使用" },
  { id: "allergy_egg", label: "卵アレルギー", keyword: "卵アレルギー対応" },
  { id: "allergy_dairy", label: "乳アレルギー", keyword: "乳アレルギー対応" },
  { id: "allergy_shellfish", label: "甲殻類アレルギー", keyword: "甲殻類アレルギー対応" },
  { id: "allergy_nuts", label: "ナッツアレルギー", keyword: "ナッツアレルギー対応" },
  { id: "allergy_wheat", label: "小麦アレルギー", keyword: "小麦不使用 グルテンフリー" },
  { id: "allergy_soba", label: "そばアレルギー", keyword: "そばアレルギー対応" },
] as const;

export type DietaryRestrictionId =
  (typeof DIETARY_RESTRICTIONS)[number]["id"];

export const MOODS = [
  { id: "lively", label: "ワイワイ", icon: "🎉", keyword: "宴会" },
  { id: "calm", label: "落ち着いた", icon: "🕯️", keyword: "落ち着いた" },
  { id: "business", label: "商談・接待", icon: "💼", keyword: "接待 個室" },
  { id: "girls", label: "女子会", icon: "👩‍👩‍👧", keyword: "女子会" },
  { id: "date", label: "デート", icon: "💕", keyword: "デート" },
  { id: "casual", label: "カジュアル", icon: "😊", keyword: "カジュアル" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];
