"use client";

import { signUp } from "@/actions/auth";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import Link from "next/link";
import { useActionState } from "react";
import { useLocale } from "@/lib/i18n";

export default function SignupPage() {
  const { t } = useLocale();
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
        <h1 className="text-2xl font-bold text-white">{t("auth.signup.title")}</h1>
        <p className="text-white/60 text-sm mt-1">{t("auth.signup.subtitle")}</p>
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
        label={t("auth.signup.displayName")}
        placeholder={t("auth.signup.displayNamePlaceholder")}
        required
      />
      <GlassInput
        id="email"
        name="email"
        type="email"
        label={t("auth.signup.email")}
        placeholder="you@example.com"
        required
      />
      <GlassInput
        id="password"
        name="password"
        type="password"
        label={t("auth.signup.password")}
        placeholder={t("auth.signup.passwordPlaceholder")}
        minLength={8}
        required
      />

      <GlassButton type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? t("auth.signup.submitting") : t("auth.signup.submit")}
      </GlassButton>

      <p className="text-white/60 text-sm text-center">
        {t("auth.signup.hasAccount")}{" "}
        <Link href="/login" className="text-white underline font-medium">
          {t("auth.signup.login")}
        </Link>
      </p>
    </form>
  );
}
