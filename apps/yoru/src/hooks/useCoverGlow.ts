import { useEffect, useMemo, useState } from "react";
import { computeGlowColor, hashGlowColor } from "@/lib/glow";

/**
 * 封面主色(canvas 取样)→ hsl 字符串;取不到(CORS/加载失败/jsdom)回退散列色。
 * 换封面时先回退再异步取色,避免旧色残留;AmbientGlow 侧用 CSS transition 缓变。
 */
export function useCoverGlow(coverUrl?: string, seed = "yoru"): string {
  const fallback = useMemo(() => hashGlowColor(seed || coverUrl || "yoru"), [seed, coverUrl]);
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    setColor(fallback);
    if (!coverUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data;
        const extracted = computeGlowColor(pixels);
        if (!cancelled && extracted) setColor(extracted);
      } catch {
        /* tainted canvas(跨域)等 → 保持散列回退色 */
      }
    };
    img.src = coverUrl;
    return () => {
      cancelled = true;
    };
  }, [coverUrl, fallback]);

  return color;
}
