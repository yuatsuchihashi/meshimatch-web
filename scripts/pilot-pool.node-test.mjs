import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPilotRowsToLocalDb,
  buildPilotRows,
  parseCsv,
  validatePilotRecords,
} from "./pilot-pool.mjs";

const record = {
  name: "テスト食堂",
  area: "恵比寿",
  genre_id: "G004",
  budget: "¥2,000〜¥3,000",
  address: "東京都渋谷区恵比寿1-1-1",
  map_url: "https://maps.google.com/test",
  place_id: "test-place",
  photo_url: "https://example.com/photo.jpg",
  phone_number: "03-0000-0000",
  access_note: "恵比寿駅徒歩4分",
  lat: "35.6467",
  lng: "139.7101",
  open_now: "true",
  opening_hours: "11:30〜22:00",
  why_good: "4人で話しやすい",
};

test("parses quoted CSV fields", () => {
  const rows = parseCsv('name,area,why_good\n"店, 一号",恵比寿,"静か, 席が広い"\n');
  assert.equal(rows[0].name, "店, 一号");
  assert.equal(rows[0].why_good, "静か, 席が広い");
});

test("validates a partial pilot row without requiring 30 entries", () => {
  const result = validatePilotRecords([record], { allowPartial: true });
  assert.deepEqual(result.errors, []);
});

test("builds official pilot rows and upserts them idempotently", () => {
  const rows = buildPilotRows([record], "2026-08-02T00:00:00.000Z");
  assert.equal(rows.restaurants[0].phone_number, "03-0000-0000");
  assert.equal(rows.restaurants[0].opening_hours.openNow, true);
  assert.equal(rows.restaurantSources[0].source_type, "endorsement");

  const first = applyPilotRowsToLocalDb(
    { profiles: [], official_verification_grants: [], restaurants: [], restaurant_sources: [] },
    rows,
    "2026-08-02T00:00:00.000Z"
  );
  const second = applyPilotRowsToLocalDb(
    first.db,
    rows,
    "2026-08-02T00:00:00.000Z"
  );
  assert.deepEqual(first.counts.restaurants, { inserted: 1, updated: 0 });
  assert.deepEqual(second.counts.restaurants, { inserted: 0, updated: 1 });
  assert.equal(second.db.restaurants.length, 1);
  assert.equal(second.db.restaurant_sources.length, 1);
});
