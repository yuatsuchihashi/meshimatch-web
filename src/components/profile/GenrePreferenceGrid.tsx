"use client";

import { useState, useTransition } from "react";
import { GENRES, type GenreCode } from "@/lib/restaurant-taxonomy";
import { upsertGenrePreferences } from "@/actions/preferences";
import { GlassButton } from "@/components/ui/GlassButton";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

type Preference = -1 | 0 | 1;

type GenrePreferenceGridProps = {
  initial: Record<string, Preference>;
};

export function GenrePreferenceGrid({ initial }: GenrePreferenceGridProps) {
  const [preferences, setPreferences] = useState<Record<string, Preference>>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function cyclePreference(code: string) {
    setPreferences((prev) => {
      const current = prev[code] ?? 0;
      const next: Preference = current === 0 ? 1 : current === 1 ? -1 : 0;
      return { ...prev, [code]: next };
    });
    setSaved(false);
  }

  function handleSave() {
    const data = GENRES.map((g) => ({
      genre_code: g.code as GenreCode,
      preference: (preferences[g.code] ?? 0) as Preference,
    }));

    startTransition(async () => {
      await upsertGenrePreferences(data);
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {GENRES.map((genre) => {
          const pref = preferences[genre.code] ?? 0;
          return (
            <button
              key={genre.code}
              type="button"
              onClick={() => cyclePreference(genre.code)}
              className={cn(
                "glass p-3 flex items-center gap-3 transition-all duration-200 cursor-pointer text-left",
                pref === 1 && "!bg-green-500/15 !border-green-400/40",
                pref === -1 && "!bg-red-500/15 !border-red-400/40"
              )}
            >
              <span className="text-2xl">{genre.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {genre.name}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {pref === 1 && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                      <ThumbsUp size={12} /> 好き
                    </span>
                  )}
                  {pref === -1 && (
                    <span className="text-xs text-red-600 flex items-center gap-0.5">
                      <ThumbsDown size={12} /> 嫌い
                    </span>
                  )}
                  {pref === 0 && (
                    <span className="text-xs text-foreground/40 flex items-center gap-0.5">
                      <Minus size={12} /> 普通
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <GlassButton
        variant="accent"
        size="lg"
        className="w-full"
        onClick={handleSave}
        disabled={isPending}
      >
        {isPending ? "保存中..." : saved ? "保存しました!" : "好みを保存"}
      </GlassButton>
    </div>
  );
}
