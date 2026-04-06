import { NextRequest, NextResponse } from "next/server";
import { searchStations } from "@/lib/recommendation/station-graph";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (query.length === 0) {
    return NextResponse.json({ stations: [] });
  }

  const results = searchStations(query, 8);

  return NextResponse.json({
    stations: results.map((s) => ({
      id: s.id,
      name: s.name,
      lines: s.line_ids.map((lid) => {
        const parts = lid.split("_");
        return parts.length > 1 ? parts[1] : lid;
      }),
    })),
  });
}
