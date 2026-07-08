"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      {active && <circle cx="13" cy="13" r="11" fill="currentColor" opacity="0.12" />}
      <path
        d="M5.4 12.2 13 5.8l7.6 6.4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 12.4v6.3c0 .7.5 1.2 1.2 1.2h8.8c.7 0 1.2-.5 1.2-1.2v-6.3"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.7 15.4h6.6c-.4 1.9-1.7 3-3.3 3s-2.9-1.1-3.3-3Z"
        fill={active ? "currentColor" : "var(--surface)"}
        stroke="currentColor"
        strokeWidth={1.55}
        strokeLinejoin="round"
      />
      <path
        d="M11.2 13.6c-.3-.5.4-.9.1-1.4M14.8 13.6c-.3-.5.4-.9.1-1.4"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      {active && <circle cx="13" cy="13" r="11" fill="currentColor" opacity="0.12" />}
      <circle
        cx="13"
        cy="10.6"
        r="3.3"
        fill={active ? "currentColor" : "var(--surface)"}
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
      />
      <path
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        d="M6.8 21c.7-3.3 3-5 6.2-5s5.5 1.7 6.2 5"
      />
      <path
        d="M18.4 6.6c.8.2 1.4.9 1.4 1.8 0 1-.8 1.8-1.8 1.8h-.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.45}
        strokeLinecap="round"
      />
      <circle cx="18.3" cy="6.2" r="1.6" fill={active ? "currentColor" : "var(--surface)"} stroke="currentColor" strokeWidth={1.35} />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const tabs = [
    { href: "/home", label: t("nav.home"), Icon: HomeIcon },
    { href: "/profile", label: t("nav.profile"), Icon: ProfileIcon },
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
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
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
            <Icon active={active} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
