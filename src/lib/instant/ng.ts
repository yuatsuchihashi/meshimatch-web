import type { InstantRoundDraft } from "./round";

export const INSTANT_NG_PRESETS = [
  { key: "instant.ngSpicy" },
  { key: "instant.ngHeavy" },
  { key: "instant.ngAlcohol", restrictionId: "no_alcohol" },
  { key: "instant.ngGarlic" },
] as const;

export type InstantNgPreset = (typeof INSTANT_NG_PRESETS)[number];

export function toggleInstantNgDraft(
  draft: InstantRoundDraft,
  preset: InstantNgPreset,
  label: string
): InstantRoundDraft {
  const selected = draft.ngLabels.includes(label);
  const restrictionId = "restrictionId" in preset ? preset.restrictionId : null;
  const ngLabels = selected
    ? draft.ngLabels.filter((item) => item !== label)
    : [...draft.ngLabels, label];
  const dietaryRestrictions = restrictionId
    ? selected
      ? draft.dietaryRestrictions.filter(
          (item) => item.restrictionId !== restrictionId
        )
      : [
          ...draft.dietaryRestrictions,
          { restrictionId, priority: "must" as const },
        ]
    : draft.dietaryRestrictions;

  return { ...draft, ngLabels, dietaryRestrictions };
}
