"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GENRES } from "@/lib/mockData";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { nanoid } from "@/lib/utils/nanoid";
import type { TierData, TierKey } from "@/lib/types";

type Step = "name" | "members" | "survey" | "complete";

const TIER_CONFIG = {
  S: { label: "Tier S", emoji: "", subtitle: "めっちゃ食べたい", color: "var(--primary)" },
  A: { label: "Tier A", emoji: "", subtitle: "食べたい", color: "var(--warning)" },
  B: { label: "Tier B", emoji: "", subtitle: "まぁいいよ", color: "var(--text-tertiary)" },
};

const AREAS = ["渋谷", "新宿", "池袋", "銀座", "六本木", "恵比寿", "表参道", "下北沢", "吉祥寺", "上野"];

// ─── Draggable genre chip ───
function DraggableGenreChip({
  id,
  emoji,
  name,
  color,
}: {
  id: string;
  emoji: string;
  name: string;
  color?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        borderRadius: 20,
        backgroundColor: color ? color + "15" : "var(--surface)",
        border: `1.5px solid ${color ? color + "55" : "var(--border)"}`,
        color: color ?? "var(--text-primary)",
        fontSize: 14,
        fontWeight: 500,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        opacity: isDragging ? 0.3 : 1,
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
        transition: isDragging ? undefined : "opacity 0.15s",
        boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
      }}
    >
      {emoji} {name}
    </div>
  );
}

// ─── Droppable tier zone ───
function TierDropZone({
  tier,
  tiers,
  activeGenreId,
  onRemove,
}: {
  tier: TierKey;
  tiers: TierData;
  activeGenreId: string | null;
  onRemove: (id: string) => void;
}) {
  const config = TIER_CONFIG[tier];
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier}` });
  const items = tiers[tier];

  return (
    <div
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? config.color + "18" : "var(--surface)",
        borderRadius: 16,
        border: `2px ${items.length === 0 && !isOver ? "dashed" : "solid"} ${
          isOver ? config.color : items.length === 0 ? "var(--border)" : config.color + "55"
        }`,
        padding: 14,
        marginBottom: 12,
        transition: "all 0.15s ease",
        minHeight: 70,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: items.length > 0 ? 10 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: config.color + "20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {config.emoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: config.color }}>{config.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{config.subtitle}</div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: config.color + "20",
            color: config.color,
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: 20,
          }}
        >
          {items.length}件
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((id) => {
            const g = GENRES.find((x) => x.id === id);
            return g ? (
              <button
                key={id}
                onClick={() => onRemove(id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 10px",
                  borderRadius: 20,
                  backgroundColor: config.color + "15",
                  border: `1px solid ${config.color}55`,
                  color: config.color,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {g.emoji} {g.name}
                <span style={{ fontSize: 14, opacity: 0.6 }}>×</span>
              </button>
            ) : null;
          })}
        </div>
      )}

      {isOver && activeGenreId && (
        <div
          style={{
            marginTop: items.length > 0 ? 8 : 0,
            padding: "6px 12px",
            borderRadius: 20,
            border: `1.5px dashed ${config.color}`,
            color: config.color,
            fontSize: 13,
            opacity: 0.6,
            display: "inline-block",
          }}
        >
          ここにドロップ
        </div>
      )}
    </div>
  );
}

export default function CreateGroupPage() {
  const router = useRouter();
  const { user, userId } = useUser();
  const [step, setStep] = useState<Step>("name");
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [anywhereOk, setAnywhereOk] = useState(true);
  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [tiers, setTiers] = useState<TierData>({ S: [], A: [], B: [] });
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const unranked = GENRES.filter(
    (g) => !tiers.S.includes(g.id) && !tiers.A.includes(g.id) && !tiers.B.includes(g.id)
  );
  const rankedCount = tiers.S.length + tiers.A.length + tiers.B.length;

  function handleDragStart(event: DragStartEvent) {
    setActiveGenreId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over, active } = event;
    setActiveGenreId(null);
    if (!over) return;
    const overId = over.id as string;
    if (!overId.startsWith("tier-")) return;
    const tier = overId.replace("tier-", "") as TierKey;
    const genreId = active.id as string;
    setTiers((prev) => {
      const next: TierData = {
        S: prev.S.filter((id) => id !== genreId),
        A: prev.A.filter((id) => id !== genreId),
        B: prev.B.filter((id) => id !== genreId),
      };
      next[tier] = [...next[tier], genreId];
      return next;
    });
  }

  function removeFromTier(genreId: string) {
    setTiers((prev) => ({
      S: prev.S.filter((id) => id !== genreId),
      A: prev.A.filter((id) => id !== genreId),
      B: prev.B.filter((id) => id !== genreId),
    }));
  }

  function toggleArea(area: string) {
    setPreferredAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  function addMember() {
    const name = memberInput.trim();
    if (name && !members.includes(name)) {
      setMembers((prev) => [...prev, name]);
      setMemberInput("");
    }
  }

  async function handleSubmitSurvey() {
    if (!userId) return;
    setStep("complete");

    try {
      const supabase = createClient();
      const code = nanoid(8);

      // 1. グループ作成
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName,
          invite_code: code,
          created_by: userId,
        })
        .select()
        .single();

      if (groupError || !group) {
        console.error("Group creation failed:", groupError);
        return;
      }

      setCreatedGroupId(group.id);
      setInviteCode(code);

      // 2. 自分をownerとして追加
      const { data: member } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          profile_id: userId,
          display_name: user?.displayName ?? "ホスト",
          role: "owner",
        })
        .select()
        .single();

      // 3. サーベイ回答を送信
      if (member) {
        await supabase.from("survey_responses").insert({
          group_id: group.id,
          member_id: member.id,
          tier_s: tiers.S,
          tier_a: tiers.A,
          tier_b: tiers.B,
          disliked: [],
          preferred_areas: anywhereOk ? [] : preferredAreas,
        });

        await supabase
          .from("group_members")
          .update({ has_survey: true })
          .eq("id", member.id);
      }

      setTimeout(() => {
        router.push(`/groups/${group.id}/waiting`);
      }, 2000);
    } catch (err) {
      console.error("Error creating group:", err);
    }
  }

  // ─── EXIT CONFIRM SHEET ───
  if (showExitConfirm) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowExitConfirm(false)}
        />
        <div style={{ position: "relative", backgroundColor: "var(--bg)", borderRadius: "24px 24px 0 0", padding: "20px 20px 48px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, textAlign: "center" }}>
            グループ作成を終了しますか？
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginBottom: 28 }}>
            入力内容はリセットされます
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => router.push("/home")}
              style={{ width: "100%", padding: "15px", borderRadius: 14, backgroundColor: "#E05252", color: "white", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              終了する
            </button>
            <button className="btn-secondary" onClick={() => setShowExitConfirm(false)}>
              続ける
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP: NAME ───
  if (step === "name") {
    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => router.push("/home")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            グループを作ろう
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
            メンバーの好みを合わせて、みんながハッピーなお店を見つけましょう
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
              グループ名
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="例: ゼミ飲み会"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--surface)",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep("members")}
            disabled={!groupName.trim()}
          >
            次へ
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── STEP: MEMBERS ───
  if (step === "members") {
    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => setStep("name")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            メンバーを追加
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
            一緒に行くメンバーを追加してください
          </div>

          {members.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {members.map((name) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(204,119,85,0.1)",
                    border: "1px solid var(--primary)",
                    borderRadius: 20,
                    padding: "6px 12px",
                    fontSize: 14,
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  {name}
                  <button
                    onClick={() => setMembers((p) => p.filter((m) => m !== name))}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--primary)",
                      padding: 0,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="名前を入力"
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--surface)",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              onClick={addMember}
              disabled={!memberInput.trim()}
              style={{
                padding: "0 20px",
                borderRadius: 14,
                backgroundColor: "var(--primary)",
                color: "white",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                opacity: !memberInput.trim() ? 0.4 : 1,
              }}
            >
              追加
            </button>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 14,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              招待リンクを共有
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              リンクを共有してメンバーを招待できます
            </div>
            <button
              className="btn-secondary"
              style={{ height: 42, fontSize: 14 }}
              onClick={() => {
                const url = `${window.location.origin}/invite/${inviteCode || "preview"}`;
                navigator.clipboard.writeText(url);
                alert("招待リンクをコピーしました！");
              }}
            >
              リンクをコピー
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep("survey")}
          >
            次へ（アンケートに回答する）
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── STEP: SURVEY ───
  if (step === "survey") {
    const activeGenre = activeGenreId ? GENRES.find((g) => g.id === activeGenreId) : null;

    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => setStep("members")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            今日の気分は？
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
            場所とジャンルを教えてください
          </div>

          {/* Location section */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              場所
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: anywhereOk ? 0 : 12,
                cursor: "pointer",
              }}
            >
              <div
                onClick={() => setAnywhereOk(!anywhereOk)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${anywhereOk ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: anywhereOk ? "var(--primary)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                {anywhereOk && <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 15, color: "var(--text-primary)" }}>
                場所はなんでもいい
              </span>
            </label>
            {!anywhereOk && (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  希望エリア（複数選択可）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {AREAS.map((area) => {
                    const selected = preferredAreas.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => toggleArea(area)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 12px",
                          borderRadius: 20,
                          border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                          backgroundColor: selected ? "rgba(204,119,85,0.1)" : "var(--bg)",
                          color: selected ? "var(--primary)" : "var(--text-primary)",
                          fontSize: 13,
                          fontWeight: selected ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {selected && (
                          <span style={{ fontSize: 11, fontWeight: 700 }}>✓</span>
                        )}
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Genre DnD section */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              ジャンルのランク付け
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>
              ジャンルをドラッグ＆ドロップしてティアに分けてください
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 10,
                padding: "8px 12px",
                marginBottom: 16,
              }}
            >
              すべてのジャンルをランク付けする必要はありません
            </div>
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Unranked genres pool */}
            {unranked.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                  未分類（ドラッグしてティアへ）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {unranked.map((g) => (
                    <DraggableGenreChip key={g.id} id={g.id} emoji={g.emoji} name={g.name} />
                  ))}
                </div>
              </div>
            )}
            {unranked.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  fontSize: 13,
                  color: "var(--secondary)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                全てのジャンルをランク付けしました ✓
              </div>
            )}

            {/* Tier zones */}
            {(["S", "A", "B"] as TierKey[]).map((tier) => (
              <TierDropZone
                key={tier}
                tier={tier}
                tiers={tiers}
                activeGenreId={activeGenreId}
                onRemove={removeFromTier}
              />
            ))}

            {/* Drag overlay */}
            <DragOverlay>
              {activeGenre ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    borderRadius: 20,
                    backgroundColor: "var(--surface)",
                    border: "1.5px solid var(--primary)",
                    color: "var(--primary)",
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                    cursor: "grabbing",
                  }}
                >
                  {activeGenre.emoji} {activeGenre.name}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              textAlign: "center",
              marginBottom: 24,
              marginTop: 8,
            }}
          >
            {rankedCount}/{GENRES.length} ジャンルをランク付け済み
          </div>

          <button
            className="btn-primary"
            onClick={handleSubmitSurvey}
            disabled={rankedCount === 0}
          >
            回答を送信する
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── STEP: COMPLETE ───
  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80dvh",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(74,138,90,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
          className="animate-bounce-in"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          回答完了！
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          みんなの回答を待っています。<br />
          全員が回答したらお店を検索します。
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-tertiary)",
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid var(--border)",
              borderTopColor: "var(--text-tertiary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          待機室に移動中...
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({
  children,
  showExit = false,
  onExit,
}: {
  children: React.ReactNode;
  showExit?: boolean;
  onExit?: () => void;
}) {
  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", position: "relative" }}>
      {showExit && onExit && (
        <button
          onClick={onExit}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 50,
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 18,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          ✕
        </button>
      )}
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ padding: "56px 20px 0" }}>
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--primary)",
          fontSize: 16,
          fontWeight: 600,
          padding: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        戻る
      </button>
    </div>
  );
}
