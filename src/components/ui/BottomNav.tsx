"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/home",
    label: "ホーム",
    icon: (active: boolean) => (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6h-6v6H3.75A.75.75 0 013 21V9.75z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "プロフィール",
    icon: (active: boolean) => (
      <svg width="24" height="24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
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
            {tab.icon(active)}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
