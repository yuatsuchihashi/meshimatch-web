import { describe, expect, it } from "vitest";
import { PILOT_CURATOR_PROFILE_ID, includePilotCurator } from "@/lib/pilot-pool";

describe("pilot pool", () => {
  it("adds the pilot curator when the pilot flag is enabled", () => {
    expect(
      includePilotCurator(["friend"], { MESHIMATCH_PILOT_POOL: "1" }, false)
    ).toEqual(["friend", PILOT_CURATOR_PROFILE_ID]);
  });

  it("does not alter production follows when the pilot flag is disabled", () => {
    expect(
      includePilotCurator(["friend"], { MESHIMATCH_PILOT_POOL: "0" }, false)
    ).toEqual(["friend"]);
  });
});
