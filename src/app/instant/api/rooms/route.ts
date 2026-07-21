import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { safeRoomZone } from "@/lib/instant/rooms";
import { nanoid } from "@/lib/utils/nanoid";

const MAX_CODE_ATTEMPTS = 8;

type CreateRoomBody = {
  partySize?: unknown;
  zone?: unknown;
  displayName?: unknown;
  profileId?: unknown;
};

function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return "ゲスト";
  return value.trim().slice(0, 40) || "ゲスト";
}

async function uniqueInviteCode(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = nanoid(6).toUpperCase();
    const { data, error } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!error && !data) return code;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateRoomBody;
  const partySize = Number(body.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) {
    return NextResponse.json(
      { error: "partySize must be an integer from 1 to 8" },
      { status: 400 }
    );
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const submittedProfileId =
    typeof body.profileId === "string" && body.profileId ? body.profileId : null;
  const profileId = user?.id ?? submittedProfileId;
  const displayName = cleanDisplayName(body.displayName);
  const zone = safeRoomZone(body.zone);
  const supabase = await createServiceClient();
  const code = await uniqueInviteCode(supabase);
  if (!code) {
    return NextResponse.json(
      { error: "could not allocate a unique room code" },
      { status: 503 }
    );
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: "今すぐごはん",
      invite_code: code,
      mode: "instant",
      group_size: partySize,
      session_atmosphere: "lively",
      session_focus: "balanced",
      created_by: profileId,
      shortlist: {
        kind: "instant_room_state",
        zone,
        proposal: null,
      },
    })
    .select("id, name, group_size, status")
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: groupError?.message ?? "room creation failed" },
      { status: 500 }
    );
  }

  const { data: member, error: memberError } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      profile_id: profileId,
      display_name: displayName,
      role: "owner",
      has_survey: false,
    })
    .select("id, display_name")
    .single();

  if (memberError || !member) {
    await supabase.from("groups").delete().eq("id", group.id);
    return NextResponse.json(
      { error: memberError?.message ?? "owner creation failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      room: {
        code,
        groupId: group.id,
        partySize,
      },
      member: {
        id: member.id,
        displayName: member.display_name,
      },
    },
    { status: 201 }
  );
}
