// ============================================================
// LINE ログイン – 認可リクエスト開始
// ============================================================
// state を httpOnly クッキーに保存してから LINE の認可画面へ飛ばす。
// コールバックは /callback/line (LINE Developers コンソールに登録必須)。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
  const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json(
      { error: "LINE channel is not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/callback/line`;

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", channelId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile openid");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("mm_line_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
