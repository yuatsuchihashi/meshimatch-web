// ============================================================
// LocalDB – ブラウザクライアント用のクエリ/認証エンドポイント
// ============================================================
// ローカルモード限定。ブラウザ側 supabase 互換クライアントの
// クエリと auth.getUser / auth.signOut をエンジンに中継する。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { isLocalMode, LOCAL_AUTH_COOKIE } from "@/lib/local-mode";
import { executeLocalQuery, localGetUser } from "@/lib/localdb/engine";
import type { DbQuery } from "@/lib/localdb/builder";

export async function POST(request: NextRequest) {
  if (!isLocalMode()) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const body = await request.json();

  if (body.type === "query") {
    const result = executeLocalQuery(body.query as DbQuery);
    return NextResponse.json(result);
  }

  if (body.type === "auth") {
    if (body.action === "getUser") {
      const userId = request.cookies.get(LOCAL_AUTH_COOKIE)?.value ?? null;
      return NextResponse.json({ user: localGetUser(userId) });
    }
    if (body.action === "signOut") {
      const response = NextResponse.json({ ok: true });
      response.cookies.delete(LOCAL_AUTH_COOKIE);
      return response;
    }
  }

  return NextResponse.json({ error: "unknown request" }, { status: 400 });
}
