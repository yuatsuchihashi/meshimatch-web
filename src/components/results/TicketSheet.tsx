"use client";

// ============================================================
// ごはん会チケット – 決定後に出るダウンロード/共有可能な画像
// ============================================================
// お店が決まった瞬間の「戦利品」。半券つきの横長チケットを
// canvas で描いて PNG にする。場所・日時・参加者入り。
// デザインの大胆さはここに集中させる (署名要素)。
// ============================================================

import { useEffect, useRef, useState } from "react";

export interface TicketData {
  groupName: string;
  restaurantName: string;
  area?: string | null;
  scheduledAt?: Date | null;
  memberNames: string[];
}

const W = 1200;
const H = 630;
const STUB_X = 880; // 半券の切り取り線

function drawTicket(canvas: HTMLCanvasElement, data: TicketData) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  const jp = (weight: number, size: number) =>
    `${weight} ${size}px "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif`;

  // 背景 (クリーム) + 外周角丸
  ctx.fillStyle = "#FFF5EC";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 36);
  ctx.fill();

  // 上下のオレンジ帯
  ctx.fillStyle = "#F05A28";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, 96, [36, 36, 0, 0]);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(0, H - 44, W, 44, [0, 0, 36, 36]);
  ctx.fill();

  // ヘッダー文字
  ctx.fillStyle = "#FFFFFF";
  ctx.font = jp(800, 34);
  ctx.textBaseline = "middle";
  ctx.fillText("ごはん会チケット", 48, 50);
  ctx.font = jp(600, 22);
  ctx.textAlign = "right";
  ctx.fillText("MeshiMatch", STUB_X - 40, 50);
  ctx.textAlign = "left";

  // 半券の切り取り線 (ミシン目) + 上下の切り欠き
  ctx.strokeStyle = "#E2CFC0";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(STUB_X, 20);
  ctx.lineTo(STUB_X, H - 20);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const y of [0, H]) {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(STUB_X, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 本体 ──
  const date = data.scheduledAt;
  const dateLabel = date
    ? `${date.getMonth() + 1}/${date.getDate()} (${"日月火水木金土"[date.getDay()]}) ${date.getHours() < 15 ? "昼" : "夜"}`
    : "日程はこれから";

  ctx.fillStyle = "#8A7568";
  ctx.font = jp(600, 24);
  ctx.fillText(data.groupName, 48, 156);

  // 店名 (主役)
  ctx.fillStyle = "#4A352A";
  let nameSize = 62;
  ctx.font = jp(800, nameSize);
  while (ctx.measureText(data.restaurantName).width > STUB_X - 96 && nameSize > 30) {
    nameSize -= 4;
    ctx.font = jp(800, nameSize);
  }
  ctx.fillText(data.restaurantName, 48, 222);

  // 決定スタンプ (セージの丸)
  ctx.strokeStyle = "#A8C686";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(STUB_X - 90, 190, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#7FA35C";
  ctx.font = jp(800, 26);
  ctx.textAlign = "center";
  ctx.fillText("決定", STUB_X - 90, 190);
  ctx.textAlign = "left";

  // 場所・日時
  ctx.fillStyle = "#8A7568";
  ctx.font = jp(600, 22);
  ctx.fillText("どこ", 48, 306);
  ctx.fillText("いつ", 48, 372);
  ctx.fillStyle = "#4A352A";
  ctx.font = jp(700, 30);
  ctx.fillText(data.area ? `${data.area}エリア` : "お店で集合", 130, 306);
  ctx.fillText(dateLabel, 130, 372);

  // 参加者
  ctx.fillStyle = "#8A7568";
  ctx.font = jp(600, 22);
  ctx.fillText("だれ", 48, 448);
  const names = data.memberNames.slice(0, 6);
  const extra = data.memberNames.length - names.length;
  let x = 130;
  const chipY = 448;
  ctx.font = jp(700, 24);
  for (const name of names) {
    const label = name;
    const width = ctx.measureText(label).width + 36;
    if (x + width > STUB_X - 40) break;
    ctx.fillStyle = "#FDEBDC";
    ctx.beginPath();
    ctx.roundRect(x, chipY - 24, width, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#4A352A";
    ctx.fillText(label, x + 18, chipY + 1);
    x += width + 12;
  }
  if (extra > 0) {
    ctx.fillStyle = "#8A7568";
    ctx.fillText(`+${extra}`, x + 4, chipY + 1);
  }

  // フッター文言
  ctx.fillStyle = "#FFFFFF";
  ctx.font = jp(600, 20);
  ctx.fillText("お店選びは、みんなの○×で。", 48, H - 22);

  // ── 半券 ──
  ctx.fillStyle = "#4A352A";
  ctx.font = jp(800, 30);
  ctx.save();
  ctx.translate(STUB_X + 52, 150);
  ctx.fillText(date ? `${date.getMonth() + 1}月${date.getDate()}日` : "日程未定", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#F05A28";
  ctx.font = jp(800, 96);
  ctx.textAlign = "center";
  ctx.fillText("○", STUB_X + (W - STUB_X) / 2, 330);
  ctx.font = jp(700, 22);
  ctx.fillStyle = "#8A7568";
  ctx.fillText("ADMIT", STUB_X + (W - STUB_X) / 2, 420);
  ctx.fillText(`${data.memberNames.length}名さま`, STUB_X + (W - STUB_X) / 2, 456);
  ctx.textAlign = "left";
}

export function TicketSheet({
  data,
  onClose,
}: {
  data: TicketData;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (canvasRef.current) drawTicket(canvasRef.current, data);
  }, [data]);

  async function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) =>
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/png")
    );
  }

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meshimatch-ticket-${data.restaurantName}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], "meshimatch-ticket.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ごはん会チケット" });
        setShared(true);
        return;
      } catch {
        // キャンセル時はフォールバックしない
        return;
      }
    }
    await download();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 240, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(74,53,42,0.5)" }}
        onClick={onClose}
      />
      <div
        className="animate-fade-in"
        style={{
          position: "relative",
          backgroundColor: "var(--bg)",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px calc(28px + env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
          ごはん会チケット
        </div>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 14,
            boxShadow: "0 6px 20px rgba(74,53,42,0.18)",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-primary" onClick={share} style={{ flex: 1 }}>
            {shared ? "共有した！" : "共有する"}
          </button>
          <button className="btn-secondary" onClick={download} style={{ flex: 1 }}>
            ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
}
