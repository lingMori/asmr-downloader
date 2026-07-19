import type { CSSProperties } from "react";
import type { WorkStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * 作品本地状态徽章(原型 discover 行内「已在库 ✓」描边小徽章的通用化):
 * in_library → 已在库 ✓;downloading → 下载中;queued/downloaded → 已入队;其余不渲染。
 */
export function WorkStatusBadge({ status, className, style }: { status?: WorkStatus; className?: string; style?: CSSProperties }) {
  if (!status) return null;
  let text: string | null = null;
  let active = false;
  switch (status.state) {
    case "in_library":
      text = "已在库 ✓";
      break;
    case "downloading":
      text = "下载中";
      active = true;
      break;
    case "queued":
    case "downloaded":
      text = "已入队";
      break;
    default:
      return null;
  }
  return (
    <span className={cn("y-status-badge", active && "y-status-badge--active", className)} style={style}>
      {text}
    </span>
  );
}

export type DownloadButtonProps = {
  status?: WorkStatus;
  /** 可下载状态下的点击(通常=打开 DownloadReviewDialog) */
  onDownload: () => void;
  size?: "sm";
  className?: string;
};

/**
 * 下载钮三态(原型 dc.html:217):↓ 下载 / 已入队 ✓ / 已拥有。
 * 不可下载态不响应点击、cursor:default。
 */
export function DownloadButton({ status, onDownload, size, className }: DownloadButtonProps) {
  const owned = status?.state === "in_library";
  const queued =
    status?.state === "queued" || status?.state === "downloading" || status?.state === "downloaded";
  const disabled = owned || queued;
  const label = owned ? "已拥有" : queued ? "已入队 ✓" : "↓ 下载";
  return (
    <span
      role="button"
      aria-disabled={disabled}
      className={cn("y-dl-btn", disabled && "is-disabled", size === "sm" && "y-dl-btn--sm", className)}
      onClick={disabled ? undefined : onDownload}
    >
      {label}
    </span>
  );
}
