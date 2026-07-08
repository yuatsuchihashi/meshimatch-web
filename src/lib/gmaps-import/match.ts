// ============================================================
// インポートした場所 → 台帳 (restaurants) のマッチング
// ============================================================
// 「お気に入りリストにはレストラン以外も混ざる」問題への答え:
//   1. 座標 200m 以内 + 店名類似 で飲食店台帳と照合
//      → ホテル・クリニック等は台帳にないので自然に落ちる
//   2. マッチしなかったものは店名キーワードで「飲食っぽさ」を判定し、
//      飲食っぽいものだけ新規台帳エントリ候補として提示する
// ============================================================

import { haversineKm, nearestSurveyArea } from "@/lib/areas";
import type { ParsedPlace } from "./parse";
import type { RestaurantRow } from "@/lib/restaurants/pool";

const MATCH_RADIUS_KM = 0.2;

const FOOD_HINT =
  /カフェ|cafe|coffee|珈琲|喫茶|食堂|居酒屋|酒場|酒肆|バル|バー|bar|鮨|寿司|すし|焼|ホルモン|ラーメン|らーめん|そば|蕎麦|うどん|天ぷら|とんかつ|カレー|餃子|中華|飯店|キッチン|kitchen|ダイニング|dining|ビストロ|bistro|トラットリア|オステリア|リストランテ|restaurant|グリル|grill|ベーカリー|bakery|パン|スイーツ|sweets|パーラー|tea|茶|亭|庵|割烹|料理|食|麺|丼|サラダ|salad|ピザ|pizza|バーガー|burger|ステーキ|steak|鍋|しゃぶ|海鮮|魚|肉|酒/i;

// 飲食ワードがあっても覆せない強い非飲食シグナル
const HARD_NON_FOOD =
  /ホテル|hotel|クリニック|clinic|病院|皮フ科|皮膚科|歯科|薬局|美容|サロン|salon|ジム|gym|銀行|bank|市役所|区役所|不動産/i;

// 飲食ワードがない場合のみ効かせる弱い非飲食シグナル
// (VERVE COFFEE "YOYOGI PARK" のように店名に地名が入るケースを誤爆させない)
const SOFT_NON_FOOD =
  /センター|会館|図書館|美術館|博物館|神社|公園|park|駅|station|大学|学校|スタジオ|劇場|ホール/i;

export function looksLikeFood(name: string): boolean {
  if (HARD_NON_FOOD.test(name)) return false;
  if (FOOD_HINT.test(name)) return true;
  if (SOFT_NON_FOOD.test(name)) return false;
  return false;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･'’"”\-–—~〜()（）\[\]【】.,、。]/g, "");
}

// 「六本木ヒルズ店」のような支店・場所トークンは店の同一性の根拠にならない
const LOCATION_TOKEN =
  /(ヒルズ|タワー|パーク|ビル|プラザ|ミッドタウン|東京|渋谷|新宿|池袋|銀座|六本木|恵比寿|表参道|下北沢|吉祥寺|上野|日比谷|赤坂|麻布|青山|原宿|代官山|中目黒|丁目|店|支店|本店|別館|分店)/;

export function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;

  // トークン単位の照合: 「クリスプサラダワークス 六本木ヒルズ店 CRISP SALAD WORKS」
  // のような複合名は、支店・場所トークンを除いた実トークンが
  // 相手の名前に含まれるかで判定する (「ヒルズ店」同士の偽マッチを防ぐ)
  const tokensOf = (raw: string) =>
    raw
      .normalize("NFKC")
      .split(/[\s　・･/／]+/)
      .map((t) => normalizeName(t))
      .filter((t) => t.length >= 4 && !LOCATION_TOKEN.test(t));

  const tokensA = tokensOf(a);
  const tokensB = tokensOf(b);
  return (
    tokensA.some((t) => nb.includes(t)) || tokensB.some((t) => na.includes(t))
  );
}

export interface MatchResult {
  place: ParsedPlace;
  matched: RestaurantRow | null;
  // マッチしなかったが飲食っぽい & 対応エリア内 → 新規台帳エントリ候補
  importableAsNew: boolean;
  nearestArea: string | null;
}

export function matchPlaces(
  places: ParsedPlace[],
  gazetteer: RestaurantRow[]
): MatchResult[] {
  return places.map((place) => {
    let matched: RestaurantRow | null = null;

    if (place.lat !== null && place.lng !== null) {
      const nearby = gazetteer.filter(
        (r) =>
          Math.abs(r.lat - place.lat!) < 0.004 &&
          Math.abs(r.lng - place.lng!) < 0.004 &&
          haversineKm({ lat: r.lat, lng: r.lng }, { lat: place.lat!, lng: place.lng! }) <=
            MATCH_RADIUS_KM
      );
      matched =
        nearby.find((r) => namesSimilar(r.name, place.name)) ??
        nearby.find(
          (r) => r.name_en !== null && namesSimilar(r.name_en, place.name)
        ) ??
        null;
    }

    const nearestArea =
      place.lat !== null && place.lng !== null
        ? nearestSurveyArea(place.lat, place.lng)
        : null;

    return {
      place,
      matched,
      // エリア圏外のお気に入りも保存する (対応エリアが増えたときに生きる)。
      // 候補に出るのは nearest_area が付いた店だけなので害はない。
      importableAsNew:
        matched === null && place.lat !== null && looksLikeFood(place.name),
      nearestArea,
    };
  });
}
