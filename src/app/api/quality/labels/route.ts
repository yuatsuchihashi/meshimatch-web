import { NextRequest, NextResponse } from "next/server";
import {
  readFounderLabels,
  upsertFounderLabel,
  type FounderLabelInput,
} from "@/lib/labeling/labels";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  return NextResponse.json({ labels: readFounderLabels() });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Partial<FounderLabelInput>;
    const row = upsertFounderLabel({
      external_id: String(body.external_id ?? ""),
      place_id: String(body.place_id ?? ""),
      name: String(body.name ?? ""),
      label: body.label as FounderLabelInput["label"],
      memo: String(body.memo ?? ""),
    });
    return NextResponse.json({ label: row });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid request" },
      { status: 400 }
    );
  }
}
