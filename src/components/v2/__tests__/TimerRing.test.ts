import { describe, expect, it } from "vitest";
import { clampTimerSeconds, getTimerRingPercent } from "@/components/v2/TimerRing";

describe("timer ring math", () => {
  it("converts remaining seconds to a conic-gradient percent", () => {
    expect(getTimerRingPercent(7, 10)).toBe(70);
    expect(getTimerRingPercent(3, 12)).toBe(25);
  });

  it("clamps seconds into the countdown range", () => {
    expect(clampTimerSeconds(14, 10)).toBe(10);
    expect(clampTimerSeconds(-2, 10)).toBe(0);
    expect(clampTimerSeconds(Number.NaN, 10)).toBe(0);
  });

  it("returns zero percent for invalid totals", () => {
    expect(getTimerRingPercent(5, 0)).toBe(0);
    expect(getTimerRingPercent(5, Number.NaN)).toBe(0);
  });
});
