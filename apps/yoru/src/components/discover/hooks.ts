import { useEffect, useRef, useState } from "react";

/**
 * URL 文本参数的双向绑定:本地即时回显,防抖 delay 后 commit 写 URL;
 * URL 被外部改动(chip 移除/重置/分享链接)时回同步进输入框。
 */
export function useUrlTextParam(
  value: string,
  onCommit: (v: string) => void,
  delay = 400,
): [string, (v: string) => void] {
  const [text, setText] = useState(value);
  const lastSent = useRef(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // 外部变化(URL 与最近提交不一致)→ 回同步
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const v = text.trim();
      if (v !== lastSent.current) {
        lastSent.current = v;
        commitRef.current(v);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return [text, setText];
}

/** <768px 移动形态判定(详情侧栏 ↔ 全屏浮层切换);jsdom 无 matchMedia 时按桌面处理 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => setMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
