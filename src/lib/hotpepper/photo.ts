// ============================================================
// HotPepper 写真エンリッチメント
// ============================================================
// 方針: 候補の母集団と信頼は自前台帳が正。ただし「写真」だけは
// HotPepper の公式APIから借りる (無料・規約内)。
// 店名 + 座標 (300m) で照合し、名前が一致した店の写真URLを返す。
// 取得結果は restaurants.photo_url に保存して再利用する。
// ============================================================

import { searchRestaurants } from "./client";
import { namesSimilar } from "@/lib/gmaps-import/match";

export interface HotpepperPhotoHit {
  photoUrl: string;
  hotpepperUrl?: string;
}

export async function findHotpepperPhoto(params: {
  name: string;
  lat: number;
  lng: number;
}): Promise<HotpepperPhotoHit | null> {
  try {
    // 1st: 店名キーワード + 300m。キーワードは店名の先頭部分
    const keyword = params.name.split(/[\s　(（]/)[0].slice(0, 20);
    const first = await searchRestaurants({
      keyword,
      lat: params.lat,
      lng: params.lng,
      range: 2,
      count: 5,
    });

    let match = first.shops.find((shop) => namesSimilar(shop.name, params.name));

    // 2nd: 表記ゆれでキーワードが外れる店向けに、100m以内の全店から名前照合
    if (!match) {
      const nearby = await searchRestaurants({
        lat: params.lat,
        lng: params.lng,
        range: 2,
        count: 100,
      });
      match = nearby.shops.find((shop) => namesSimilar(shop.name, params.name));
    }

    if (!match) return null;

    const photoUrl = match.photo?.pc?.l ?? match.photo?.mobile?.l;
    if (!photoUrl) return null;

    return { photoUrl, hotpepperUrl: match.urls?.pc };
  } catch {
    return null;
  }
}
