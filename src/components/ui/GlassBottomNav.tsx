"use client";

import { cn } from "@/lib/utils";
import { User, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/find", label: "Find", icon: Search },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function GlassBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong rounded-none border-t border-white/20 px-6 py-2 safe-area-bottom">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-200",
                isActive
                  ? "text-accent bg-accent/10"
                  : "text-foreground/50 hover:text-foreground/80 hover:bg-white/10"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
