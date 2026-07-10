// ============================================================
// LocalDB – JSON ファイルベースのデータストア + クエリ実行エンジン
// ============================================================
// Supabase プロジェクトなしでサービス全体を動かすローカルモードの心臓部。
// supabase-js の使用サブセット (builder.ts の DbQuery) を
// .localdb/db.json 上で実行する。サーバー専用 (fs を使う)。
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { INITIAL_STATION_ZONE_MAP, INITIAL_ZONES } from "@/lib/areas";
import type { DbQuery, DbResult, DbFilter, DbError } from "./builder";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

const TABLES = [
  "profiles",
  "auth_users",
  "groups",
  "group_members",
  "survey_responses",
  "decisions",
  "invitations",
  "follows",
  "favorite_restaurants",
  "search_history",
  "restaurants",
  "restaurant_sources",
  "restaurant_votes",
  "official_verification_grants",
  "zones",
  "station_zone_map",
] as const;

// 外部キー: table -> { column -> 参照先テーブル }
const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  groups: { created_by: "profiles" },
  group_members: { group_id: "groups", profile_id: "profiles" },
  survey_responses: { group_id: "groups", member_id: "group_members" },
  decisions: { group_id: "groups", decided_by: "profiles" },
  invitations: { group_id: "groups", inviter_id: "profiles", invitee_id: "profiles" },
  follows: { follower_id: "profiles", following_id: "profiles" },
  favorite_restaurants: { profile_id: "profiles" },
  search_history: { profile_id: "profiles" },
  restaurant_sources: { restaurant_id: "restaurants", added_by: "profiles" },
  restaurant_votes: { group_id: "groups", member_id: "group_members" },
  official_verification_grants: { profile_id: "profiles", granted_by: "profiles" },
  station_zone_map: { zone_id: "zones" },
};

// ユニーク制約 (upsert の onConflict と重複エラー判定に使用)
const UNIQUE_CONSTRAINTS: Record<string, string[][]> = {
  profiles: [["id"]],
  auth_users: [["id"], ["email"]],
  groups: [["id"], ["invite_code"]],
  group_members: [["id"], ["group_id", "profile_id"]],
  survey_responses: [["id"], ["group_id", "member_id"]],
  decisions: [["id"], ["group_id"]],
  invitations: [["id"]],
  follows: [["id"], ["follower_id", "following_id"]],
  favorite_restaurants: [["id"]],
  search_history: [["id"]],
  restaurants: [["id"], ["external_id"]],
  restaurant_sources: [["id"], ["restaurant_id", "source_type", "added_by"]],
  restaurant_votes: [["id"], ["group_id", "member_id", "restaurant_id"]],
  official_verification_grants: [["id"], ["profile_id"]],
  zones: [["id", "generation"]],
  station_zone_map: [["id"], ["station", "generation"]],
};

function nowIso(): string {
  return new Date().toISOString();
}

// テーブル別のカラムデフォルト (supabase/schema.sql に準拠)
function applyDefaults(table: string, values: Row): Row {
  const row: Row = { ...values };
  if (row.id == null) row.id = crypto.randomUUID();

  const stamp = nowIso();
  switch (table) {
    case "profiles":
      row.display_name ??= "ユーザー";
      row.bio ??= null;
      row.allergy_note ??= null;
      row.dietary_note ??= null;
      row.usual_prefer_moods ??= [];
      row.usual_avoid_moods ??= [];
      row.allergies ??= [];
      row.usual_areas ??= [];
      row.favorite_genres ??= [];
      row.disliked_items ??= [];
      row.dietary_restrictions ??= [];
      row.avatar_url ??= null;
      row.created_at ??= stamp;
      row.updated_at ??= stamp;
      break;
    case "groups":
      row.mode ??= "planned";
      row.status ??= "active";
      row.session_focus ??= "balanced";
      row.scheduled_at ??= null;
      row.group_size ??= null;
      row.session_atmosphere ??= null;
      row.shortlist ??= null; // 幹事が絞り込んだ候補のスナップショット (jsonb)
      row.created_at ??= stamp;
      row.updated_at ??= stamp;
      break;
    case "group_members":
      row.role ??= "member";
      row.has_survey ??= false;
      row.profile_id ??= null;
      row.joined_at ??= stamp;
      break;
    case "survey_responses":
      row.response_version ??= 2;
      row.allergy_note ??= null;
      row.dietary_note ??= null;
      row.departure_station ??= null;
      row.prefer_moods ??= [];
      row.avoid_moods ??= [];
      row.suggested_restaurants ??= []; // [{id,name,showName}] 持ち寄り店
      row.preferred_areas ??= [];
      row.genre_preferences ??= [];
      row.dietary_restrictions ??= [];
      row.submitted_at ??= stamp;
      break;
    case "decisions":
      row.decided_at ??= stamp;
      break;
    case "invitations":
      row.status ??= "pending";
      row.created_at ??= stamp;
      break;
    case "restaurants":
      // 台帳 (gazetteer): 信頼情報は restaurant_sources 側に持つ
      row.lat ??= null;   // 手動追加は座標なしを許容
      row.lng ??= null;
      row.name_en ??= null;
      row.genre_id ??= null;
      row.price_band ??= null;
      row.address ??= null;
      row.nearest_area ??= null;
      row.url ??= null;
      row.photo_url ??= null;
      row.closed ??= false;
      row.place_id ??= null;    // Google Places ID (一度取得したら再callしない)
      row.rating ??= null;      // Google の評価 (キャッシュ)
      row.opening_hours ??= null;
      row.opening_hours_source ??= null;
      row.opening_hours_updated_at ??= null;
      row.external_id ??= null; // overture:<id> / fsq:<id> / manual:<slug>
      row.created_at ??= stamp;
      row.updated_at ??= stamp;
      break;
    case "restaurant_sources":
      // 信頼レイヤー: base_curated | endorsement | user_favorite
      row.source_type ??= "user_favorite";
      row.visibility ??= "private";
      row.added_by ??= null;
      row.display_label ??= null; // "〇〇のおすすめ！" (本人許可時のみ)
      row.note ??= null;
      row.pr ??= false;
      row.created_at ??= stamp;
      break;
    case "official_verification_grants":
      row.profile_id ??= null;
      row.granted_at ??= stamp;
      row.granted_by ??= null;
      row.note ??= null;
      row.created_at ??= stamp;
      break;
    case "zones":
      row.name ??= "";
      row.generation ??= 1;
      row.created_at ??= stamp;
      break;
    case "station_zone_map":
      row.station ??= "";
      row.zone_id ??= null;
      row.generation ??= 1;
      row.created_at ??= stamp;
      break;
    case "restaurant_votes":
      // ○× 投票: vote は "yes" | "no"
      row.restaurant_name ??= null;
      row.genre_id ??= null;
      row.created_at ??= stamp;
      break;
    default:
      row.created_at ??= stamp;
  }
  return row;
}

// ---------- ストレージ ----------

function dbPath(): string {
  return (
    process.env.MESHIMATCH_LOCALDB_PATH ??
    path.join(process.cwd(), ".localdb", "db.json")
  );
}

function emptyDb(): Db {
  const db: Db = {};
  for (const table of TABLES) db[table] = [];
  seedZones(db);
  return db;
}

function seedZones(db: Db): boolean {
  let changed = false;
  const stamp = nowIso();

  for (const zone of INITIAL_ZONES) {
    if ((db.zones ?? []).some((row) => row.id === zone.id && row.generation === zone.generation)) continue;
    db.zones.push({
      id: zone.id,
      name: zone.name,
      generation: zone.generation,
      created_at: stamp,
    });
    changed = true;
  }

  for (const mapping of INITIAL_STATION_ZONE_MAP) {
    if (
      (db.station_zone_map ?? []).some(
        (row) =>
          row.station === mapping.station &&
          row.generation === mapping.generation
      )
    ) {
      continue;
    }
    db.station_zone_map.push({
      id: crypto.randomUUID(),
      station: mapping.station,
      zone_id: mapping.zoneId,
      generation: mapping.generation,
      created_at: stamp,
    });
    changed = true;
  }

  return changed;
}

function backfillDb(db: Db): boolean {
  let changed = false;

  for (const table of TABLES) {
    if (!db[table]) {
      db[table] = [];
      changed = true;
    }
  }

  for (const row of db.groups) {
    if (row.mode == null) {
      row.mode = "planned";
      changed = true;
    }
  }

  for (const row of db.survey_responses) {
    if (!("departure_station" in row)) {
      row.departure_station = null;
      changed = true;
    }
  }

  for (const row of db.restaurants) {
    for (const column of [
      "opening_hours",
      "opening_hours_source",
      "opening_hours_updated_at",
    ]) {
      if (!(column in row)) {
        row[column] = null;
        changed = true;
      }
    }
  }

  for (const row of db.restaurant_sources) {
    if (row.pr == null) {
      row.pr = false;
      changed = true;
    }
  }

  return seedZones(db) || changed;
}

// ── インメモリキャッシュ ──
// db.json は台帳込みで数十MBになるため、クエリごとに読み直すと
// 1リクエスト(複数クエリ)で数百ms〜1秒かかる。mtime が変わらない限り
// パース済みオブジェクトを使い回す。外部プロセス(seedスクリプト等)が
// 書き換えた場合は mtime 変化で自動的に再読込される。
let dbCache: { db: Db; mtimeMs: number } | null = null;

function loadDb(): Db {
  const file = dbPath();
  try {
    const { mtimeMs } = fs.statSync(file);
    if (dbCache && dbCache.mtimeMs === mtimeMs) {
      return dbCache.db;
    }
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as Db;
    const changed = backfillDb(parsed);
    if (changed) {
      saveDb(parsed);
    } else {
      dbCache = { db: parsed, mtimeMs };
    }
    return parsed;
  } catch {
    return emptyDb();
  }
}

function saveDb(db: Db): void {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  // コンパクト書き出し (整形すると台帳込みでファイルサイズが約2倍になる)
  fs.writeFileSync(tmp, JSON.stringify(db), "utf-8");
  fs.renameSync(tmp, file);
  dbCache = { db, mtimeMs: fs.statSync(file).mtimeMs };
}

export function resetLocalDb(): void {
  saveDb(emptyDb());
}

// ---------- select 文字列のパース ----------

interface ParsedSelect {
  all: boolean;
  columns: string[];
  embeds: ParsedEmbed[];
}

interface ParsedEmbed {
  alias: string;
  table: string;
  fkHint: string | null;
  inner: boolean;
  children: ParsedSelect;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(select: string | null): ParsedSelect {
  const result: ParsedSelect = { all: false, columns: [], embeds: [] };
  if (!select || select.trim() === "*" || select.trim() === "") {
    result.all = true;
    return result;
  }

  for (const token of splitTopLevel(select)) {
    const parenIndex = token.indexOf("(");
    if (parenIndex === -1) {
      if (token === "*") result.all = true;
      else result.columns.push(token);
      continue;
    }

    // 埋め込み: [alias:]table[!fk_hint] ( ... )
    const head = token.slice(0, parenIndex).trim();
    const inner = token.slice(parenIndex + 1, token.lastIndexOf(")"));
    const headMatch = head.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?$/);
    if (!headMatch) continue;

    const [, alias, table, hint] = headMatch;
    result.embeds.push({
      alias: alias ?? table,
      table,
      fkHint: hint && hint !== "inner" ? hint : null,
      inner: hint === "inner",
      children: parseSelect(inner),
    });
  }
  return result;
}

// ---------- フィルター ----------

function matchesFilters(row: Row, filters: DbFilter[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.column];
    switch (filter.op) {
      case "eq":
        return value === filter.value;
      case "neq":
        return value !== filter.value;
      case "in":
        return filter.value.includes(value);
      case "not_is_null":
        return value !== null && value !== undefined;
    }
  });
}

// ---------- 埋め込みの解決 ----------

function projectRow(row: Row, parsed: ParsedSelect): Row {
  if (parsed.all || parsed.columns.length === 0) return { ...row };
  const projected: Row = {};
  for (const column of parsed.columns) {
    projected[column] = row[column];
  }
  return projected;
}

function resolveRow(
  db: Db,
  table: string,
  row: Row,
  parsed: ParsedSelect
): Row | null {
  const result = projectRow(row, parsed);

  for (const embed of parsed.embeds) {
    // 1. FKヒント (<table>_<column>_fkey) → 親参照 (オブジェクト)
    let parentColumn: string | null = null;
    if (embed.fkHint) {
      const hintMatch = embed.fkHint.match(new RegExp(`^${table}_([\\w]+)_fkey$`));
      if (hintMatch) parentColumn = hintMatch[1];
    }
    // 2. 対象テーブルから埋め込みテーブルへのFK → 親参照
    if (!parentColumn) {
      const fks = FOREIGN_KEYS[table] ?? {};
      parentColumn =
        Object.entries(fks).find(([, target]) => target === embed.table)?.[0] ??
        null;
    }

    if (parentColumn) {
      const parentId = row[parentColumn];
      const parentRow =
        (db[embed.table] ?? []).find((r) => r.id === parentId) ?? null;
      const resolved = parentRow
        ? resolveRow(db, embed.table, parentRow, embed.children)
        : null;
      if (embed.inner && !resolved) return null;
      result[embed.alias] = resolved;
      continue;
    }

    // 3. 埋め込みテーブルから対象テーブルへのFK → 子リスト (配列)
    const childFks = FOREIGN_KEYS[embed.table] ?? {};
    const childColumn = Object.entries(childFks).find(
      ([, target]) => target === table
    )?.[0];

    if (childColumn) {
      const children = (db[embed.table] ?? [])
        .filter((r) => r[childColumn] === row.id)
        .map((r) => resolveRow(db, embed.table, r, embed.children))
        .filter((r): r is Row => r !== null);
      if (embed.inner && children.length === 0) return null;
      result[embed.alias] = children;
      continue;
    }

    result[embed.alias] = null;
  }

  return result;
}

// ---------- ユニーク制約 ----------

function findConflict(
  db: Db,
  table: string,
  row: Row,
  columns: string[],
  excludeId?: unknown
): Row | undefined {
  return (db[table] ?? []).find((existing) => {
    if (excludeId !== undefined && existing.id === excludeId) return false;
    return columns.every((column) => {
      const a = existing[column];
      const b = row[column];
      // Postgres 同様、NULL 同士は衝突しない
      if (a == null || b == null) return false;
      return a === b;
    });
  });
}

function checkUniques(db: Db, table: string, row: Row): DbError | null {
  for (const columns of UNIQUE_CONSTRAINTS[table] ?? []) {
    if (findConflict(db, table, row, columns, row.id)) {
      return {
        message: `duplicate key value violates unique constraint on ${table}(${columns.join(",")})`,
        code: "23505",
      };
    }
  }
  return null;
}

// ---------- クエリ実行 ----------

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function finalize(rows: Row[], query: DbQuery): DbResult {
  if (query.single === "single") {
    if (rows.length === 0) {
      return {
        data: null,
        error: { message: "JSON object requested, no rows returned", code: "PGRST116" },
      };
    }
    return { data: rows[0], error: null };
  }
  if (query.single === "maybe") {
    return { data: rows[0] ?? null, error: null };
  }
  return { data: rows, error: null };
}

export function executeLocalQuery(query: DbQuery): DbResult {
  const db = loadDb();
  const table = query.table;

  if (!TABLES.includes(table as (typeof TABLES)[number])) {
    return { data: null, error: { message: `relation "${table}" does not exist` } };
  }

  switch (query.action) {
    case "select": {
      const parsed = parseSelect(query.select);
      let rows = (db[table] ?? [])
        .filter((row) => matchesFilters(row, query.filters))
        .map((row) => resolveRow(db, table, row, parsed))
        .filter((row): row is Row => row !== null);

      if (query.order) {
        const { column, ascending } = query.order;
        rows = [...rows].sort(
          (a, b) => compareValues(a[column], b[column]) * (ascending ? 1 : -1)
        );
      }
      return finalize(rows, query);
    }

    case "insert": {
      const inputs = Array.isArray(query.values)
        ? query.values
        : [query.values ?? {}];
      const inserted: Row[] = [];
      for (const input of inputs) {
        const row = applyDefaults(table, input as Row);
        const conflict = checkUniques(db, table, row);
        if (conflict) return { data: null, error: conflict };
        db[table].push(row);
        inserted.push(row);
      }
      saveDb(db);
      if (query.select === null) return { data: null, error: null };
      return finalize(inserted, query);
    }

    case "update": {
      const updated: Row[] = [];
      for (const row of db[table]) {
        if (!matchesFilters(row, query.filters)) continue;
        Object.assign(row, query.values);
        if ("updated_at" in row) row.updated_at = nowIso();
        updated.push(row);
      }
      saveDb(db);
      if (query.select === null) return { data: null, error: null };
      return finalize(updated, query);
    }

    case "upsert": {
      const inputs = Array.isArray(query.values)
        ? query.values
        : [query.values ?? {}];
      const conflictColumns = query.onConflict
        ? query.onConflict.split(",").map((c) => c.trim())
        : ["id"];
      const results: Row[] = [];
      for (const input of inputs) {
        const candidate = input as Row;
        const existing = findConflict(db, table, candidate, conflictColumns);
        if (existing) {
          Object.assign(existing, candidate, { id: existing.id });
          if ("updated_at" in existing) existing.updated_at = nowIso();
          results.push(existing);
        } else {
          const row = applyDefaults(table, candidate);
          const conflict = checkUniques(db, table, row);
          if (conflict) return { data: null, error: conflict };
          db[table].push(row);
          results.push(row);
        }
      }
      saveDb(db);
      if (query.select === null) return { data: null, error: null };
      return finalize(results, query);
    }

    case "delete": {
      const kept: Row[] = [];
      const removed: Row[] = [];
      for (const row of db[table]) {
        if (matchesFilters(row, query.filters)) removed.push(row);
        else kept.push(row);
      }
      db[table] = kept;
      saveDb(db);
      if (query.select === null) return { data: null, error: null };
      return finalize(removed, query);
    }
  }
}

// ---------- ローカル認証 ----------

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export interface LocalAuthResult {
  userId: string | null;
  error: string | null;
}

export function localSignUp(
  email: string,
  password: string,
  displayName: string
): LocalAuthResult {
  const db = loadDb();
  if (db.auth_users.some((u) => u.email === email)) {
    return { userId: null, error: "User already registered" };
  }
  const id = crypto.randomUUID();
  db.auth_users.push({
    id,
    email,
    password_hash: hashPassword(password),
    created_at: nowIso(),
  });
  db.profiles.push(
    applyDefaults("profiles", {
      id,
      display_name: displayName || "ユーザー",
    })
  );
  saveDb(db);
  return { userId: id, error: null };
}

export function localSignIn(email: string, password: string): LocalAuthResult {
  const db = loadDb();
  const user = db.auth_users.find((u) => u.email === email);
  if (!user || user.password_hash !== hashPassword(password)) {
    return { userId: null, error: "Invalid login credentials" };
  }
  return { userId: user.id as string, error: null };
}

export function localGetUser(userId: string | null): { id: string; email: string } | null {
  if (!userId) return null;
  const db = loadDb();
  const user = db.auth_users.find((u) => u.id === userId);
  if (!user) return null;
  return { id: user.id as string, email: (user.email as string) ?? "" };
}

// LINE ログイン: LINE の userId (sub) で auth_users を引き、なければ作成
export function localLineSignIn(params: {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
}): LocalAuthResult {
  const db = loadDb();
  const existing = db.auth_users.find((u) => u.line_user_id === params.lineUserId);
  if (existing) {
    return { userId: existing.id as string, error: null };
  }

  const id = crypto.randomUUID();
  db.auth_users.push({
    id,
    email: null,
    provider: "line",
    line_user_id: params.lineUserId,
    created_at: nowIso(),
  });
  db.profiles.push(
    applyDefaults("profiles", {
      id,
      display_name: params.displayName || "ユーザー",
      avatar_url: params.pictureUrl ?? null,
    })
  );
  saveDb(db);
  return { userId: id, error: null };
}
