// ============================================================
// 匿名参加者ID – 横断的な軽量アイデンティティ
// ============================================================
// アカウントを持たない招待フロー参加者にも、端末単位で永続する
// 匿名UUIDを1つ振る。後日その人が「幹事」としてセッションを作成
// したとき、participant_converted として紐付けるための土台。
//   - localStorage に保存（永続）
//   - cookie にもミラー（サーバ側イベントに乗せられるように）
// ブラウザ専用。SSR では空文字を返す。
// ============================================================

const ANON_ID_KEY = "mm_anon_id";
const PARTICIPATED_KEY = "mm_participated";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 端末に永続する匿名IDを取得（無ければ発行）。SSR では "" を返す。 */
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = generateId();
      window.localStorage.setItem(ANON_ID_KEY, id);
    }
    // cookie にもミラー（サーバ側 /api/events で参照可能に）
    document.cookie = `${ANON_ID_KEY}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    return id;
  } catch {
    return "";
  }
}

/** この端末がゲスト参加（アンケート回答）を済ませたことを記録。 */
export function markParticipated(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PARTICIPATED_KEY, "1");
  } catch {
    // noop
  }
}

/** 過去に参加者だったか（＝participant_converted 判定に使う）。 */
export function hasParticipated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PARTICIPATED_KEY) === "1";
  } catch {
    return false;
  }
}
