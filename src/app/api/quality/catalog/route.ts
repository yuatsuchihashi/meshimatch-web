import { NextResponse } from "next/server";
import { getLabelingCatalogRestaurants } from "@/lib/labeling/catalog";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  return NextResponse.json({ restaurants: getLabelingCatalogRestaurants() });
}
