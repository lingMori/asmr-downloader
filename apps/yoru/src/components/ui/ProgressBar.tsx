import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type ProgressBarProps = {
  /** 0–100 */
  value: number;
  /**
   * default:静态细条(hero/同步);
   * task:4px + .8s linear 宽过渡(下载任务);
   * seek:带 11px thumb(播放器,可传 onSeek)
   */
  variant?: "default" | "task" | "seek";
  onSeek?: (pct: number) => void;
  className?: string;
};

export function ProgressBar({ value, variant = "default", onSeek, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const seekable = variant === "seek" && onSeek;
  return (
    <div
      className={cn("y-progress", variant !== "default" && `y-progress--${variant}`, className)}
      role={variant === "seek" ? "slider" : "progressbar"}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ "--progress-pct": `${pct}%` } as CSSProperties}
      onClick={
        seekable
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 100 : 0;
              onSeek(Math.min(100, Math.max(0, p)));
            }
          : undefined
      }
    >
      <div className="y-progress__fill" style={{ width: `${pct}%` }} />
      {variant === "seek" && <div className="y-progress__thumb" />}
    </div>
  );
}
