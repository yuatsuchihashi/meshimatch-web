// ============================================================
// Google マップ共有リスト インポーター (B案)
// ============================================================
// 注意: 非公式エンドポイント (maps/preview/entitylist/getlist) に依存する。
// Google 側の変更で突然壊れる前提で、この module に隔離し、
// 失敗時は呼び出し側が Takeout CSV 案内へフォールバックする。
//
// 流れ:
//   1. maps.app.goo.gl 短縮リンクを redirect: manual で解決し listId を抜く
//   2. getlist を叩いて )]}' プレフィックスを剥がして JSON パース
//   3. 各アイテムから {name, address, lat, lng, cid} を抽出
// ============================================================

export interface ParsedPlace {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  cid: string | null; // Google 側の安定ID (external_id "gmaps:<cid>" に使う)
}

export interface ParsedList {
  listId: string;
  title: string;
  creator: string | null;
  places: ParsedPlace[];
}

const SHORT_LINK = /^https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+/;
const FULL_LINK_ID = /!2s([A-Za-z0-9_-]{16,})/;
const PLACELISTS_ID = /placelists\/list\/([A-Za-z0-9_-]{16,})/;

export async function resolveListId(url: string): Promise<string | null> {
  const direct = url.match(FULL_LINK_ID) ?? url.match(PLACELISTS_ID);
  if (direct) return direct[1];

  if (!SHORT_LINK.test(url)) return null;

  // ブラウザUAだとJSアプリが返るが、非ブラウザUAなら 302 Location が返る
  const res = await fetch(url, {
    method: "HEAD",
    redirect: "manual",
    headers: { "User-Agent": "curl/8.0" },
  });
  const location = res.headers.get("location") ?? "";
  const m = location.match(FULL_LINK_ID) ?? location.match(PLACELISTS_ID);
  return m ? m[1] : null;
}

export async function fetchSharedList(listId: string): Promise<ParsedList | null> {
  // !4i<n> = 取得上限。これがないと先頭10件しか返らない (800件リストで発覚)。
  // 観測上 1000 指定で713件リストが一発で全件返った。
  const pb = `!1m4!1s${listId}!2e1!3m1!1e1!2e2!3e2!4i1000`;
  const res = await fetch(
    `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=ja&gl=jp&pb=${pb}`,
    { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja" } }
  );
  if (!res.ok) return null;

  const raw = await res.text();
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) return null;

  let data: unknown[];
  try {
    data = JSON.parse(raw.slice(jsonStart));
  } catch {
    return null;
  }

  // 構造 (2026-07 時点の観測):
  //   data[0][4]  = リスト名
  //   data[0][3]  = [作成者名, アイコンURL, ユーザーID]
  //   data[0][8]  = アイテム配列
  //   item[2]     = 場所名
  //   item[1][4]  = 住所
  //   item[1][5]  = [null, null, lat, lng]
  //   item[1][6]  = [cid, ...]
  const root = data[0] as unknown[] | undefined;
  if (!root) return null;

  const items = (root[8] as unknown[][] | null) ?? [];
  const places: ParsedPlace[] = [];

  for (const item of items) {
    const name = typeof item?.[2] === "string" ? (item[2] as string) : null;
    if (!name) continue;
    const detail = (item?.[1] as unknown[] | null) ?? null;
    const geo = (detail?.[5] as (number | null)[] | null) ?? null;
    const cidPair = (detail?.[6] as string[] | null) ?? null;
    places.push({
      name,
      address: typeof detail?.[4] === "string" && detail[4] ? (detail[4] as string) : null,
      lat: typeof geo?.[2] === "number" ? geo[2] : null,
      lng: typeof geo?.[3] === "number" ? geo[3] : null,
      cid: cidPair?.[0] ?? null,
    });
  }

  const creatorInfo = root[3] as unknown[] | null;

  return {
    listId,
    title: typeof root[4] === "string" ? (root[4] as string) : "インポートしたリスト",
    creator:
      typeof creatorInfo?.[0] === "string" ? (creatorInfo[0] as string) : null,
    places,
  };
}
