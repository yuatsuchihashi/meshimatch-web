// ============================================================
// /api/events – ファネル計測の受け口（プロバイダ非依存シンク）
// ============================================================
// クライアントの track() から送られるイベントを受け取り、ローカルの
// .localdb/events.jsonl に1行ずつ追記する（.localdb は gitignore 済み）。
// 将来は外部SaaSへの転送に差し替え可能。どんな入力でもUIを止めないよう
// 常に { ok: true } を返す（計測はベストエフォート）。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isLocalMode } from "@/lib/local-mode";

export const runtime = "nodejs";

const ANON_COOKIE = "mm_anon_id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const record = {
      event: typeof body.event === "string" ? body.event : "unknown",
      props: body.props ?? {},
      anonId: body.anonId || request.cookies.get(ANON_COOKIE)?.value || null,
      path: body.path ?? null,
      clientTs: body.ts ?? null,
      serverTs: new Date().toISOString(),
    };

    // ローカルモードのみファイルに永続化（本番の書込不可FSでは no-op）。
    if (isLocalMode()) {
      const file = path.join(process.cwd(), ".localdb", "events.jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf-8");
    }
  } catch {
    // 計測はベストエフォート。失敗しても握りつぶす。
  }

  return NextResponse.json({ ok: true });
}
