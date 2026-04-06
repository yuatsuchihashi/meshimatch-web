"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const tabs = [
    {
      href: "/home",
      label: t("nav.home"),
      iconLine: "/icons/house_line.svg",
      iconFill: "/icons/house_fill.svg",
    },
    {
      href: "/profile",
      label: t("nav.profile"),
      iconLine: "/icons/me_line.svg",
      iconFill: "/icons/me_fill.svg",
    },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border-light)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 12,
              paddingBottom: 12,
              gap: 4,
              color: active ? "var(--primary)" : "var(--text-tertiary)",
              textDecoration: "none",
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              letterSpacing: "0.02em",
              transition: "color 0.2s ease",
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Image
                src={active ? tab.iconFill : tab.iconLine}
                alt={tab.label}
                width={22}
                height={22}
                style={{
                  filter: active
                    ? "brightness(0) saturate(100%) invert(42%) sepia(30%) saturate(800%) hue-rotate(340deg) brightness(90%)"
                    : "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(300%) hue-rotate(200deg) brightness(100%)",
                }}
              />
            </div>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
