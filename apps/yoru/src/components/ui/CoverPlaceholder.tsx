import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CoverColor = "lav" | "rose" | "blue" | "plum";

export type CoverPlaceholderProps = {
  color?: CoverColor;
  /** 占位文案,默认 COVER */
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** 45° 斜纹封面占位(dc.html:553-554) */
export function CoverPlaceholder({ color = "lav", label = "COVER", className, style }: CoverPlaceholderProps) {
  return (
    <div className={cn("y-cover-ph", `y-cover-ph--${color}`, className)} style={style}>
      {label}
    </div>
  );
}
