"use client";

import { useLocale, type Locale } from "@/lib/i18n";

// 言語切り替えピル (JA / EN)
// LPの「日本語・英語対応」をアプリ内どこでも切り替えられるようにする
export function LocaleToggle({ light = false }: { light?: boolean }) {
  const { locale, setLocale } = useLocale();

  const baseColor = light ? "rgba(255,255,255,0.7)" : "var(--text-tertiary)";
  const activeColor = light ? "#fff" : "var(--primary)";
  const activeBg = light ? "rgba(255,255,255,0.2)" : "rgba(240,90,40,0.12)";

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 100,
        border: `1px solid ${light ? "rgba(255,255,255,0.3)" : "var(--border)"}`,
      }}
    >
      {(["ja", "en"] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          aria-pressed={locale === lang}
          style={{
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 100,
            backgroundColor: locale === lang ? activeBg : "transparent",
            color: locale === lang ? activeColor : baseColor,
          }}
        >
          {lang === "ja" ? "日本語" : "EN"}
        </button>
      ))}
    </div>
  );
}
