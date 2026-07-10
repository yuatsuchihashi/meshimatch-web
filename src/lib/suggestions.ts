import type { SuggestPick } from "@/components/survey/SuggestPicker";

export interface SuggestedRestaurantPayload {
  id: string;
  name: string;
  showName: boolean;
  pr: boolean;
}

export function buildSuggestedRestaurantPayload(params: {
  picks: SuggestPick[];
  showName: boolean;
  isVerified: boolean;
  pr: boolean;
}): SuggestedRestaurantPayload[] {
  const disclosure = params.isVerified && params.pr;
  return params.picks.map((pick) => ({
    id: pick.id,
    name: pick.name,
    showName: params.showName,
    pr: disclosure,
  }));
}
