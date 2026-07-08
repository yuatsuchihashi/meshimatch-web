"use client";

// ============================================================
// お気に入りレストラン – 一覧 / 公開設定 / Googleマップインポート
// ============================================================
// - 一覧: 自分の user_favorite ソース + 店情報
// - 公開/非公開トグル: 公開すると全ユーザーの候補プールに入る
// - インポート: 共有リンク → プレビュー(選択) → 一括登録
//   解析失敗 (非公式エンドポイント変更) 時は Takeout 案内を表示
// ============================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";

interface FavoriteRow {
  id: string;
  visibility: "public" | "private";
  restaurants: {
    id: string;
    name: string;
    nearest_area: string | null;
    address: string | null;
  } | null;
}

interface SearchResult {
  id: string;
  name: string;
  area?: string;
  address?: string;
  photoUrl?: string;
}

interface ImportItem {
  key: string;
  name: string;
  address: string | null;
  matchedRestaurant: { id: string; name: string; area: string | null } | null;
  importableAsNew: boolean;
  nearestArea: string | null;
  selectable: boolean;
}

export default function FavoriteRestaurantsPage() {
  const { t } = useLocale();
  const { userId } = useUser();

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);

  // インポートフロー state
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ title: string; items: ImportItem[] } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [message, setMessage] = useState<string | null>(null);

  // 検索して追加フロー state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("restaurant_sources")
      .select(`
        id, visibility,
        restaurants (id, name, nearest_area, address)
      `)
      .eq("added_by", userId)
      .eq("source_type", "user_favorite");
    setFavorites(((data ?? []) as unknown as FavoriteRow[]).filter((f) => f.restaurants));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 店名検索をデバウンス (~250ms)。2文字未満は検索しない。
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/restaurants/search?q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setSearchResults((data.results as SearchResult[]) ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  async function addFavoriteById(restaurantId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("restaurant_sources").upsert(
      {
        restaurant_id: restaurantId,
        source_type: "user_favorite",
        visibility: "private",
        added_by: userId,
      },
      { onConflict: "restaurant_id,source_type,added_by" }
    );
    setSearchQuery("");
    setSearchResults([]);
    void refresh();
  }

  // 検索でヒットしない店を、入力名のまま台帳に登録してお気に入りに追加
  async function addFavoriteManual() {
    const name = searchQuery.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/restaurants/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return; // 失敗時は黙って何もしない
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        await addFavoriteById(data.id);
      }
    } catch {
      // 失敗時は黙って何もしない
    }
  }

  async function loadList() {
    setImporting(true);
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch("/api/import/gmaps-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(t("favorites.importFailed"));
        return;
      }
      setPreview({ title: json.title, items: json.items });
      setSelectedKeys(
        new Set(
          (json.items as ImportItem[]).filter((i) => i.selectable).map((i) => i.key)
        )
      );
    } catch {
      setMessage(t("favorites.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import/gmaps-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          confirm: true,
          keys: [...selectedKeys],
          visibility,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(t("favorites.importDone", { count: json.imported }));
        setPreview(null);
        setUrl("");
        void refresh();
      } else {
        setMessage(t("favorites.importFailed"));
      }
    } finally {
      setImporting(false);
    }
  }

  async function toggleVisibility(fav: FavoriteRow) {
    const supabase = createClient();
    await supabase
      .from("restaurant_sources")
      .update({ visibility: fav.visibility === "public" ? "private" : "public" })
      .eq("id", fav.id);
    void refresh();
  }

  async function removeFavorite(fav: FavoriteRow) {
    const supabase = createClient();
    await supabase.from("restaurant_sources").delete().eq("id", fav.id);
    void refresh();
  }

  const selectableItems = preview?.items.filter((i) => i.selectable) ?? [];
  const unselectableItems = preview?.items.filter((i) => !i.selectable) ?? [];

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", maxWidth: 480, margin: "0 auto" }}>
      {/* header */}
      <div style={{ padding: "56px 20px 20px" }}>
        <Link href="/profile" style={{ color: "var(--primary)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          ← {t("favorites.back")}
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 12 }}>
          {t("favorites.title")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          {t("favorites.subtitle")}
        </p>
      </div>

      <div style={{ padding: "0 20px 120px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 検索して追加カード */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t("favorites.searchAddTitle")}</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 12px" }}>
            {t("favorites.searchAddHint")}
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("favorites.searchAddPlaceholder")}
              style={{
                width: "100%", height: 44, borderRadius: 16, border: "1.5px solid var(--border-strong)",
                padding: "0 14px", fontSize: 14, background: "var(--surface)",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            {searchQuery.trim().length >= 2 && (
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 12,
                  border: "1px solid var(--border-light)",
                  backgroundColor: "var(--surface)",
                  overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                }}
              >
                {searching && searchResults.length === 0 ? (
                  <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-tertiary)" }}>
                    {t("survey.suggestSearching")}
                  </div>
                ) : (
                  <>
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => addFavoriteById(result.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "10px 12px", border: "none", borderBottom: "1px solid var(--border-light)",
                          background: "none", cursor: "pointer", textAlign: "left",
                        }}
                      >
                        {result.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={result.photoUrl}
                            alt=""
                            width={32}
                            height={32}
                            style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {result.name}
                          </div>
                          {result.area && (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                              {result.area}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                    {!searching && (
                      <button
                        type="button"
                        onClick={addFavoriteManual}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "10px 12px", border: "none", background: "none",
                          cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                            background: "rgba(240,90,40,0.1)", color: "var(--primary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, fontWeight: 800,
                          }}
                        >
                          ＋
                        </span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t("survey.suggestAddManual", { name: searchQuery.trim() })}
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* インポートカード */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t("favorites.importTitle")}</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 12px" }}>
            {t("favorites.importDesc")}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("favorites.importPlaceholder")}
              style={{
                flex: 1, height: 44, borderRadius: 16, border: "1.5px solid var(--border-strong)",
                padding: "0 14px", fontSize: 14, background: "var(--surface)",
                color: "var(--text-primary)", outline: "none", minWidth: 0,
              }}
            />
            <button
              onClick={loadList}
              disabled={importing || !url.trim()}
              style={{
                height: 44, padding: "0 16px", borderRadius: 100, border: "none",
                background: "var(--primary)", color: "white", fontSize: 13, fontWeight: 700,
                cursor: "pointer", opacity: importing || !url.trim() ? 0.4 : 1, whiteSpace: "nowrap",
              }}
            >
              {importing ? t("favorites.importLoading") : t("favorites.importButton")}
            </button>
          </div>

          {message && (
            <div style={{
              marginTop: 12, fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 12,
              background: "var(--bg-secondary)", color: "var(--text-primary)",
            }}>
              {message}
            </div>
          )}

          {/* プレビュー */}
          {preview && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                {t("favorites.importPreviewTitle", { title: preview.title, count: preview.items.length })}
              </div>

              {selectableItems.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                    {t("favorites.importSelectable")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {selectableItems.map((item) => {
                      const checked = selectedKeys.has(item.key);
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            const next = new Set(selectedKeys);
                            if (checked) next.delete(item.key);
                            else next.add(item.key);
                            setSelectedKeys(next);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                            padding: "10px 12px", borderRadius: 14, cursor: "pointer",
                            border: `1.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
                            background: checked ? "rgba(240,90,40,0.06)" : "var(--surface)",
                          }}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                            border: `2px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
                            background: checked ? "var(--primary)" : "transparent",
                            color: "white", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 13, fontWeight: 800,
                          }}>
                            {checked ? "✓" : ""}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                              {item.matchedRestaurant
                                ? `✓ ${t("favorites.matched")}: ${item.matchedRestaurant.name}`
                                : item.nearestArea ?? item.address ?? ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {unselectableItems.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 6 }}>
                    {t("favorites.importUnselectable")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                    {unselectableItems.map((item) => (
                      <div key={item.key} style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "4px 12px" }}>
                        {item.name}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 公開設定 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {(["private", "public"] as const).map((vis) => (
                  <button
                    key={vis}
                    onClick={() => setVisibility(vis)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderRadius: 14, cursor: "pointer", textAlign: "left",
                      border: `1.5px solid ${visibility === vis ? "var(--primary)" : "var(--border)"}`,
                      background: visibility === vis ? "rgba(240,90,40,0.06)" : "var(--surface)",
                      fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${visibility === vis ? "var(--primary)" : "var(--border-strong)"}`,
                      background: visibility === vis ? "var(--primary)" : "transparent",
                    }} />
                    {vis === "public" ? t("favorites.visibilityPublic") : t("favorites.visibilityPrivate")}
                  </button>
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={confirmImport}
                disabled={importing || selectedKeys.size === 0}
              >
                {t("favorites.importConfirm", { count: selectedKeys.size })}
              </button>
            </div>
          )}
        </div>

        {/* お気に入り一覧 */}
        {loading ? null : favorites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-tertiary)", fontSize: 14 }}>
            {t("favorites.empty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {favorites.map((fav) => (
              <div key={fav.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {fav.restaurants!.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {fav.restaurants!.nearest_area ?? fav.restaurants!.address ?? ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, flexShrink: 0,
                    background: fav.visibility === "public" ? "var(--success)" : "var(--bg-secondary)",
                    color: fav.visibility === "public" ? "white" : "var(--text-secondary)",
                  }}
                >
                  {fav.visibility === "public" ? t("favorites.publicBadge") : t("favorites.privateBadge")}
                </span>
                <button
                  onClick={() => toggleVisibility(fav)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none",
                    border: "none", cursor: "pointer", padding: 4, flexShrink: 0,
                  }}
                >
                  {fav.visibility === "public" ? t("favorites.makePrivate") : t("favorites.makePublic")}
                </button>
                <button
                  onClick={() => removeFavorite(fav)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: "var(--danger)", background: "none",
                    border: "none", cursor: "pointer", padding: 4, flexShrink: 0,
                  }}
                >
                  {t("favorites.remove")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
