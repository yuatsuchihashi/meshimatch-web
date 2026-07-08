"use client";

// ============================================================
// 紙吹雪 – 決定の瞬間のお祝い演出 (クラッカー破裂型)
// ============================================================
// 画面中央やや下から全方向に勢いよく弾け、弧を描いて落ちる。
// ライブラリなし・CSSアニメーションのみ。遅延ほぼゼロで発火する。
// ============================================================

import { useState } from "react";

const COLORS = ["#F05A28", "#FF8A5B", "#F3C96B", "#A8C686", "#FFFFFF"];

interface Piece {
  dx: number;        // 最終横移動 px
  up: number;        // 打ち上げ頂点 px (負=上)
  fall: number;      // 最終落下位置 px
  delay: number;     // s (ごく短く)
  duration: number;  // s
  color: string;
  width: number;
  height: number;
  spin: number;      // deg
}

export function Confetti({ count = 72 }: { count?: number }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const power = 120 + Math.random() * 320;
      return {
        dx: Math.cos(angle) * power * 1.4,
        up: -(180 + Math.random() * 380),
        fall: 320 + Math.random() * 480,
        delay: Math.random() * 0.06,
        duration: 1.1 + Math.random() * 0.9,
        color: COLORS[i % COLORS.length],
        width: 7 + Math.random() * 7,
        height: 10 + Math.random() * 9,
        spin: (Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 900),
      };
    })
  );

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 500,
      }}
    >
      {pieces.map((piece, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "52%",
            left: "50%",
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            borderRadius: 2,
            opacity: 0,
            animation: `confetti-burst ${piece.duration}s ${piece.delay}s cubic-bezier(0.16, 0.6, 0.4, 1) forwards`,
            ["--dx" as string]: `${piece.dx}px`,
            ["--up" as string]: `${piece.up}px`,
            ["--fall" as string]: `${piece.fall}px`,
            ["--spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
