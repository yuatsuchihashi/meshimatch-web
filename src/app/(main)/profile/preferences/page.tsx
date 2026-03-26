import { GenrePreferenceGrid } from "@/components/profile/GenrePreferenceGrid";
import { DietaryRestrictionForm } from "@/components/profile/DietaryRestrictionForm";
import { GlassCard } from "@/components/ui/GlassCard";
import type { DietaryRestrictionId } from "@/lib/hotpepper/constants";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PreferencesPage() {
  const genreMap: Record<string, -1 | 0 | 1> = {};
  const dietaryIds: DietaryRestrictionId[] = [];

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        戻る
      </Link>

      <h1 className="text-xl font-bold text-foreground mb-6">好み設定</h1>

      <GlassCard variant="strong" className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">ジャンルの好み</h2>
        <p className="text-sm text-foreground/50 mb-4">
          タップして好き・嫌い・普通を切り替え
        </p>
        <GenrePreferenceGrid initial={genreMap} />
      </GlassCard>

      <GlassCard variant="strong">
        <h2 className="text-lg font-semibold text-foreground mb-1">食事制限・アレルギー</h2>
        <p className="text-sm text-foreground/50 mb-4">
          該当するものをタップして選択
        </p>
        <DietaryRestrictionForm initial={dietaryIds} />
      </GlassCard>
    </div>
  );
}
