// ============================================================
// LocalDB – ブラウザ用クライアント (supabase-js 互換サブセット)
// ============================================================
// クエリと認証を /api/localdb 経由でサーバーのエンジンに委譲する。
// ============================================================

import { createBuilderFactory, type DbQuery, type DbResult } from "./builder";

async function execute(query: DbQuery): Promise<DbResult> {
  try {
    const res = await fetch("/api/localdb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "query", query }),
    });
    return (await res.json()) as DbResult;
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "network error" },
    };
  }
}

export function createLocalBrowserClient() {
  const auth = {
    async getUser() {
      try {
        const res = await fetch("/api/localdb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "auth", action: "getUser" }),
        });
        const json = await res.json();
        return {
          data: { user: json.user ?? null },
          error: json.user ? null : { message: "Auth session missing" },
        };
      } catch {
        return { data: { user: null }, error: { message: "network error" } };
      }
    },

    async signOut() {
      await fetch("/api/localdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "auth", action: "signOut" }),
      });
      return { error: null };
    },
  };

  return {
    ...createBuilderFactory(execute),
    auth,
  };
}
