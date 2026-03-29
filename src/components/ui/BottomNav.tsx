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
              paddingTop: 10,
              paddingBottom: 10,
              gap: 3,
              color: active ? "var(--primary)" : "var(--text-tertiary)",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              transition: "color 0.2s ease",
            }}
          >
            <Image
              src={active ? tab.iconFill : tab.iconLine}
              alt={tab.label}
              width={24}
              height={24}
              style={{
                filter: active
                  ? "brightness(0) saturate(100%) invert(54%) sepia(30%) saturate(700%) hue-rotate(340deg) brightness(90%)"
                  : "brightness(0) saturate(100%) invert(67%) sepia(10%) saturate(600%) hue-rotate(210deg) brightness(95%)",
              }}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
