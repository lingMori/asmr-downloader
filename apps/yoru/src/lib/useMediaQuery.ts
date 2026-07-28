import { useEffect, useState } from "react";

/**
 * 通用媒体查询 hook;jsdom 无 matchMedia 时按 false(桌面)处理。
 * 原 components/discover/hooks.ts useIsMobile 的上移通用版,行为一致。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** <768px 移动形态判定(断点约定见 components.css 双端基础) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
