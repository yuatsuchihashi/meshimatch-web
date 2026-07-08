"use client";

// ============================================================
// ○× 投票ページ
// ============================================================
// フロー (幹事絞り込み方式):
//   1. 幹事: 候補10枚を○×スワイプ → ○にした店を確認 → グループに共有
//      (幹事の○はそのまま yes 票として記録される)
//   2. メンバー: 共有された shortlist だけを○×スワイプ
//   3. 投票後は集計ランキング。同点や最終決定は幹事が行う。
// カードはスワイプ (ドラッグ) とボタンの両対応。
// ============================================================

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";
import { GENRES } from "@/lib/mockData";
import { GENRE_EMOJI } from "@/lib/genre-emoji";
import { Confetti } from "@/components/ui/Confetti";
import { track, AnalyticsEvent } from "@/lib/analytics";
import type { ShortlistItem } from "@/app/api/groups/shortlist/route";

interface Candidate extends ShortlistItem {
  matchScore?: number;
}

interface TallyEntry {
  restaurantId: string;
  restaurantName: string | null;
  genreId: string | null;
  yes: number;
  no: number;
}

const SWIPE_THRESHOLD = 90;

type Mode =
  | "loading"
  | "curate"          // 幹事: 絞り込みスワイプ
  | "curate-confirm"  // 幹事: ○にした候補の確認
  | "share"           // 幹事: 共有画面
  | "waiting"         // メンバー: 幹事待ち
  | "vote"            // shortlist への投票
  | "tally"           // 集計
  | "error";

export default function VotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const { userId } = useUser();

  const [mode, setMode] = useState<Mode>("loading");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"owner" | "member" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<Candidate[]>([]); // 幹事の○
  const [outgoing, setOutgoing] = useState<"yes" | "no" | null>(null);
  const [tally, setTally] = useState<TallyEntry[]>([]);
  const [votedMemberCount, setVotedMemberCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- スワイプ用 ---
  const [drag, setDrag] = useState<{ dx: number; dragging: boolean }>({ dx: 0, dragging: false });
  const dragStartX = useRef(0);

  // メンバーID解決 (ログインユーザー or 招待から参加したゲスト)
  useEffect(() => {
    let cancelled = false;
    async function resolveMember() {
      const supabase = createClient();

      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();
      if (cancelled) return;
      if (group) setGroupName((group as { name: string }).name);

      // 1. ログインユーザーのメンバーシップ
      if (userId) {
        const { data: existing } = await supabase
          .from("group_members")
          .select("id, role")
          .eq("group_id", groupId)
          .eq("profile_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (existing) {
          setMemberId(existing.id);
          setMyRole((existing.role as "owner" | "member") ?? "member");
          return;
        }
      }

      // 2. ゲスト: 招待サーベイ時に保存した memberId を検証して使う
      const guestMemberId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(`mm_member_${groupId}`)
          : null;
      if (guestMemberId) {
        const { data: guestMember } = await supabase
          .from("group_members")
          .select("id, role")
          .eq("id", guestMemberId)
          .eq("group_id", groupId)
          .maybeSingle();
        if (cancelled) return;
        if (guestMember) {
          setMemberId(guestMember.id);
          setMyRole((guestMember.role as "owner" | "member") ?? "member");
          return;
        }
      }

      setError(t("vote.loadFailed"));
      setMode("error");
    }
    void resolveMember();
    return () => { cancelled = true; };
  }, [groupId, userId, t]);

  const refreshTally = useCallback(async () => {
    const res = await fetch(
      `/api/groups/votes?group_id=${groupId}${memberId ? `&member_id=${memberId}` : ""}`
    );
    const json = await res.json();
    setTally(json.ranking ?? []);
    setVotedMemberCount(json.votedMemberCount ?? 0);
    return json;
  }, [groupId, memberId]);

  // 初期ロード: shortlist の有無で分岐
  useEffect(() => {
    if (!memberId || !myRole) return;
    let cancelled = false;

    async function load() {
      try {
        const shortlistRes = await fetch(`/api/groups/shortlist?group_id=${groupId}`);
        const { shortlist } = await shortlistRes.json();

        if (shortlist && shortlist.length > 0) {
          // 投票フェーズ
          const votesJson = await refreshTally();
          const voted = new Set<string>(votesJson.myVotedRestaurantIds ?? []);
          if (cancelled) return;
          setCandidates(shortlist);
          const firstUnvoted = (shortlist as Candidate[]).findIndex((c) => !voted.has(c.id));
          if (firstUnvoted === -1) {
            setMode("tally");
          } else {
            setCursor(firstUnvoted);
            setMode("vote");
          }
          return;
        }

        if (myRole === "owner") {
          // 幹事の絞り込みフェーズ
          const res = await fetch(`/api/groups/results?group_id=${groupId}`);
          const results = await res.json();
          if (cancelled) return;
          if (results.error) {
            setError(results.error);
            setMode("error");
            return;
          }
          setCandidates((results.results ?? []).slice(0, 10));
          setCursor(0);
          setPicked([]);
          setMode("curate");
        } else {
          setMode("waiting");
        }
      } catch {
        if (!cancelled) {
          setError(t("vote.loadFailed"));
          setMode("error");
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [groupId, memberId, myRole, refreshTally, t]);

  // メンバー待機中は5秒ごとにポーリング
  useEffect(() => {
    if (mode !== "waiting") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/groups/shortlist?group_id=${groupId}`);
      const { shortlist } = await res.json();
      if (shortlist && shortlist.length > 0) {
        setCandidates(shortlist);
        setCursor(0);
        setMode("vote");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [mode, groupId]);

  const current = candidates[cursor];

  // ---------- カード処理 ----------

  function advance(vote: "yes" | "no") {
    if (!current || outgoing) return;
    setOutgoing(vote);

    if (mode === "curate") {
      if (vote === "yes") setPicked((p) => [...p, current]);
    } else if (mode === "vote" && memberId) {
      void fetch("/api/groups/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          memberId,
          restaurantId: current.id,
          restaurantName: current.name,
          genreId: current.genreId,
          vote,
        }),
      });
    }

    setTimeout(() => {
      setOutgoing(null);
      setDrag({ dx: 0, dragging: false });
      const next = cursor + 1;
      if (next >= candidates.length) {
        if (mode === "curate") {
          setMode("curate-confirm");
        } else {
          void refreshTally();
          setMode("tally");
        }
      } else {
        setCursor(next);
      }
    }, 280);
  }

  // ---------- スワイプ ----------

  function onPointerDown(e: React.PointerEvent) {
    if (outgoing) return;
    dragStartX.current = e.clientX;
    setDrag({ dx: 0, dragging: true });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.dragging || outgoing) return;
    setDrag({ dx: e.clientX - dragStartX.current, dragging: true });
  }

  function onPointerUp() {
    if (!drag.dragging || outgoing) return;
    if (drag.dx > SWIPE_THRESHOLD) {
      advance("yes");
    } else if (drag.dx < -SWIPE_THRESHOLD) {
      advance("no");
    } else {
      setDrag({ dx: 0, dragging: false });
    }
  }

  async function saveShortlist() {
    if (!memberId || picked.length === 0) return;
    const res = await fetch("/api/groups/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, memberId, items: picked }),
    });
    if (res.ok) {
      setCandidates(picked);
      setMode("share");
    }
  }

  async function decide(entry: TallyEntry) {
    // 楽観更新: 紙吹雪は即時、保存とリダイレクトは裏で
    setDecided(entry.restaurantName ?? "");
    track(AnalyticsEvent.RESTAURANT_DECIDED, { groupId, restaurantId: entry.restaurantId ?? null });
    await fetch("/api/groups/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        restaurantName: entry.restaurantName,
        restaurantId: entry.restaurantId,
        genreId: entry.genreId,
        decidedBy: userId,
      }),
    });
    setTimeout(() => router.push(`/groups/${groupId}/results`), 1400);
  }

  const genreName = useMemo(() => new Map(GENRES.map((g) => [g.id, g.name])), []);

  const voteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/groups/${groupId}/vote` : "";
  const lineShareUrl = `https://line.me/R/share?text=${encodeURIComponent(
    `${t("vote.shareMessage", { group: groupName })} ${voteUrl}`
  )}`;

  // ---------- render ----------

  if (mode === "loading") {
    return (
      <Screen>
        <Spinner label={t("common.loading")} />
      </Screen>
    );
  }

  if (mode === "error") {
    return (
      <Screen>
        <CenterMessage icon={BowlIcon} title={error ?? t("vote.noCandidates")}>
          <Link href={`/groups/${groupId}/results`} style={{ display: "inline-block", marginTop: 16, color: "var(--primary)", fontWeight: 600 }}>
            {t("vote.backToResults")}
          </Link>
        </CenterMessage>
      </Screen>
    );
  }

  if (mode === "waiting") {
    return (
      <Screen>
        <CenterMessage icon={ClockIcon} title={t("vote.waitingForOrganizer")} sub={t("vote.waitingForOrganizerSub")}>
          <Link href={`/groups/${groupId}/waiting`} style={{ display: "inline-block", marginTop: 16, color: "var(--primary)", fontWeight: 600 }}>
            ← {t("waiting.backToHome")}
          </Link>
        </CenterMessage>
      </Screen>
    );
  }

  if (mode === "curate-confirm") {
    return (
      <Screen>
        <div style={{ padding: "56px 20px 24px", textAlign: "center" }}>
          <div className="animate-bounce-in" style={{ display: "flex", justifyContent: "center" }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="var(--success)" />
              <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 8 }}>
            {picked.length > 0
              ? t("vote.organizerConfirmTitle", { count: picked.length })
              : t("vote.organizerNonePicked")}
          </h1>
        </div>
        <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
          {picked.map((item) => (
            <div key={item.id} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{GENRE_EMOJI[item.genreId] ?? "🍽️"}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {item.area}{item.genreId ? ` ・ ${genreName.get(item.genreId) ?? ""}` : ""}
                </div>
              </div>
              <button
                onClick={() => setPicked((p) => p.filter((x) => x.id !== item.id))}
                style={{ marginLeft: "auto", border: "none", background: "none", color: "var(--danger)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {picked.length > 0 && (
              <button className="btn-primary" onClick={saveShortlist}>
                {t("vote.organizerShare")}
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => { setCursor(0); setPicked([]); setMode("curate"); }}
            >
              {t("vote.organizerReswipe")}
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  if (mode === "share") {
    return (
      <Screen>
        <div style={{ padding: "72px 20px 24px", textAlign: "center" }}>
          <div className="animate-bounce-in" style={{ display: "flex", justifyContent: "center", color: "var(--primary)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 3 3.6 10.3c-.8.35-.75 1.5.1 1.76l6.04 1.9 1.9 6.05c.26.84 1.4.9 1.75.09L21 3Z" />
              <path d="m10 14 11-11" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 10 }}>
            {t("vote.shareTitle")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            {t("vote.shareDesc")}
          </p>
        </div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href={lineShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 52, borderRadius: 100, background: "#06C755", color: "white",
              fontWeight: 700, fontSize: 15, textDecoration: "none",
            }}
          >
            {t("vote.shareLine")}
          </a>
          <button
            className="btn-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(voteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? t("vote.linkCopied") : t("vote.shareCopy")}
          </button>
          <button
            className="btn-primary"
            onClick={() => { void refreshTally(); setMode("tally"); }}
            style={{ marginTop: 12 }}
          >
            {t("vote.goToTally")}
          </button>
        </div>
      </Screen>
    );
  }

  if (mode === "tally") {
    return (
      <Screen>
        {decided !== null && <Confetti />}
        <div style={{ padding: "56px 20px 24px", textAlign: "center" }}>
          <div className="animate-bounce-in" style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="var(--success)" />
              <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("vote.done")}</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>{t("vote.doneSub")}</p>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            {t("vote.votedCount", { count: votedMemberCount })}
          </p>
        </div>

        <div style={{ padding: "0 20px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t("vote.tallyTitle")}</div>
          {tally.map((entry, i) => (
            <div key={entry.restaurantId} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "var(--warning)" : "var(--bg-secondary)",
                color: "var(--secondary)", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, fontSize: 14,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.restaurantName}
                </div>
                <div style={{ fontSize: 13, display: "flex", gap: 10, marginTop: 2 }}>
                  <span style={{ color: "var(--success-deep)", fontWeight: 700 }}>○ {entry.yes}</span>
                  <span style={{ color: "var(--danger)", fontWeight: 700 }}>× {entry.no}</span>
                </div>
              </div>
              {myRole === "owner" && (
                <button
                  onClick={() => decide(entry)}
                  disabled={decided !== null}
                  style={{
                    padding: "8px 14px", borderRadius: 100, border: "none",
                    background: decided === entry.restaurantName ? "var(--success)" : "var(--primary)",
                    color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {decided === entry.restaurantName ? "✓" : t("vote.decideThis")}
                </button>
              )}
            </div>
          ))}
          {myRole === "owner" && (
            <a
              href={lineShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textAlign: "center", color: "#06C755", fontWeight: 700, fontSize: 14, marginTop: 4, textDecoration: "none" }}
            >
              {t("vote.shareLine")} →
            </a>
          )}
          <Link
            href={`/groups/${groupId}/results`}
            style={{ textAlign: "center", color: "var(--primary)", fontWeight: 600, fontSize: 14, marginTop: 4 }}
          >
            {t("vote.backToResults")}
          </Link>
        </div>
      </Screen>
    );
  }

  // ---------- curate / vote 共通: カードスワイプ ----------

  if (!current) {
    return (
      <Screen>
        <CenterMessage icon={BowlIcon} title={t("vote.noCandidates")} />
      </Screen>
    );
  }

  const emoji = GENRE_EMOJI[current.genreId] ?? "🍽️";
  const rotation = drag.dx / 18;
  const yesOpacity = Math.min(Math.max(drag.dx - 20, 0) / SWIPE_THRESHOLD, 1);
  const noOpacity = Math.min(Math.max(-drag.dx - 20, 0) / SWIPE_THRESHOLD, 1);

  return (
    <Screen>
      {/* header */}
      <div style={{ padding: "56px 20px 8px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {mode === "curate" ? t("vote.organizerIntro") : t("vote.title")}
        </h1>
        <p style={{ fontSize: 13, color: mode === "curate" ? "var(--primary)" : "var(--text-secondary)", marginTop: 4, fontWeight: mode === "curate" ? 700 : 400 }}>
          {mode === "curate" ? t("vote.organizerImpactNote") : t("vote.subtitle")}
        </p>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginTop: 10 }}>
          {cursor + 1} / {candidates.length}
        </div>
      </div>

      {/* card stack */}
      <div style={{ padding: "12px 20px 0", position: "relative", minHeight: 380 }}>
        {candidates[cursor + 1] && (
          <div className="card" style={{
            position: "absolute", left: 28, right: 28, top: 20, height: 340,
            transform: "scale(0.96) translateY(8px)", opacity: 0.5,
          }} />
        )}

        <div
          className={`card ${outgoing === "yes" ? "animate-card-out-right" : outgoing === "no" ? "animate-card-out-left" : drag.dragging ? "" : "animate-fade-in"}`}
          key={current.id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "relative", overflow: "hidden", cursor: "grab",
            touchAction: "pan-y",
            transform: drag.dragging ? `translateX(${drag.dx}px) rotate(${rotation}deg)` : undefined,
            transition: drag.dragging ? "none" : "transform 0.25s ease",
            userSelect: "none",
          }}
        >
          {/* スワイプ中の ○ / × ヒント */}
          <div style={{
            position: "absolute", top: 16, left: 16, zIndex: 2, opacity: yesOpacity,
            border: "3px solid var(--success)", color: "var(--success-deep)",
            borderRadius: 12, padding: "4px 14px", fontSize: 24, fontWeight: 800,
            transform: "rotate(-12deg)", background: "rgba(255,255,255,0.85)",
          }}>
            ○
          </div>
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 2, opacity: noOpacity,
            border: "3px solid var(--danger)", color: "var(--danger)",
            borderRadius: 12, padding: "4px 14px", fontSize: 24, fontWeight: 800,
            transform: "rotate(12deg)", background: "rgba(255,255,255,0.85)",
          }}>
            ×
          </div>

          {/* photo area */}
          <div style={{
            height: 170, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(140deg, #FBEBC9 0%, #F7DFA8 100%)",
            fontSize: 64,
          }}>
            {current.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.photoUrl} alt={current.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
            ) : (
              emoji
            )}
          </div>

          {/* badges */}
          <div style={{ position: "absolute", top: 140, left: 12, display: "flex", gap: 6 }}>
            {current.isMemberFavorite && (
              <span className="badge-favorite">★ {t("vote.favoriteBadge")}</span>
            )}
            {current.endorsementLabel && (
              <span className="badge-endorsement">{current.endorsementLabel}</span>
            )}
          </div>

          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
              {current.name}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              {current.area}
              {current.genreId && ` ・ ${genreName.get(current.genreId) ?? ""}`}
              {current.budget && ` ・ ${current.budget}`}
            </div>
            {(current.reasonTags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {(current.reasonTags ?? []).slice(0, 3).map((tag) => (
                  <span key={tag} style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
                    background: "var(--bg-secondary)", color: "var(--text-secondary)",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${current.name} ${current.address ?? current.area}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}
            >
              Googleマップで見る →
            </a>
          </div>
        </div>
      </div>

      {/* vote buttons */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 48,
        padding: "28px 20px 48px", alignItems: "center",
      }}>
        <button className="vote-btn vote-no" onClick={() => advance("no")} aria-label={t("vote.no")}>
          ×
        </button>
        <button className="vote-btn vote-yes" onClick={() => advance("yes")} aria-label={t("vote.yes")}>
          ○
        </button>
      </div>
    </Screen>
  );
}

const BowlIcon = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11h16a8 8 0 0 1-16 0Z" />
    <path d="M8.5 15.5c2 1.4 5 1.4 7 0" />
    <path d="M14.5 3.5 8 10M18 5l-5.5 5" />
  </svg>
);

const ClockIcon = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {/* どの状態でもホームに戻れる */}
      <Link
        href="/home"
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 10,
          display: "inline-flex", alignItems: "center", gap: 4,
          color: "var(--primary)", fontSize: 14, fontWeight: 600, textDecoration: "none",
          padding: "6px 10px", borderRadius: 100, background: "rgba(255,255,255,0.7)",
        }}
      >
        ← ホーム
      </Link>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
        <div className="animate-spin-slow" style={{
          width: 32, height: 32, border: "3px solid var(--border)",
          borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px",
        }} />
        <div style={{ fontSize: 14 }}>{label}</div>
      </div>
    </div>
  );
}

function CenterMessage({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "120px 20px" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", color: "var(--text-tertiary)" }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}
