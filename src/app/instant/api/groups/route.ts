import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildInstantGroupCreationRows } from "@/lib/instant/payload";
import type { InstantGroupCreationInput } from "@/lib/instant/types";

type InsertedMember = { id: string };

function isValidBody(body: Partial<InstantGroupCreationInput>) {
  const hasValidZone =
    body.zone === null ||
    Boolean(body.zone?.zoneId && body.zone?.station && body.zone?.name);
  return (
    hasValidZone &&
    typeof body.partySize === "number" &&
    body.partySize >= 2 &&
    body.partySize <= 8 &&
    Array.isArray(body.participants) &&
    body.participants.length === body.partySize
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<InstantGroupCreationInput>;
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "zone, partySize, and participants are required" },
      { status: 400 }
    );
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const createdBy = user?.id ?? body.createdBy ?? null;
  const rows = buildInstantGroupCreationRows({
    zone: body.zone!,
    partySize: body.partySize!,
    participants: body.participants!,
    createdBy,
  });

  const supabase = await createServiceClient();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert(rows.group)
    .select()
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: groupError?.message ?? "group creation failed" },
      { status: 500 }
    );
  }

  const memberRows = rows.members.map((member) => ({
    ...member,
    group_id: group.id,
  }));
  const { data: members, error: memberError } = await supabase
    .from("group_members")
    .insert(memberRows)
    .select("id");

  if (memberError || !members) {
    return NextResponse.json(
      { error: memberError?.message ?? "member creation failed" },
      { status: 500 }
    );
  }

  const surveyRows = rows.surveys.map((survey, index) => ({
    ...survey,
    group_id: group.id,
    member_id: ((members as InsertedMember[])[index] ?? {}).id,
  }));
  const { error: surveyError } = await supabase
    .from("survey_responses")
    .insert(surveyRows);

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 });
  }

  return NextResponse.json({ group, members }, { status: 201 });
}
