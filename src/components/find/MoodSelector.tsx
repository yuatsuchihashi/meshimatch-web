"use client";

import { MOODS, type MoodId } from "@/lib/hotpepper/constants";
import { cn } from "@/lib/utils";

type MoodSelectorProps = {
  selected?: MoodId;
  onSelect: (mood: MoodId) => void;
};

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood.id}
          type="button"
          onClick={() => onSelect(mood.id)}
          className={cn(
            "glass p-3 flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer",
            selected === mood.id &&
              "!bg-accent/20 !border-accent/40 ring-1 ring-accent/30"
          )}
        >
          <span className="text-2xl">{mood.icon}</span>
          <span className="text-xs font-medium text-foreground/80">
            {mood.label}
          </span>
        </button>
      ))}
    </div>
  );
}
