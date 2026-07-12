import { describe, expect, it } from "vitest";
import { getChipClassName, type ChipVariant } from "@/components/v2/Chip";

describe("getChipClassName", () => {
  it("keeps the default chip on the base class only", () => {
    expect(getChipClassName()).toBe("v2-chip");
  });

  it("adds the selected and state variant classes", () => {
    const variants: ChipVariant[] = ["selected", "sage", "honey", "blush"];

    for (const variant of variants) {
      expect(getChipClassName(variant)).toContain(`v2-chip--${variant}`);
    }
  });

  it("preserves caller classes", () => {
    expect(getChipClassName("sage", "extra-class")).toBe("v2-chip v2-chip--sage extra-class");
  });
});
