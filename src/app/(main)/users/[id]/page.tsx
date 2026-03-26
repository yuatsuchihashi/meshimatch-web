import { GlassCard } from "@/components/ui/GlassCard";
import { User, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/profile/follows"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        戻る
      </Link>

      <GlassCard variant="strong" className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
          <User size={36} className="text-accent" />
        </div>
        <p className="text-foreground/50">ユーザーが見つかりませんでした</p>
      </GlassCard>
    </div>
  );
}
