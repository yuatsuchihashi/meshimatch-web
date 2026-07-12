import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.join(process.cwd(), "scripts/seed-ebisu-catalog.mjs");

describe("seed-ebisu-catalog", () => {
  it("prints fixture-backed catalog rows in default dry-run mode", () => {
    const stdout = execFileSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: { ...process.env, GOOGLE_PLACES_API_KEY: "", GOOGLE_PLACES_LIVE: "" },
    });
    const output = JSON.parse(stdout) as {
      dryRun: boolean;
      counts: { restaurants: number; restaurant_sources: number; places_cache: number };
      rows: {
        restaurants: { catalog_source: string; rating: null; place_id: string }[];
        restaurantSources: { source_type: string; added_by: null }[];
        placesCache: { raw_details: unknown; expires_at: string }[];
      };
      notice: string;
    };

    expect(output.dryRun).toBe(true);
    expect(output.counts).toEqual({
      restaurants: 8,
      restaurant_sources: 8,
      places_cache: 8,
    });
    expect(output.notice).toContain("fixture");
    expect(output.rows.restaurants[0]).toMatchObject({
      catalog_source: "catalog",
      rating: null,
      place_id: "fixtures/ebisu-test-a",
    });
    expect(output.rows.restaurantSources[0]).toMatchObject({
      source_type: "catalog",
      added_by: null,
    });
    expect(output.rows.placesCache[0].expires_at).toBe("2026-08-11T00:00:00.000Z");
  });

  it("refuses --live without budget approval env", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--live"], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        PLACES_SEED_APPROVED: "",
        GOOGLE_PLACES_API_KEY: "",
        GOOGLE_PLACES_LIVE: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("API budget is pending founder approval");
  });
});
