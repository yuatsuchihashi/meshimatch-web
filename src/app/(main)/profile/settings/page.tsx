"use client";

import { signOut } from "@/actions/auth";
import { updateDisplayName } from "@/actions/preferences";
import { PillButton } from "@/components/v2";
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
    <div className="v2-scope service-canvas" style={{ minHeight: "100dvh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "18px 20px 120px" }}>
        <Link
          href="/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 40,
            padding: "0 16px",
            borderRadius: "var(--v2-radius-pill)",
            backgroundColor: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            color: "var(--v2-ink)",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} />
          戻る
        </Link>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            lineHeight: 1.3,
            letterSpacing: "var(--v2-tracking-display)",
            color: "var(--v2-ink)",
            margin: "20px 0 24px",
          }}
        >
          設定
        </h1>

        <section className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--v2-ink)", marginBottom: 14 }}>
            表示名の変更
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="新しい表示名"
              style={{
                flex: 1,
                minWidth: 0,
                height: 48,
                borderRadius: "var(--v2-radius-input)",
                border: "1px solid var(--v2-border)",
                background: "var(--v2-surface-soft)",
                color: "var(--v2-ink)",
                padding: "0 14px",
                fontSize: 15,
                outline: "none",
              }}
            />
            <PillButton
              variant="cta"
              onClick={handleUpdateName}
              disabled={isPending || !name.trim()}
              style={{ width: "auto", minHeight: 48, flexShrink: 0 }}
            >
              {saved ? "保存済" : "保存"}
            </PillButton>
          </div>
        </section>

        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--v2-ink)", marginBottom: 14 }}>
            アカウント
          </h2>
          <form action={signOut}>
            <PillButton
              type="submit"
              variant="ghost"
              style={{ width: "100%", color: "var(--danger)" }}
            >
              ログアウト
            </PillButton>
          </form>
        </section>
      </div>
    </div>
  );
}
