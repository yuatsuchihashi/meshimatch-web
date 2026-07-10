// ============================================================
// survey フォームの「今日の気分」気分ワード。
// 各気分を共通ジャンルコード群にマッピングする。
// groups/[id]/survey と invite/[id]/survey で共有。
// ============================================================

export const MOODS = [
  { id: "kotteri", label: "こってり", genres: ["G005", "G019", "G014"] },
  { id: "sappari", label: "さっぱり", genres: ["G017", "G001"] },
  { id: "meat", label: "肉", genres: ["G005", "G019", "G016"] },
  { id: "fish", label: "魚", genres: ["G017"] },
  { id: "noodles", label: "麺", genres: ["G014"] },
  { id: "asian", label: "アジア系", genres: ["G004", "G006", "G007"] },
  { id: "izakaya", label: "居酒屋系", genres: ["G008", "G009"] },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

// 選ばれた気分 id 群を genre_preferences 形式に展開する。
// prefer が avoid より優先: 両方に出るジャンルは avoid から落とす。
export function buildGenrePreferencesFromMoods(
  preferMoodIds: string[],
  avoidMoodIds: string[]
): { genreId: string; priority: "prefer" | "avoid" }[] {
  const preferGenres = new Set<string>();
  for (const moodId of preferMoodIds) {
    const mood = MOODS.find((m) => m.id === moodId);
    if (mood) {
      for (const g of mood.genres) preferGenres.add(g);
    }
  }

  const avoidGenres = new Set<string>();
  for (const moodId of avoidMoodIds) {
    const mood = MOODS.find((m) => m.id === moodId);
    if (mood) {
      for (const g of mood.genres) avoidGenres.add(g);
    }
  }

  // prefer が勝つ: prefer 側にあるジャンルは avoid から除外
  for (const g of preferGenres) avoidGenres.delete(g);

  return [
    ...[...preferGenres].map((genreId) => ({
      genreId,
      priority: "prefer" as const,
    })),
    ...[...avoidGenres].map((genreId) => ({
      genreId,
      priority: "avoid" as const,
    })),
  ];
}
