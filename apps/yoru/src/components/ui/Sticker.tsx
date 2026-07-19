import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StickerProps = {
  children: ReactNode;
  /** pink(默认)/ lav 两变体 */
  color?: "pink" | "lav";
  /** 旋转角(deg);默认 -2。贴纸开关关闭时由 [data-stickers="false"] 全局去旋转 */
  rotate?: number;
  /** 角标变体:卡片分区标题(如「下载队列 · きゅー」) */
  section?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Sticker({ children, color = "pink", rotate = -2, section, className, style }: StickerProps) {
  return (
    <span
      className={cn("y-sticker", color === "lav" && "y-sticker--lav", section && "y-sticker--section", className)}
      style={{ "--sticker-rot": `${rotate}deg`, ...style } as CSSProperties}
    >
      {children}
    </span>
  );
}
