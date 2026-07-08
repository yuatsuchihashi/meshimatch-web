"use client";

// ============================================================
// QrSheet – LINE 風の QR 統合シート
// タブ1「マイQR」: 自分のプロフィール共有リンクを QR 画像として共有
// タブ2「読み取る」: カメラまたは写真ファイルから QR を読む
// ============================================================

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractUserId(text: string): string | null {
  const trimmed = text.trim();
  const pathMatch = trimmed.match(/\/(?:users|u)\/([0-9a-f-]{36})/i);
  if (pathMatch) return pathMatch[1];
  const uuidMatch = trimmed.match(UUID_RE);
  if (uuidMatch) return uuidMatch[0];
  return null;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function buildQrImageFile(
  svg: SVGSVGElement,
  displayName: string,
  profileUrl: string
): Promise<File> {
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgUrl = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" })
  );

  try {
    const image = await imageFromUrl(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1f1a17";
    ctx.font = "700 34px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MeshiMatch", canvas.width / 2, 80);

    ctx.drawImage(image, 120, 132, 480, 480);

    ctx.fillStyle = "#1f1a17";
    ctx.font = "700 30px sans-serif";
    ctx.fillText(displayName, canvas.width / 2, 670);

    ctx.fillStyle = "#7a6f68";
    ctx.font = "24px sans-serif";
    ctx.fillText(profileUrl, canvas.width / 2, 722);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Could not export QR image"));
      }, "image/png");
    });

    return new File([blob], "meshimatch-qr.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
}

export function QrSheet({
  profileUrl,
  displayName,
  t,
  onClose,
}: {
  profileUrl: string;
  displayName: string;
  t: Translate;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "scan">("mine");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function requestClose() {
    setVisible(false);
    window.setTimeout(onClose, 240);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
        onClick={requestClose}
      />
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg)",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 48px",
          maxHeight: "88dvh",
          overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.34,1.1,0.64,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            {t("profile.qrCode")}
          </div>
          <button
            onClick={requestClose}
            aria-label={t("common.close")}
            style={{
              border: "none",
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "var(--bg-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: "var(--text-secondary)",
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 12,
            backgroundColor: "var(--bg-secondary)",
            marginBottom: 20,
          }}
        >
          {[
            { id: "mine" as const, label: t("profile.qrMyCode") },
            { id: "scan" as const, label: t("profile.qrScan") },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === item.id ? 700 : 500,
                backgroundColor: tab === item.id ? "var(--surface)" : "transparent",
                color: tab === item.id ? "var(--primary)" : "var(--text-secondary)",
                boxShadow: tab === item.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "mine" ? (
          <MyQrTab profileUrl={profileUrl} displayName={displayName} t={t} />
        ) : (
          <ScanTab
            t={t}
            onResult={(text) => {
              const id = extractUserId(text);
              if (id) {
                requestClose();
                window.setTimeout(() => router.push(`/users/${id}`), 120);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function MyQrTab({
  profileUrl,
  displayName,
  t,
}: {
  profileUrl: string;
  displayName: string;
  t: Translate;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShareQrImage() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || sharing) return;

    setSharing(true);
    try {
      const file = await buildQrImageFile(svg, displayName, profileUrl);
      downloadFile(file);

      const nav = navigator as ShareNavigator;
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: "MeshiMatch",
          text: t("profile.qrShareText"),
          files: [file],
        });
      } else {
        await navigator.clipboard?.writeText(profileUrl).catch(() => {});
        alert(t("profile.qrImageDownloaded"));
      }
    } catch {
      await navigator.clipboard?.writeText(profileUrl).catch(() => {});
      alert(t("profile.linkCopied"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        ref={qrRef}
        style={{
          padding: 24,
          backgroundColor: "white",
          borderRadius: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <QRCodeSVG value={profileUrl} size={180} />
      </div>
      <div style={{ textAlign: "center", maxWidth: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {t("profile.profileOf", { name: displayName })}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            wordBreak: "break-all",
          }}
        >
          {profileUrl}
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ width: "100%" }}
        onClick={handleShareQrImage}
        disabled={sharing}
      >
        {sharing ? t("common.processing") : t("profile.shareQrImage")}
      </button>
    </div>
  );
}

function ScanTab({
  t,
  onResult,
}: {
  t: Translate;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [rawHit, setRawHit] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  const handleDecoded = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (/\/(?:users|u)\/[0-9a-f-]{36}/i.test(trimmed) || UUID_RE.test(trimmed)) {
        onResult(trimmed);
      } else {
        setRawHit(trimmed);
      }
    },
    [onResult]
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("profile.qrCameraUnsupported"));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        scanLoop();
      } catch {
        if (!cancelled) setError(t("profile.qrCameraError"));
      }
    }

    function scanLoop() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (video && canvas && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const decoded = decodeCanvas(canvas);
        if (decoded) {
          stopCamera();
          handleDecoded(decoded);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    function stopCamera() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handleDecoded, t]);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoMessage(null);
    setRawHit(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await imageFromUrl(objectUrl);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas is not available");

      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const decoded = decodeCanvas(canvas);
      if (decoded) {
        setPhotoMessage(t("profile.qrPhotoDetected"));
        handleDecoded(decoded);
      } else {
        setPhotoMessage(t("profile.qrPhotoNoCode"));
      }
    } catch {
      setPhotoMessage(t("profile.qrPhotoReadError"));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: "18%",
            border: "3px solid rgba(255,255,255,0.85)",
            borderRadius: 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {error ? (
        <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
          {t("profile.qrScanHint")}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1.5px solid var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {t("profile.qrReadFromPhoto")}
      </button>

      {photoMessage && (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
          {photoMessage}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {t("profile.qrScanFallbackHint")}
        </div>
        <input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={t("profile.qrScanFallbackPlaceholder")}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1.5px solid var(--border)",
            fontSize: 15,
            color: "var(--text-primary)",
            backgroundColor: "var(--bg)",
            outline: "none",
          }}
        />
        <button
          className="btn-primary"
          disabled={!manualInput.trim()}
          onClick={() => handleDecoded(manualInput)}
        >
          {t("profile.qrOpen")}
        </button>
      </div>

      {rawHit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: 8,
              padding: "10px 12px",
              wordBreak: "break-all",
            }}
          >
            {rawHit}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              if (/^https?:\/\//i.test(rawHit)) {
                window.open(rawHit, "_blank", "noopener");
              } else {
                handleDecoded(rawHit);
              }
            }}
          >
            {t("profile.qrOpen")}
          </button>
        </div>
      )}
    </div>
  );
}
