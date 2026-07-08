// ============================================================
// LINE ログイン – コールバック
// ============================================================
// 1. state 検証 (CSRF対策)
// 2. code → トークン交換 (Channel Secret 必須)
// 3. id_token を LINE の verify エンドポイントで検証して sub/name/picture を取得
// 4. ローカルモード: auth_users に取り込み、セッションクッキーを発行
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { isLocalMode, LOCAL_AUTH_COOKIE } from "@/lib/local-mode";
import { localLineSignIn } from "@/lib/localdb/engine";

function loginRedirect(request: NextRequest, error: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?error=${encodeURIComponent(error)}`;
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get("mm_line_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return loginRedirect(request, "line_state_mismatch");
  }

  const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    return loginRedirect(request, "line_not_configured");
  }

  // code → トークン
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/callback/line`,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[LINE login] token exchange failed:", await tokenRes.text());
    return loginRedirect(request, "line_token_failed");
  }

  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) {
    return loginRedirect(request, "line_no_id_token");
  }

  // id_token 検証 (署名検証は LINE 側の verify に任せる)
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!verifyRes.ok) {
    console.error("[LINE login] verify failed:", await verifyRes.text());
    return loginRedirect(request, "line_verify_failed");
  }

  const claims = (await verifyRes.json()) as {
    sub: string;
    name?: string;
    picture?: string;
  };

  if (!isLocalMode()) {
    // Supabase モードでの LINE ログインはデプロイ時に配線する
    // (Supabase に LINE プロバイダはないため、独自セッションが必要)
    return loginRedirect(request, "line_supabase_mode_todo");
  }

  const { userId, error } = localLineSignIn({
    lineUserId: claims.sub,
    displayName: claims.name ?? "LINEユーザー",
    pictureUrl: claims.picture ?? null,
  });

  if (error || !userId) {
    return loginRedirect(request, "line_signin_failed");
  }

  const url = request.nextUrl.clone();
  url.pathname = "/home";
  url.search = "";
  const response = NextResponse.redirect(url);
  response.cookies.set(LOCAL_AUTH_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.delete("mm_line_state");
  return response;
}
