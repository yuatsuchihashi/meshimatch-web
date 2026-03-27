"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassTabs } from "@/components/ui/GlassTabs";
import { GlassCard } from "@/components/ui/GlassCard";
import { RestaurantCard } from "@/components/results/RestaurantCard";
import {
  sortByMatchScore,
  sortByRating,
  sortByDistance,
} from "@/lib/matching/engine";
import type { ScoredRestaurant } from "@/types/search";
import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<ScoredRestaurant[] | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("meshimatch_results");
    if (stored) {
      setResults(JSON.parse(stored));
    } else {
      router.push("/find");
    }
  }, [router]);

  if (!results) {
    return (
      <div className="px-4 pt-8 max-w-md mx-auto">
        <p className="text-foreground/50 text-center">読み込み中...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="px-4 pt-8 max-w-md mx-auto">
        <Link
          href="/find"
          className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
        >
          <ArrowLeft size={16} />
          検索に戻る
        </Link>
        <GlassCard variant="strong" className="text-center py-12">
          <SearchX size={40} className="text-foreground/30 mx-auto mb-3" />
          <p className="text-foreground/60 font-medium">
            条件に合うレストランが見つかりませんでした
          </p>
          <p className="text-foreground/40 text-sm mt-2">
            エリアや条件を変えて再検索してみてください
          </p>
        </GlassCard>
      </div>
    );
  }

  const byMatch = sortByMatchScore(results);
  const byRating = sortByRating(results);
  // For distance, use first restaurant's coordinates as center (rough estimate)
  const byDistance = results[0]
    ? sortByDistance(results, results[0].lat, results[0].lng)
    : results;

  const tabs = [
    {
      id: "match",
      label: `一致度 (${results.length})`,
      content: (
        <div className="flex flex-col gap-3">
          {byMatch.slice(0, 30).map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      ),
    },
    {
      id: "rating",
      label: "評価",
      content: (
        <div className="flex flex-col gap-3">
          {byRating.slice(0, 30).map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      ),
    },
    {
      id: "distance",
      label: "距離",
      content: (
        <div className="flex flex-col gap-3">
          {byDistance.slice(0, 30).map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/find"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        検索に戻る
      </Link>

      <h1 className="text-xl font-bold text-foreground mb-4">
        検索結果
      </h1>

      <GlassTabs tabs={tabs} />
    </div>
  );
}
