"use client";

import { signIn } from "@/actions/auth";
import { PillButton } from "@/components/v2";
import Link from "next/link";
import type { InputHTMLAttributes } from "react";
import { useActionState } from "react";
import { useLocale } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await signIn(formData);
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
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--v2-ink)", lineHeight: 1.3, letterSpacing: "var(--v2-tracking-display)" }}>{t("auth.login.title")}</h1>
        <p style={{ color: "var(--v2-muted)", fontSize: 14, marginTop: 6 }}>{t("auth.login.subtitle")}</p>
      </div>

      {state?.error && (
        <p style={{ color: "var(--v2-accent)", background: "var(--v2-tint-blush)", borderRadius: 16, padding: "10px 14px", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
          {state.error}
        </p>
      )}

      <AuthInput
        id="email"
        name="email"
        type="email"
        label={t("auth.login.email")}
        placeholder="you@example.com"
        required
      />
      <AuthInput
        id="password"
        name="password"
        type="password"
        label={t("auth.login.password")}
        placeholder="••••••••"
        required
      />

      <PillButton type="submit" variant="cta" disabled={pending}>
        {pending ? t("auth.login.submitting") : t("auth.login.submit")}
      </PillButton>

      <div className="flex items-center gap-3">
        <div style={{ flex: 1, height: 1, background: "var(--v2-border)" }} />
        <span style={{ color: "var(--v2-faint)", fontSize: 12, fontWeight: 700 }}>{t("auth.login.or")}</span>
        <div style={{ flex: 1, height: 1, background: "var(--v2-border)" }} />
      </div>

      <a
        href="/api/auth/line/start"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: 52, borderRadius: 100, background: "var(--v2-surface)",
          border: "1px solid var(--v2-border)", color: "var(--v2-ink)",
          fontWeight: 800, fontSize: 15, textDecoration: "none",
        }}
      >
        {t("auth.login.line")}
      </a>

      <p style={{ color: "var(--v2-muted)", fontSize: 14, textAlign: "center" }}>
        {t("auth.login.noAccount")}{" "}
        <Link href="/signup" style={{ color: "var(--v2-ink)", fontWeight: 700, textDecoration: "underline" }}>
          {t("auth.login.signup")}
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
