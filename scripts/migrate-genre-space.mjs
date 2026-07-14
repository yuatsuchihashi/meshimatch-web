#!/usr/bin/env node
// One-time migration from legacy mockData genre IDs to restaurant-taxonomy IDs.

import fs from "node:fs";
import path from "node:path";
import { LEGACY_MOCKDATA_TO_TAXONOMY_GENRE } from "./genre-space.mjs";

const MIGRATION_KEY = "genre_space";
const MIGRATION_VALUE = "taxonomy-v2";
const BACKUP_SUFFIX = ".bak-genre-migration";

function parseArgs(argv) {
  const options = {
    dryRun: false,
    dbPath: path.join(process.cwd(), ".localdb", "db.json"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--db") {
      const value = argv[i + 1];
      if (!value) throw new Error("--db requires a path");
      options.dbPath = path.resolve(value);
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function emptyReport() {
  return {
    targetRows: 0,
    mappedRows: 0,
    unchangedRows: 0,
    unmappedRows: 0,
    byMapping: {},
    unmappedByGenre: {},
  };
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] ?? 0) + amount;
}

function analyzeRestaurants(restaurants) {
  const report = emptyReport();

  for (const restaurant of restaurants) {
    if (!String(restaurant.external_id ?? "").startsWith("overture:")) continue;

    report.targetRows += 1;
    const from = restaurant.genre_id;
    const to = LEGACY_MOCKDATA_TO_TAXONOMY_GENRE[from];

    if (!to) {
      report.unmappedRows += 1;
      increment(report.unmappedByGenre, from ?? "(missing)");
      continue;
    }

    if (from === to) {
      report.unchangedRows += 1;
    } else {
      report.mappedRows += 1;
    }
    increment(report.byMapping, `${from}->${to}`);
  }

  return report;
}

function formatReport({ dbPath, dryRun, alreadyApplied, report }) {
  const lines = [
    `db: ${dbPath}`,
    `mode: ${dryRun ? "dry-run" : "write"}`,
    `migration: ${MIGRATION_KEY}=${MIGRATION_VALUE}`,
    `alreadyApplied: ${alreadyApplied ? "yes" : "no"}`,
    `target overture rows: ${report.targetRows}`,
    `mapped rows: ${report.mappedRows}`,
    `unchanged rows: ${report.unchangedRows}`,
    `unmapped rows: ${report.unmappedRows}`,
    "by legacy->taxonomy:",
  ];

  const mappings = Object.entries(report.byMapping).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  if (mappings.length === 0) {
    lines.push("  (none)");
  } else {
    for (const [mapping, count] of mappings) {
      lines.push(`  ${mapping}: ${count}`);
    }
  }

  if (report.unmappedRows > 0) {
    lines.push("unmapped by genre_id:");
    const unmapped = Object.entries(report.unmappedByGenre).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [genreId, count] of unmapped) {
      lines.push(`  ${genreId}: ${count}`);
    }
  }

  return lines.join("\n");
}

function migrateRestaurants(restaurants) {
  for (const restaurant of restaurants) {
    if (!String(restaurant.external_id ?? "").startsWith("overture:")) continue;
    const nextGenre = LEGACY_MOCKDATA_TO_TAXONOMY_GENRE[restaurant.genre_id];
    if (nextGenre) restaurant.genre_id = nextGenre;
  }
}

const options = parseArgs(process.argv.slice(2));
const db = JSON.parse(fs.readFileSync(options.dbPath, "utf-8"));
const alreadyApplied = db.migrations?.[MIGRATION_KEY] === MIGRATION_VALUE;
const restaurants = Array.isArray(db.restaurants) ? db.restaurants : [];
const report = alreadyApplied ? emptyReport() : analyzeRestaurants(restaurants);

console.log(formatReport({ ...options, alreadyApplied, report }));

if (alreadyApplied || options.dryRun) {
  process.exit(0);
}

if (report.unmappedRows > 0) {
  throw new Error("refusing to migrate while unmapped overture genre_id values remain");
}

const backupPath = `${options.dbPath}${BACKUP_SUFFIX}`;
if (fs.existsSync(backupPath)) {
  throw new Error(`backup already exists: ${backupPath}`);
}

fs.copyFileSync(options.dbPath, backupPath);
migrateRestaurants(restaurants);
db.migrations = { ...(db.migrations ?? {}), [MIGRATION_KEY]: MIGRATION_VALUE };
fs.writeFileSync(options.dbPath, JSON.stringify(db, null, 2));
console.log(`wrote migration and backup: ${backupPath}`);
