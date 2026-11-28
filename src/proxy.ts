import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isLocalMode, LOCAL_AUTH_COOKIE } from "@/lib/local-mode";

// 認証不要のパス
// /api はクライアント fetch の宛先なので HTML リダイレクトさせない
// /groups はゲスト (招待リンク参加者) が投票・待機室にアクセスするため公開
// (グループIDは推測不能な UUID で、招待リンクと同等の扱い)
const PUBLIC_PATHS = ["/login", "/signup", "/callback", "/invite", "/api", "/groups"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    (isLocalMode() && (["/", "/home", "/profile", "/instant", "/instant/round", "/instant/top3", "/instant/ticket"].includes(pathname) || pathname === '/schedule' || pathname.startsWith('/schedule/') || pathname.startsWith('/area/') || pathname.startsWith('/shop/') || pathname.startsWith('/share/schedule/') || pathname.startsWith('/share/area/')));

  if (isLocalMode()) {
    // ローカルモード: httpOnly クッキーの有無だけで判定する
    // (edge runtime からは JSON ストアを読めないため)
    const hasSession = Boolean(request.cookies.get(LOCAL_AUTH_COOKIE)?.value);

    if (!hasSession && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (hasSession && (pathname === "/login" || pathname === "/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
