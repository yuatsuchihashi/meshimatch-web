// ジャンルIDごとの絵文字マップ。
// survey フォームのタイルグリッドと vote ページのカードで共有する。
export const GENRE_EMOJI: Record<string, string> = {
  G001: "🍱", G002: "🍽️", G003: "🍝", G004: "🥟", G005: "🥩",
  G006: "🌶️", G007: "🍜", G008: "🏮", G009: "🍷", G010: "✨",
  G011: "🥞", G013: "☕", G014: "🍜", G016: "🍢", G017: "🐟",
  G018: "🍲", G019: "🥩",
};

export function genreEmoji(genreId: string): string {
  return GENRE_EMOJI[genreId] ?? "🍽️";
}
