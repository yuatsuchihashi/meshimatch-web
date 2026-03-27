"use client";

import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  content: ReactNode;
};

type GlassTabsProps = {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
};

export function GlassTabs({ tabs, defaultTab, className }: GlassTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="glass-strong flex gap-1 p-1 rounded-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2 px-4 text-sm font-medium rounded-xl transition-all duration-200",
              activeTab === tab.id
                ? "bg-accent text-white shadow-md"
                : "text-foreground/60 hover:text-foreground/80 hover:bg-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.id === activeTab)?.content}</div>
    </div>
  );
}
