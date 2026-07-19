import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeSetting = "dark" | "light" | "system";
export type Palette = "lavender" | "blue" | "orange" | "green";
export type ResolvedTheme = "dark" | "light";

export type Settings = {
  theme: ThemeSetting;
  palette: Palette;
  stickers: boolean;
  notify: boolean;
};

/**
 * localStorage schema 与 index.html 防 FOUC 脚本一致:
 * 缺省/非法值回退 dark · lavender · stickers=true。
 */
export const SETTINGS_STORAGE_KEY = "yoru:settings";

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  palette: "lavender",
  stickers: true,
  notify: false,
};

const PALETTES: readonly Palette[] = ["lavender", "blue", "orange", "green"];

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function supportsMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

export function resolveTheme(theme: ThemeSetting): ResolvedTheme {
  if (theme === "system") {
    return supportsMatchMedia() && window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
  }
  return theme;
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    const s = parsed as Partial<Record<keyof Settings, unknown>>;
    return {
      theme:
        s.theme === "dark" || s.theme === "light" || s.theme === "system"
          ? s.theme
          : DEFAULT_SETTINGS.theme,
      palette: PALETTES.includes(s.palette as Palette)
        ? (s.palette as Palette)
        : DEFAULT_SETTINGS.palette,
      stickers: s.stickers === false ? false : DEFAULT_SETTINGS.stickers,
      notify: s.notify === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

type SettingsContextValue = {
  settings: Settings;
  /** theme=system 时解析后的实际主题 */
  resolvedTheme: ResolvedTheme;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyToDocument(settings: Settings, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.palette = settings.palette;
  root.dataset.stickers = String(settings.stickers);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(loadSettings().theme),
  );

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  // 挂载时及变更时:写 document dataset + localStorage;
  // theme=system 时监听系统主题变化重新解析。
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(settings.theme);
      setResolvedTheme(resolved);
      applyToDocument(settings, resolved);
    };
    apply();
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // 隐私模式等写不进去时静默降级,仅本次会话生效
    }
    if (settings.theme !== "system" || !supportsMatchMedia()) {
      return;
    }
    const media = window.matchMedia(LIGHT_QUERY);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, resolvedTheme, update }),
    [settings, resolvedTheme, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
}
