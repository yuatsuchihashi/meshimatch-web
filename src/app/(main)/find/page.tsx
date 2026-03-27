"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { MoodSelector } from "@/components/find/MoodSelector";
import { LocationInput } from "@/components/find/LocationInput";
import { MemberSelector } from "@/components/find/MemberSelector";
import { executeGroupSearch } from "@/actions/search";
import type { MoodId } from "@/lib/hotpepper/constants";
import type { ScoredRestaurant } from "@/types/search";
import { Search, Clock, Users } from "lucide-react";

type Member = { id: string; display_name: string };

export default function FindPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [mood, setMood] = useState<MoodId | undefined>();
  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [timeSlot, setTimeSlot] = useState<"lunch" | "dinner" | "late_night">(
    "dinner"
  );
  const [error, setError] = useState("");

  function handleSearch() {
    if (!locationCode) {
      setError("エリアを選択してください");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await executeGroupSearch({
        member_ids: selectedMembers.map((m) => m.id),
        mood,
        location_code: locationCode,
        location_text: locationName,
        time_slot: timeSlot,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // Store results in sessionStorage and navigate
      sessionStorage.setItem(
        "meshimatch_results",
        JSON.stringify(result.data)
      );
      router.push("/find/results");
    });
  }

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Search size={22} className="text-accent" />
        レストランを探す
      </h1>

      {/* Members */}
      <GlassCard variant="strong" className="mb-4">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users size={16} />
          メンバー
        </h2>
        <MemberSelector
          following={[]}
          selected={selectedMembers}
          onAdd={(m) => setSelectedMembers((prev) => [...prev, m])}
          onRemove={(id) =>
            setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
          }
        />
        <p className="text-xs text-foreground/40 mt-2">
          自分は自動的に含まれます
        </p>
      </GlassCard>

      {/* Mood */}
      <GlassCard variant="strong" className="mb-4">
        <h2 className="text-base font-semibold text-foreground mb-3">
          雰囲気
        </h2>
        <MoodSelector selected={mood} onSelect={setMood} />
      </GlassCard>

      {/* Location */}
      <GlassCard variant="strong" className="mb-4">
        <h2 className="text-base font-semibold text-foreground mb-3">場所</h2>
        <LocationInput
          onSelect={(code, name) => {
            setLocationCode(code);
            setLocationName(name);
          }}
          selectedName={locationName}
        />
      </GlassCard>

      {/* Time */}
      <GlassCard variant="strong" className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock size={16} />
          時間帯
        </h2>
        <div className="flex gap-2">
          {[
            { id: "lunch" as const, label: "ランチ" },
            { id: "dinner" as const, label: "ディナー" },
            { id: "late_night" as const, label: "深夜" },
          ].map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => setTimeSlot(slot.id)}
              className={`glass flex-1 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                timeSlot === slot.id
                  ? "!bg-accent/20 !border-accent/40 text-accent"
                  : "text-foreground/60"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {error && (
        <p className="text-red-500 text-sm text-center mb-4 bg-red-50 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <GlassButton
        variant="accent"
        size="lg"
        className="w-full"
        onClick={handleSearch}
        disabled={isPending}
      >
        {isPending ? "検索中..." : "レストランを探す"}
      </GlassButton>
    </div>
  );
}
