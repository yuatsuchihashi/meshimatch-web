import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Heart } from "lucide-react";
import Link from "next/link";

export default async function FavoritesPage() {
  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        戻る
      </Link>

      <h1 className="text-xl font-bold text-foreground mb-6">お気に入り</h1>

      <GlassCard variant="strong" className="text-center">
        <Heart size={32} className="text-foreground/30 mx-auto mb-2" />
        <p className="text-foreground/50 text-sm">
          お気に入りのレストランはまだありません
        </p>
        <p className="text-foreground/40 text-xs mt-1">
          検索結果からお気に入りに追加できます
        </p>
      </GlassCard>
    </div>
  );
}
