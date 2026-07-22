/**
 * 平台检测:Wails 桌面壳加载的 URL 带 `?desktop=1`(apps/desktop/main.go),
 * 据此进入桌面模式 —— 根背景变半透明,让窗口原生玻璃(vibrancy)透出。
 *
 * 持久化到 localStorage["yoru:platform"],壳内刷新/跳转丢参数后仍保持桌面模式;
 * `?desktop=0` 显式退出(同 origin 用浏览器调试时的逃生口)。
 * 取值与 index.html 防 FOUC 内联脚本保持一致。
 */
export type Platform = "web" | "desktop";

export const PLATFORM_STORAGE_KEY = "yoru:platform";

function readPersisted(): Platform | null {
  try {
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (raw === "desktop" || raw === "web") return raw;
  } catch {
    // 隐私模式等读不到时按非持久化处理
  }
  return null;
}

export function detectPlatform(): Platform {
  try {
    const flag = new URLSearchParams(window.location.search).get("desktop");
    if (flag === "1") return "desktop";
    if (flag === "0") return "web";
  } catch {
    // location 不可读时落回持久化值
  }
  return readPersisted() ?? "web";
}

/** bootstrap 时调用:解析平台 → 持久化 → 写到 documentElement 的 data-platform */
export function initPlatform(): Platform {
  const platform = detectPlatform();
  try {
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
  } catch {
    // 写不进去时仅本次会话生效
  }
  document.documentElement.dataset.platform = platform;
  return platform;
}

export function isDesktop(): boolean {
  return document.documentElement.dataset.platform === "desktop";
}
