// ローカルモード判定
// Supabase プロジェクトなしで全機能を動かす開発モード。
// .env.local で MESHIMATCH_LOCAL_MODE=1 / NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE=1 を設定する。
export function isLocalMode(): boolean {
  return (
    process.env.MESHIMATCH_LOCAL_MODE === "1" ||
    process.env.NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE === "1"
  );
}

export const LOCAL_AUTH_COOKIE = "mm_local_uid";
