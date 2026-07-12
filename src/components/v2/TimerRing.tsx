import type { CSSProperties, HTMLAttributes } from "react";
import clsx from "clsx";

export function clampTimerSeconds(seconds: number, totalSeconds: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.max(0, Math.min(seconds, totalSeconds));
}

export function getTimerRingPercent(seconds: number, totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.round((clampTimerSeconds(seconds, totalSeconds) / totalSeconds) * 100);
}

export interface TimerRingProps extends HTMLAttributes<HTMLDivElement> {
  seconds: number;
  totalSeconds?: number;
  label?: string;
}

export function TimerRing({
  seconds,
  totalSeconds = 10,
  label = "SECONDS",
  className,
  style,
  ...props
}: TimerRingProps) {
  const clampedSeconds = clampTimerSeconds(seconds, totalSeconds);
  const progress = getTimerRingPercent(seconds, totalSeconds);
  const ringStyle = {
    ...style,
    "--v2-timer-progress": `${progress}%`,
  } as CSSProperties;

  return (
    <div
      className={clsx("v2-timer-ring", clampedSeconds <= 2 && "v2-timer-ring--urgent", className)}
      style={ringStyle}
      role="timer"
      aria-label={`${clampedSeconds} seconds remaining`}
      {...props}
    >
      <div className="v2-timer-ring__inner">
        <b className="v2-timer-ring__seconds">{clampedSeconds}</b>
        <span className="v2-timer-ring__label">{label}</span>
      </div>
    </div>
  );
}
