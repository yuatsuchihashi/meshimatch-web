import type { InstantGroupCreationInput, InstantParticipantInput } from "./types";

export interface InstantGroupRows {
  group: Record<string, unknown>;
  members: Record<string, unknown>[];
  surveys: Omit<Record<string, unknown>, "member_id">[];
}

function instantGroupName(nowIso: string) {
  const date = new Date(nowIso);
  const label = Number.isNaN(date.getTime())
    ? nowIso
    : date.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  return `今からごはん ${label}`;
}

function participantSurvey(
  participant: InstantParticipantInput,
  zone: InstantGroupCreationInput["zone"]
) {
  return {
    departure_area: zone?.name ?? null,
    departure_station: zone?.station ?? null,
    preferred_areas: zone ? [zone.name] : [],
    genre_preferences: participant.genrePreferences,
    dietary_restrictions: participant.dietaryRestrictions,
    allergy_note: participant.allergyNote ?? null,
    dietary_note: participant.dietaryNote ?? null,
    prefer_moods: [],
    avoid_moods: [],
    suggested_restaurants: [],
    response_version: 2,
  };
}

export function buildInstantGroupCreationRows(
  input: InstantGroupCreationInput
): InstantGroupRows {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const group = {
    name: instantGroupName(nowIso),
    mode: "instant",
    group_size: input.partySize,
    session_atmosphere: "lively",
    session_focus: "balanced",
    created_by: input.createdBy ?? null,
  };

  return {
    group,
    members: input.participants.map((participant, index) => ({
      profile_id: participant.profileId ?? (index === 0 ? input.createdBy ?? null : null),
      display_name: participant.nickname || `Guest ${index + 1}`,
      role: index === 0 ? "owner" : "member",
      has_survey: true,
    })),
    surveys: input.participants.map((participant) =>
      participantSurvey(participant, input.zone)
    ),
  };
}

export function containsRawCoordinates(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsRawCoordinates(item));
  if (value == null || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (key === "lat" || key === "lng" || key === "latitude" || key === "longitude") {
      return true;
    }
    return containsRawCoordinates(nested);
  });
}
