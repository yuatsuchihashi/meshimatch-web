"use client";

import { signUp } from "@/actions/auth";
import { PillButton } from "@/components/v2";
import Link from "next/link";
import type { InputHTMLAttributes } from "react";
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
    <form
      action={formAction}
      style={{
        width: "100%",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius-card)",
        background: "var(--v2-surface)",
        boxShadow: "var(--v2-shadow)",
        padding: "32px 24px 28px",
      }}
    >
      <div className="text-center">
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--v2-ink)", lineHeight: 1.3, letterSpacing: "var(--v2-tracking-display)" }}>{t("auth.signup.title")}</h1>
        <p style={{ color: "var(--v2-muted)", fontSize: 14, marginTop: 6 }}>{t("auth.signup.subtitle")}</p>
      </div>

      {state?.error && (
        <p style={{ color: "var(--v2-accent)", background: "var(--v2-tint-blush)", borderRadius: 16, padding: "10px 14px", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
          {state.error}
        </p>
      )}

      <AuthInput
        id="display_name"
        name="display_name"
        type="text"
        label={t("auth.signup.displayName")}
        placeholder={t("auth.signup.displayNamePlaceholder")}
        required
      />
      <AuthInput
        id="email"
        name="email"
        type="email"
        label={t("auth.signup.email")}
        placeholder="you@example.com"
        required
      />
      <AuthInput
        id="password"
        name="password"
        type="password"
        label={t("auth.signup.password")}
        placeholder={t("auth.signup.passwordPlaceholder")}
        minLength={8}
        required
      />

      <PillButton type="submit" variant="cta" disabled={pending}>
        {pending ? t("auth.signup.submitting") : t("auth.signup.submit")}
      </PillButton>

      <p style={{ color: "var(--v2-muted)", fontSize: 14, textAlign: "center" }}>
        {t("auth.signup.hasAccount")}{" "}
        <Link href="/login" style={{ color: "var(--v2-ink)", fontWeight: 700, textDecoration: "underline" }}>
          {t("auth.signup.login")}
        </Link>
      </p>
    </form>
  );
}

function AuthInput({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label htmlFor={id} style={{ color: "var(--v2-ink)", fontSize: 13, fontWeight: 800 }}>
        {label}
      </label>
      <input
        id={id}
        style={{
          width: "100%",
          minHeight: 52,
          border: "1px solid var(--v2-border)",
          borderRadius: "var(--v2-radius-input)",
          background: "var(--v2-surface-soft)",
          color: "var(--v2-ink)",
          padding: "0 16px",
          fontSize: 16,
          outline: "none",
        }}
        {...props}
      />
    </div>
  );
}
