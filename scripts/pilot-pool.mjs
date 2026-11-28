#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultInputPath = path.join(repoRoot, "data", "pilot-restaurants.csv");
const defaultDbPath = path.join(repoRoot, ".localdb", "db.json");
const config = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "data", "pilot-pool-config.json"), "utf8")
);

const VALID_GENRES = new Set(
  Array.from({ length: 17 }, (_, index) => `G${String(index + 1).padStart(3, "0")}`)
);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV has an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (nonEmptyRows.length === 0) return [];
  const headers = nonEmptyRows[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim()
  );
  return nonEmptyRows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]))
  );
}

function parseBoolean(value) {
  if (value === "") return null;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "open"].includes(normalized)) return true;
  if (["false", "0", "no", "closed"].includes(normalized)) return false;
  return undefined;
}

function parseCoordinate(value) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validatePilotRecords(records, { allowPartial = false } = {}) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  if (!allowPartial && (records.length < 30 || records.length > 50)) {
    errors.push(`実験プールは30〜50店にしてください（現在${records.length}店）。`);
  }
  if (allowPartial && records.length === 0) {
    warnings.push("店舗はまだ0件です。CSVへ候補を追加してください。");
  }

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    for (const field of ["name", "area", "genre_id", "budget", "why_good"]) {
      if (!record[field]) errors.push(`${rowNumber}行目: ${field} は必須です。`);
    }
    if (!record.address && !record.place_id && !record.map_url) {
      errors.push(`${rowNumber}行目: address / place_id / map_url のいずれかが必要です。`);
    }
    if (record.genre_id && !VALID_GENRES.has(record.genre_id)) {
      errors.push(`${rowNumber}行目: genre_id は G001〜G017 で指定してください。`);
    }

    const uniqueKey = record.place_id || `${record.name}|${record.area}`;
    if (uniqueKey && seen.has(uniqueKey)) {
      errors.push(`${rowNumber}行目: 店舗が重複しています（${record.name}）。`);
    }
    seen.add(uniqueKey);

    const lat = parseCoordinate(record.lat ?? "");
    const lng = parseCoordinate(record.lng ?? "");
    if ((lat === null) !== (lng === null)) {
      errors.push(`${rowNumber}行目: lat と lng は両方入力するか、両方空欄にしてください。`);
    }
    if (lat === undefined || (lat !== null && (lat < -90 || lat > 90))) {
      errors.push(`${rowNumber}行目: lat が不正です。`);
    }
    if (lng === undefined || (lng !== null && (lng < -180 || lng > 180))) {
      errors.push(`${rowNumber}行目: lng が不正です。`);
    }

    if (parseBoolean(record.open_now ?? "") === undefined) {
      errors.push(`${rowNumber}行目: open_now は true / false / 空欄で指定してください。`);
    }
    if (!record.photo_url) warnings.push(`${rowNumber}行目: photo_url が未入力です。`);
    if (!record.phone_number) warnings.push(`${rowNumber}行目: phone_number が未入力です。`);
    if (!record.opening_hours) warnings.push(`${rowNumber}行目: opening_hours が未入力です。`);
  });

  return { errors, warnings };
}

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(input).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, "0")}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export function buildPilotRows(records, nowIso = new Date().toISOString()) {
  const restaurants = [];
  const restaurantSources = [];

  for (const record of records) {
    const identity = record.place_id || `${record.name}|${record.area}`;
    const restaurantId = deterministicUuid(`meshimatch:pilot:restaurant:${identity}`);
    const openNow = parseBoolean(record.open_now ?? "");
    const hasOpeningHours = openNow !== null || Boolean(record.opening_hours);
    restaurants.push({
      id: restaurantId,
      name: record.name,
      name_en: null,
      lat: parseCoordinate(record.lat ?? ""),
      lng: parseCoordinate(record.lng ?? ""),
      nearest_area: record.area,
      genre_id: record.genre_id,
      price_band: record.budget,
      address: record.address || null,
      url: record.map_url || null,
      photo_url: record.photo_url || null,
      phone_number: record.phone_number || null,
      access_note: record.access_note || null,
      closed: false,
      place_id: record.place_id || null,
      rating: null,
      opening_hours: hasOpeningHours
        ? {
            ...(openNow === null ? {} : { openNow }),
            ...(record.opening_hours ? { text: record.opening_hours } : {}),
          }
        : null,
      opening_hours_source: hasOpeningHours ? "official_input" : null,
      opening_hours_updated_at: hasOpeningHours ? nowIso : null,
      catalog_source: null,
      external_id: `pilot:${crypto.createHash("sha1").update(identity).digest("hex").slice(0, 20)}`,
      updated_at: nowIso,
    });
    restaurantSources.push({
      id: deterministicUuid(`meshimatch:pilot:source:${identity}`),
      restaurant_id: restaurantId,
      source_type: "endorsement",
      visibility: "public",
      added_by: config.curatorProfileId,
      display_label: config.sourceLabel,
      note: record.why_good,
      pr: false,
      created_at: nowIso,
    });
  }

  return { restaurants, restaurantSources };
}

function upsertById(rows, additions) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  let inserted = 0;
  let updated = 0;
  for (const addition of additions) {
    if (byId.has(addition.id)) updated += 1;
    else inserted += 1;
    byId.set(addition.id, { ...byId.get(addition.id), ...addition });
  }
  return { rows: [...byId.values()], inserted, updated };
}

export function applyPilotRowsToLocalDb(db, rows, nowIso = new Date().toISOString()) {
  const profile = {
    id: config.curatorProfileId,
    display_name: config.curatorName,
    bio: "MeshiMatchの実験用に、運営が確認した店舗だけを公開しています。",
    allergies: [],
    usual_areas: [],
    favorite_genres: [],
    dietary_restrictions: [],
    created_at: nowIso,
    updated_at: nowIso,
  };
  const grant = {
    id: deterministicUuid(`meshimatch:pilot:grant:${config.curatorProfileId}`),
    profile_id: config.curatorProfileId,
    granted_at: nowIso,
    granted_by: null,
    note: "MeshiMatch 30〜50店パイロットの公式キュレーター",
    created_at: nowIso,
  };

  const profileResult = upsertById(db.profiles ?? [], [profile]);
  const grantResult = upsertById(db.official_verification_grants ?? [], [grant]);
  const restaurantResult = upsertById(db.restaurants ?? [], rows.restaurants);
  const sourceResult = upsertById(db.restaurant_sources ?? [], rows.restaurantSources);

  return {
    db: {
      ...db,
      profiles: profileResult.rows,
      official_verification_grants: grantResult.rows,
      restaurants: restaurantResult.rows,
      restaurant_sources: sourceResult.rows,
    },
    counts: {
      restaurants: { inserted: restaurantResult.inserted, updated: restaurantResult.updated },
      sources: { inserted: sourceResult.inserted, updated: sourceResult.updated },
    },
  };
}

function readArg(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

export function runCli(args = process.argv.slice(2)) {
  const inputPath = path.resolve(readArg(args, "--input", defaultInputPath));
  const dbPath = path.resolve(readArg(args, "--db", defaultDbPath));
  const allowPartial = args.includes("--allow-partial");
  const writeLocal = args.includes("--write-local");

  const records = parseCsv(fs.readFileSync(inputPath, "utf8"));
  const validation = validatePilotRecords(records, { allowPartial });
  const summary = {
    input: path.relative(repoRoot, inputPath),
    mode: writeLocal ? "write-local" : "dry-run",
    restaurants: records.length,
    errors: validation.errors,
    warnings: validation.warnings,
  };

  if (validation.errors.length > 0) {
    console.log(JSON.stringify(summary, null, 2));
    return 1;
  }
  if (writeLocal && records.length === 0) {
    console.log(JSON.stringify({ ...summary, errors: ["0件のため書き込みません。"] }, null, 2));
    return 1;
  }

  if (!writeLocal) {
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const rows = buildPilotRows(records);
  const applied = applyPilotRowsToLocalDb(db, rows);
  const backupPath = `${dbPath}.bak-pilot-pool`;
  const tempPath = `${dbPath}.tmp-pilot-pool`;
  fs.copyFileSync(dbPath, backupPath);
  fs.writeFileSync(tempPath, `${JSON.stringify(applied.db, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, dbPath);
  console.log(
    JSON.stringify(
      {
        ...summary,
        backup: path.relative(repoRoot, backupPath),
        applied: applied.counts,
        pilotCuratorProfileId: config.curatorProfileId,
      },
      null,
      2
    )
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCli();
}
