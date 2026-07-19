import type { CoverColor } from "@/components/ui";

const COLORS: CoverColor[] = ["lav", "rose", "blue", "plum"];

/** 由 id 稳定取封面占位色(同一作品恒同色) */
export function coverColorFor(id: string): CoverColor {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
