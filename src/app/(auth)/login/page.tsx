"use client";

import { signIn } from "@/actions/auth";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await signIn(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="glass-strong p-8 max-w-sm w-full flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">ログイン</h1>
        <p className="text-white/60 text-sm mt-1">MeshiMatchへようこそ</p>
      </div>

      {state?.error && (
        <p className="text-red-300 text-sm text-center bg-red-500/10 rounded-xl px-4 py-2">
          {state.error}
        </p>
      )}

      <GlassInput
        id="email"
        name="email"
        type="email"
        label="メールアドレス"
        placeholder="you@example.com"
        required
      />
      <GlassInput
        id="password"
        name="password"
        type="password"
        label="パスワード"
        placeholder="••••••••"
        required
      />

      <GlassButton type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "ログイン中..." : "ログイン"}
      </GlassButton>

      <p className="text-white/60 text-sm text-center">
        アカウントがない方は{" "}
        <Link href="/signup" className="text-white underline font-medium">
          新規登録
        </Link>
      </p>
    </form>
  );
}
