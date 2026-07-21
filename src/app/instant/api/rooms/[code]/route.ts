import { NextRequest, NextResponse } from "next/server";
import { GET as getRankedGroupResults } from "@/app/api/groups/results/route";
import {
  aggregateRoomTokens,
  normalizeRoomSurvey,
  rankInstantCatalogFallback,
  roomRestaurantFromRanked,
  roomStateFromShortlist,
  type RoomProposalState,
} from "@/lib/instant/rooms";
import {
  toRestaurant,
  type RestaurantRow,
} from "@/lib/restaurants/pool";
import { createServiceClient } from "@/lib/supabase/server";
import type { Restaurant } from "@/lib/types";

type RouteContext = { params: Promise<{ code: string }> };
type MemberRow = {
  id: string;
  display_name: string;
  profile_id: string | null;
  role: "owner" | "member";
  has_survey: boolean;
};
type DecisionRow = {
  restaurant_id: string | null;
  restaurant_name: string;
  genre_id: string | null;
  decided_at: string;
};
type VoteRow = {
  member_id: string;
  restaurant_id: string;
  vote: "yes" | "no";
};

function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return "ゲスト";
  return value.trim().slice(0, 40) || "ゲスト";
}

async function findRoom(code: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, invite_code, mode, group_size, status, shortlist")
    .eq("invite_code", code.trim().toUpperCase())
    .single();
  if (error || !data || data.mode !== "instant") return null;
  return { supabase, group: data };
}

async function findMembership(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  groupId: string,
  memberId: unknown
) {
  if (typeof memberId !== "string" || !memberId) return null;
  const { data } = await supabase
    .from("group_members")
    .select("id, display_name, profile_id, role, has_survey")
    .eq("id", memberId)
    .eq("group_id", groupId)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

function roomNotFound() {
  return NextResponse.json({ error: "room not found" }, { status: 404 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const found = await findRoom(code);
  if (!found) return roomNotFound();
  const { supabase, group } = found;
  const roomState = roomStateFromShortlist(group.shortlist);
  const proposal = roomState.proposal;
  const memberId = new URL(request.url).searchParams.get("member_id");

  const [
    { data: memberData, error: memberError },
    { data: surveyData, error: surveyError },
    { data: decisionData, error: decisionError },
    { data: voteData, error: voteError },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("id, display_name, has_survey")
      .eq("group_id", group.id),
    supabase
      .from("survey_responses")
      .select("genre_preferences, prefer_moods, avoid_moods")
      .eq("group_id", group.id),
    supabase
      .from("decisions")
      .select("restaurant_id, restaurant_name, genre_id, decided_at")
      .eq("group_id", group.id)
      .maybeSingle(),
    supabase
      .from("restaurant_votes")
      .select("member_id, restaurant_id, vote")
      .eq("group_id", group.id),
  ]);

  const queryError = memberError ?? surveyError ?? decisionError ?? voteError;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const members = ((memberData ?? []) as unknown as MemberRow[]).map(
    (member, index) => ({
      // Only the caller receives their real member id. Other seats use opaque
      // presentation keys so another participant cannot replay a private id.
      id: member.id === memberId ? member.id : `seat-${index + 1}`,
      displayName: member.display_name,
      hasSurvey: member.has_survey === true,
    })
  );
  const votes = (voteData ?? []) as unknown as VoteRow[];
  const proposalVotes = proposal
    ? votes.filter((vote) => vote.restaurant_id === proposal.restaurant.id)
    : [];
  const decision = (decisionData as DecisionRow | null) ?? null;

  return NextResponse.json({
    room: {
      code: group.invite_code,
      groupId: group.id,
      name: group.name,
      partySize: group.group_size,
      status: group.status,
      zone: roomState.zone,
      members,
      answeredCount: members.filter((member) => member.hasSurvey).length,
      aggregate: aggregateRoomTokens(
        surveyData ?? [],
        Number(group.group_size ?? members.length)
      ),
      proposal: proposal
        ? {
            restaurant: proposal.restaurant,
            revision: proposal.revision,
            proposedAt: proposal.proposedAt,
          }
        : null,
      decision: decision
        ? {
            restaurantId: decision.restaurant_id,
            restaurantName: decision.restaurant_name,
            genreId: decision.genre_id,
            decidedAt: decision.decided_at,
          }
        : null,
      myObjection: Boolean(
        memberId &&
          proposalVotes.some(
            (vote) => vote.member_id === memberId && vote.vote === "no"
          )
      ),
      objectionCount: proposalVotes.filter((vote) => vote.vote === "no").length,
    },
  });
}

async function joinRoom(
  found: NonNullable<Awaited<ReturnType<typeof findRoom>>>,
  body: Record<string, unknown>
) {
  const { supabase, group } = found;
  if (group.status !== "active") {
    return NextResponse.json({ error: "room is closed" }, { status: 409 });
  }
  const profileId =
    typeof body.profileId === "string" && body.profileId ? body.profileId : null;
  const displayName = cleanDisplayName(body.displayName);

  const { data: memberData, error: membersError } = await supabase
    .from("group_members")
    .select("id, display_name, profile_id, role, has_survey")
    .eq("group_id", group.id);
  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }
  const members = (memberData ?? []) as unknown as MemberRow[];
  // A signed-in profile is a stable identity and can safely resume its seat.
  // Guest display names are not identities: two different people may both be
  // "ゲスト", so an anonymous join always receives a separate seat.
  const existing = profileId
    ? members.find((member) => member.profile_id === profileId)
    : null;
  if (existing) {
    return NextResponse.json({
      room: { groupId: group.id },
      member: { id: existing.id, displayName: existing.display_name },
    });
  }
  if (members.length >= Number(group.group_size ?? 0)) {
    return NextResponse.json({ error: "room is full" }, { status: 409 });
  }

  const { data: member, error } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      profile_id: profileId,
      display_name: displayName,
      role: "member",
      has_survey: false,
    })
    .select("id, display_name")
    .single();
  if (error || !member) {
    return NextResponse.json(
      { error: error?.message ?? "join failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      room: { groupId: group.id },
      member: { id: member.id, displayName: member.display_name },
    },
    { status: 201 }
  );
}

async function saveSurvey(
  found: NonNullable<Awaited<ReturnType<typeof findRoom>>>,
  body: Record<string, unknown>
) {
  const { supabase, group } = found;
  const member = await findMembership(supabase, group.id, body.memberId);
  if (!member) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }
  const normalized = normalizeRoomSurvey(body);
  const roomState = roomStateFromShortlist(group.shortlist);
  const { error } = await supabase.from("survey_responses").upsert(
    {
      group_id: group.id,
      member_id: member.id,
      departure_area: roomState.zone?.name ?? null,
      departure_station: roomState.zone?.station ?? null,
      preferred_areas: roomState.zone ? [roomState.zone.name] : [],
      genre_preferences: normalized.genrePreferences,
      dietary_restrictions: normalized.dietaryRestrictions,
      allergy_note:
        typeof body.allergyNote === "string"
          ? body.allergyNote.trim().slice(0, 100)
          : null,
      dietary_note:
        typeof body.dietaryNote === "string"
          ? body.dietaryNote.trim().slice(0, 100)
          : null,
      prefer_moods: normalized.preferMoods,
      avoid_moods: normalized.avoidMoods,
      suggested_restaurants: [],
      response_version: 2,
    },
    { onConflict: "group_id,member_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error: memberError } = await supabase
    .from("group_members")
    .update({ has_survey: true })
    .eq("id", member.id);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  return NextResponse.json(
    { member: { id: member.id, hasSurvey: true } },
    { status: 201 }
  );
}

async function proposeRestaurant(
  request: NextRequest,
  found: NonNullable<Awaited<ReturnType<typeof findRoom>>>,
  body: Record<string, unknown>
) {
  const { supabase, group } = found;
  const member = await findMembership(supabase, group.id, body.memberId);
  if (!member) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }
  const requestedRevision = Number(body.revision);
  const roomState = roomStateFromShortlist(group.shortlist);
  const current = roomState.proposal;
  const expectedRevision = current ? current.revision + 1 : 0;
  if (
    !Number.isInteger(requestedRevision) ||
    requestedRevision !== expectedRevision ||
    requestedRevision > 1
  ) {
    return NextResponse.json(
      { error: "proposal revision conflict", expectedRevision },
      { status: 409 }
    );
  }

  const resultsRequest = new NextRequest(
    new URL(
      `/api/groups/results?group_id=${encodeURIComponent(group.id)}`,
      request.url
    )
  );
  const resultsResponse = await getRankedGroupResults(resultsRequest);
  const resultsBody = (await resultsResponse.json()) as {
    results?: Restaurant[];
    error?: string;
  };
  if (!resultsResponse.ok) {
    return NextResponse.json(
      { error: resultsBody.error ?? "ranking failed" },
      { status: resultsResponse.status }
    );
  }
  let ranked = resultsBody.results ?? [];
  if (ranked.length <= requestedRevision && roomState.zone?.name) {
    const [{ data: catalogRows }, { data: preferenceRows }] = await Promise.all([
      supabase
        .from("restaurants")
        .select("*")
        .eq("nearest_area", roomState.zone.name)
        .eq("closed", false),
      supabase
        .from("survey_responses")
        .select("genre_preferences")
        .eq("group_id", group.id),
    ]);
    ranked = rankInstantCatalogFallback(
      ((catalogRows ?? []) as unknown as RestaurantRow[])
        .slice(0, 240)
        .map(toRestaurant),
      preferenceRows ?? [],
      2
    );
  }
  const restaurant = ranked[requestedRevision];
  if (!restaurant) {
    return NextResponse.json(
      { error: requestedRevision === 0 ? "no ranked restaurant" : "no alternate restaurant" },
      { status: 409 }
    );
  }

  const proposal: RoomProposalState = {
    revision: requestedRevision as 0 | 1,
    proposedAt: new Date().toISOString(),
    restaurant: roomRestaurantFromRanked(restaurant),
  };
  const { error } = await supabase
    .from("groups")
    .update({
      shortlist: {
        kind: "instant_room_state",
        zone: roomState.zone,
        proposal,
      },
    })
    .eq("id", group.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    {
      proposal: {
        restaurant: proposal.restaurant,
        revision: proposal.revision,
        proposedAt: proposal.proposedAt,
      },
    },
    { status: 201 }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const found = await findRoom(code);
  if (!found) return roomNotFound();
  const body = (await request.json()) as Record<string, unknown>;

  switch (body.action) {
    case "join":
      return joinRoom(found, body);
    case "survey":
      return saveSurvey(found, body);
    case "propose":
      return proposeRestaurant(request, found, body);
    default:
      return NextResponse.json(
        { error: "action must be join, survey, or propose" },
        { status: 400 }
      );
  }
}
