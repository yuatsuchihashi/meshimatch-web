// ============================================================
// Analytics – ファネル計測の薄いプロバイダ非依存レイヤ
// ============================================================
// MVP要件(セクション7)の9イベントを初日から全部仕込むための土台。
// いまは /api/events にPOSTしてローカルに記録するだけ。将来 PostHog 等の
// 外部SaaSに差し替えるときは track() の送信先を変えるだけで済む
// (外部サービス採用は External Service Review が要るため今は入れない)。
// ブラウザ専用。fire-and-forget（失敗してもUIを止めない）。
// ============================================================

import { getAnonId } from "@/lib/anon-id";

export const AnalyticsEvent = {
  SESSION_CREATED: "session_created",
  LINK_SHARED: "link_shared",
  LINK_OPENED: "link_opened",
  FORM_STARTED: "form_started",
  FORM_COMPLETED: "form_completed",
  RESULT_VIEWED: "result_viewed",
  RESTAURANT_DECIDED: "restaurant_decided",
  VISIT_CONFIRMED: "visit_confirmed",
  PARTICIPANT_CONVERTED: "participant_converted",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

type Props = Record<string, unknown>;

/**
 * ファネルイベントを送信する。fire-and-forget。
 * anonId・時刻・パスを自動付与する。
 */
export function track(event: AnalyticsEventName, props: Props = {}): void {
  if (typeof window === "undefined") return;

  const payload = {
    event,
    props,
    anonId: getAnonId(),
    ts: new Date().toISOString(),
    path: window.location.pathname,
  };

  if (process.env.NODE_ENV !== "production") {
    // 開発時は可視化のためコンソールにも出す
    console.debug("[analytics]", event, props);
  }

  try {
    const body = JSON.stringify(payload);
    // keepalive でページ遷移中でも取りこぼさない
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 計測失敗はUIに影響させない
    });
  } catch {
    // noop
  }
}
