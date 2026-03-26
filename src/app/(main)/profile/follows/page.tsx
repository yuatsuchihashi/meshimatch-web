import { GlassCard } from "@/components/ui/GlassCard";
import { UserSearchInput } from "@/components/social/UserSearchInput";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function FollowsPage() {
  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        戻る
      </Link>

      <h1 className="text-xl font-bold text-foreground mb-6">フォロー</h1>

      <GlassCard variant="strong" className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">
          ユーザーを探す
        </h2>
        <UserSearchInput followingIds={[]} />
      </GlassCard>

      <GlassCard variant="strong" className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">
          フォロー中 (0)
        </h2>
        <p className="text-sm text-foreground/50">
          まだ誰もフォローしていません
        </p>
      </GlassCard>

      <GlassCard variant="strong">
        <h2 className="text-base font-semibold text-foreground mb-3">
          フォロワー (0)
        </h2>
        <p className="text-sm text-foreground/50">
          まだフォロワーはいません
        </p>
      </GlassCard>
    </div>
  );
}
