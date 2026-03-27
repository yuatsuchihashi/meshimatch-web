"use client";

import { signOut } from "@/actions/auth";
import { updateDisplayName } from "@/actions/preferences";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassInput } from "@/components/ui/GlassInput";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleUpdateName() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateDisplayName(name.trim());
      setSaved(true);
    });
  }

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80 mb-4"
      >
        <ArrowLeft size={16} />
        戻る
      </Link>

      <h1 className="text-xl font-bold text-foreground mb-6">設定</h1>

      <GlassCard variant="strong" className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">表示名の変更</h2>
        <div className="flex gap-2">
          <GlassInput
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="新しい表示名"
            className="flex-1"
          />
          <GlassButton
            variant="accent"
            onClick={handleUpdateName}
            disabled={isPending || !name.trim()}
          >
            {saved ? "保存済" : "保存"}
          </GlassButton>
        </div>
      </GlassCard>

      <GlassCard variant="strong">
        <h2 className="text-lg font-semibold text-foreground mb-4">アカウント</h2>
        <form action={signOut}>
          <GlassButton type="submit" variant="danger" className="w-full">
            ログアウト
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  );
}
