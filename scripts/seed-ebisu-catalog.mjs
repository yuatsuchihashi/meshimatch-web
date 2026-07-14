#!/usr/bin/env node
// R6a Ebisu catalog seed.
// Default mode is fixture dry-run: no Google calls and no external writes.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EBISU_FIXTURE_GENRE_BY_PLACE_ID,
  TAXONOMY_GENRES,
} from "./genre-space.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "src/lib/places/__fixtures__/ebisu-restaurants.json"
);

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const dryRun = true;

if (args.has("--write-local")) {
  console.error("Local DB writes are not part of R6a. Default dry-run prints the catalog rows.");
  process.exit(1);
}

function failLiveApproval() {
  console.error(
    [
      "Google Places live seeding is blocked: API budget is pending founder approval.",
      "This script will not make real Google Places API calls in R6a.",
      "Required later: PLACES_SEED_APPROVED=1, GOOGLE_PLACES_API_KEY, and GOOGLE_PLACES_LIVE=1.",
    ].join("\n")
  );
  process.exit(1);
}

if (live) {
  if (
    process.env.PLACES_SEED_APPROVED !== "1" ||
    !process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_PLACES_LIVE !== "1"
  ) {
    failLiveApproval();
  }
  console.error(
    "Live seeding is intentionally not implemented in R6a. Use recorded fixtures until budget approval work is scheduled."
  );
  process.exit(1);
}

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(input).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function priceBand(priceLevel) {
  switch (priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return "¥2,000〜¥3,000";
    case "PRICE_LEVEL_MODERATE":
      return "¥3,000〜¥5,000";
    case "PRICE_LEVEL_EXPENSIVE":
      return "¥5,000〜¥8,000";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "¥8,000〜";
    default:
      return null;
  }
}

function buildRows(fixture) {
  const fetchedAt = "2026-07-12T00:00:00.000Z";
  const expiresAt = "2026-08-11T00:00:00.000Z";
  const restaurants = [];
  const restaurantSources = [];
  const placesCache = [];

  for (const place of fixture.places) {
    const restaurantId = deterministicUuid(`meshimatch:r6a:restaurant:${place.id}`);
    restaurants.push({
      id: restaurantId,
      name: place.displayName?.text ?? place.id,
      name_en: null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      nearest_area: "恵比寿",
      genre_id: EBISU_FIXTURE_GENRE_BY_PLACE_ID[place.id] ?? TAXONOMY_GENRES.other,
      price_band: priceBand(place.priceLevel),
      address: place.formattedAddress ?? null,
      url: null,
      photo_url: null,
      closed: place.businessStatus === "CLOSED_PERMANENTLY",
      place_id: place.id,
      rating: null,
      opening_hours: null,
      opening_hours_source: null,
      opening_hours_updated_at: null,
      catalog_source: "catalog",
      external_id: `place:${place.id}`,
    });
    restaurantSources.push({
      id: deterministicUuid(`meshimatch:r6a:source:${place.id}`),
      restaurant_id: restaurantId,
      source_type: "catalog",
      visibility: "private",
      added_by: null,
      display_label: null,
      note: "R6a Ebisu fixture catalog row. Not a trust-ring candidate.",
      pr: false,
    });
    placesCache.push({
      place_id: place.id,
      raw_details: place,
      fetched_at: fetchedAt,
      expires_at: expiresAt,
      source: "fixture",
    });
  }

  return { restaurants, restaurantSources, placesCache };
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
if (fixture._fixture !== true) {
  throw new Error("Refusing to seed from an unmarked fixture file.");
}

const rows = buildRows(fixture);
const output = {
  dryRun,
  live: false,
  fixture: path.relative(repoRoot, fixturePath),
  notice: fixture.fixtureNotice,
  counts: {
    restaurants: rows.restaurants.length,
    restaurant_sources: rows.restaurantSources.length,
    places_cache: rows.placesCache.length,
  },
  rows,
};

console.log(JSON.stringify(output, null, 2));
