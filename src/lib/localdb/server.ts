// ============================================================
// LocalDB – サーバー用クライアント (supabase-js 互換サブセット)
// ============================================================
// createClient() / createServiceClient() のローカルモード実装。
// クエリはエンジンを直接実行し、認証は httpOnly クッキーで管理する。
// ============================================================

import { cookies } from "next/headers";
import { LOCAL_AUTH_COOKIE } from "@/lib/local-mode";
import { createBuilderFactory, type DbQuery } from "./builder";
import {
  executeLocalQuery,
  localGetUser,
  localSignIn,
  localSignUp,
} from "./engine";

async function execute(query: DbQuery) {
  return executeLocalQuery(query);
}

export async function createLocalServerClient() {
  const cookieStore = await cookies();

  const auth = {
    async getUser() {
      const userId = cookieStore.get(LOCAL_AUTH_COOKIE)?.value ?? null;
      const user = localGetUser(userId);
      return {
        data: { user },
        error: user ? null : { message: "Auth session missing" },
      };
    },

    async signUp(params: {
      email: string;
      password: string;
      options?: { data?: { display_name?: string } };
    }) {
      const { userId, error } = localSignUp(
        params.email,
        params.password,
        params.options?.data?.display_name ?? ""
      );
      if (error || !userId) {
        return { data: { user: null }, error: { message: error ?? "signup failed" } };
      }
      try {
        cookieStore.set(LOCAL_AUTH_COOKIE, userId, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      } catch {
        // Server Component から呼ばれた場合は set 不可 (server action では成功する)
      }
      return {
        data: { user: { id: userId, email: params.email } },
        error: null,
      };
    },

    async signInWithPassword(params: { email: string; password: string }) {
      const { userId, error } = localSignIn(params.email, params.password);
      if (error || !userId) {
        return { data: { user: null }, error: { message: error ?? "login failed" } };
      }
      try {
        cookieStore.set(LOCAL_AUTH_COOKIE, userId, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      } catch {
        // noop
      }
      return {
        data: { user: { id: userId, email: params.email } },
        error: null,
      };
    },

    async signOut() {
      try {
        cookieStore.delete(LOCAL_AUTH_COOKIE);
      } catch {
        // noop
      }
      return { error: null };
    },

    async exchangeCodeForSession() {
      // ローカルモードではメール確認フローは存在しない
      return { data: { user: null }, error: null };
    },
  };

  return {
    ...createBuilderFactory(execute),
    auth,
  };
}
