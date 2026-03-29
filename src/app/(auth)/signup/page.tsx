"use client";

import { signUp } from "@/actions/auth";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import Link from "next/link";
import { useActionState } from "react";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await signUp(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="glass-strong p-8 max-w-sm w-full flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">新規登録</h1>
        <p className="text-white/60 text-sm mt-1">アカウントを作成しよう</p>
      </div>

      {state?.error && (
        <p className="text-red-300 text-sm text-center bg-red-500/10 rounded-xl px-4 py-2">
          {state.error}
        </p>
      )}

      <GlassInput
        id="display_name"
        name="display_name"
        type="text"
        label="表示名"
        placeholder="あなたの名前"
        required
      />
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
        placeholder="8文字以上"
        minLength={8}
        required
      />

      <GlassButton type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "登録中..." : "登録する"}
      </GlassButton>

      <p className="text-white/60 text-sm text-center">
        アカウントをお持ちの方は{" "}
        <Link href="/login" className="text-white underline font-medium">
          ログイン
        </Link>
      </p>
    </form>
  );
}
