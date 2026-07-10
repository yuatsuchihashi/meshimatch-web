import { describe, expect, it } from "vitest";
import {
  buildPlannedSurveyPayload,
  derivePreferenceMoodsFromGenrePreferences,
  getPlannedSurveyProfileDefaults,
} from "@/lib/survey-payload";
import type { UserProfile } from "@/lib/types";

const profile: UserProfile = {
  id: "u1",
  displayName: "ゆあ",
  usualDepartureStation: " 渋谷駅 ",
  allergyNote: "えび",
  dietaryNote: "豚肉NG",
  allergies: [],
  usualBudgetMaxYen: 6000,
  usualBudgetPriority: "prefer",
  usualAreas: [],
  favoriteGenres: [{ genreId: "G004", priority: "prefer" }],
  dislikedItems: [],
  dietaryRestrictions: [{ restrictionId: "vegan", priority: "prefer" }],
};

describe("survey payload helpers", () => {
  it("extracts planned-mode defaults from a profile", () => {
    const defaults = getPlannedSurveyProfileDefaults(profile);

    expect(defaults.departureStation).toBe("渋谷駅");
    expect(defaults.allergyNote).toBe("えび");
    expect(defaults.dietaryNote).toBe("豚肉NG");
    expect(defaults.budgetMaxYen).toBe(6000);
    expect(defaults.genrePreferences).toEqual([{ genreId: "G004", priority: "prefer" }]);
    expect(defaults.dietaryRestrictions).toEqual([
      { restrictionId: "vegan", priority: "prefer" },
    ]);
  });

  it("uses profile defaults unless the survey has a per-event diff", () => {
    const defaults = getPlannedSurveyProfileDefaults(profile);
    const payload = buildPlannedSurveyPayload({
      profileDefaults: defaults,
      preferMoods: ["meat"],
      avoidMoods: [],
      preferredAreas: ["恵比寿"],
    });

    expect(payload.departureStation).toBe("渋谷駅");
    expect(payload.budgetMaxYen).toBe(6000);
    expect(payload.genrePreferences).toEqual([{ genreId: "G004", priority: "prefer" }]);
    expect(payload.preferMoods).toEqual(["meat"]);
    expect(payload.preferredAreas).toEqual(["恵比寿"]);
  });

  it("stores only the final raw station and explicit diff values", () => {
    const defaults = getPlannedSurveyProfileDefaults(profile);
    const payload = buildPlannedSurveyPayload({
      profileDefaults: defaults,
      departureStation: " 新宿 ",
      budgetMaxYen: null,
      preferenceMoods: {
        prefer: ["fish"],
        avoid: ["kotteri"],
        changed: true,
      },
      preferMoods: ["sappari"],
      avoidMoods: [],
    });

    expect(payload.departureStation).toBe("新宿");
    expect(payload.budgetMaxYen).toBeNull();
    expect(payload.budgetPriority).toBeNull();
    expect(payload.genrePreferences).toEqual([
      { genreId: "G017", priority: "prefer" },
      { genreId: "G005", priority: "avoid" },
      { genreId: "G019", priority: "avoid" },
      { genreId: "G014", priority: "avoid" },
    ]);
  });

  it("preserves an existing per-event genre diff when editing and resubmitting collapsed", () => {
    const defaults = getPlannedSurveyProfileDefaults(profile);
    const existingGenrePreferences = [
      { genreId: "G017", priority: "prefer" as const },
      { genreId: "G005", priority: "avoid" as const },
      { genreId: "G019", priority: "avoid" as const },
      { genreId: "G014", priority: "avoid" as const },
    ];
    const payload = buildPlannedSurveyPayload({
      profileDefaults: defaults,
      existingGenrePreferences,
      preferMoods: ["meat"],
      avoidMoods: [],
      preferredAreas: ["新宿"],
    });

    expect(payload.genrePreferences).toEqual(existingGenrePreferences);
  });

  it("derives editor moods from saved genre preferences when possible", () => {
    expect(
      derivePreferenceMoodsFromGenrePreferences([
        { genreId: "G004", priority: "prefer" },
        { genreId: "G006", priority: "prefer" },
        { genreId: "G007", priority: "prefer" },
        { genreId: "G014", priority: "avoid" },
      ])
    ).toEqual({ prefer: ["asian"], avoid: ["noodles"] });
  });
});
