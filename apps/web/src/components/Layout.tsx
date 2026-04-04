import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Books,
  CompassRose,
  Gauge,
  GearSix,
  MagicWand,
  Sparkle,
  Stack,
} from "@phosphor-icons/react";
import { Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavTo =
  | "/"
  | "/discover"
  | "/queue"
  | "/library"
  | "/sync"
  | "/settings";

const navItems = [
  { to: "/", label: "总览", icon: Gauge, accent: "from-amber-300 to-rose-300" },
  { to: "/discover", label: "发现", icon: CompassRose, accent: "from-rose-300 to-fuchsia-300" },
  { to: "/queue", label: "任务", icon: MagicWand, accent: "from-sky-300 to-violet-300" },
  { to: "/library", label: "媒体库", icon: Books, accent: "from-emerald-300 to-cyan-300" },
  { to: "/sync", label: "同步", icon: Stack, accent: "from-violet-300 to-blue-300" },
  { to: "/settings", label: "设置", icon: GearSix, accent: "from-amber-200 to-orange-300" },
] satisfies Array<{
  to: NavTo;
  label: string;
  icon: typeof Gauge;
  accent: string;
}>;

type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "sweet-whispers-theme";
const SIDEBAR_STORAGE_KEY = "sweet-whispers-sidebar-collapsed";
const themeOptions = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "系统", icon: Monitor },
] satisfies Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}>;

export function Layout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNav = resolveNav(pathname);
  const ActiveNavIcon = activeNav.icon;
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => getInitialSidebarState());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    getResolvedTheme(getInitialThemeMode()),
  );
  const showSidebarDetails = !sidebarCollapsed;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextResolved = themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.dataset.themeMode = themeMode;
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      setResolvedTheme(nextResolved);
    };

    applyTheme();

    const handleSystemThemeChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "true" : "false",
    );
  }, [sidebarCollapsed]);

  return (
    <div className="sweet-shell">
      <div className="sweet-wallpaper" />
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-3 py-3 lg:flex-row lg:px-4 lg:py-4">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "w-full shrink-0 transition-[width] duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]",
            sidebarCollapsed ? "lg:w-[6.5rem]" : "lg:w-[21rem]",
          )}
        >
          <div
            className={cn(
              "relative flex h-full flex-col overflow-hidden rounded-[2.25rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg-strong)] shadow-[var(--shadow-glass)] backdrop-blur-2xl",
              showSidebarDetails ? "p-5 lg:p-6" : "p-4 lg:px-3 lg:py-5",
            )}
          >
            <div className="pointer-events-none absolute -right-12 top-8 h-32 w-32 rounded-full bg-rose-200/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-8 left-0 h-28 w-28 rounded-full bg-sky-200/20 blur-3xl" />

            <div
              className={cn(
                "flex items-start justify-between gap-3",
                !showSidebarDetails && "lg:flex-col lg:items-center lg:justify-start",
              )}
            >
              <div
                className={cn(
                  "min-w-0",
                  !showSidebarDetails && "lg:flex lg:flex-col lg:items-center lg:text-center",
                )}
              >
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.42em] text-[color:var(--accent-rose)]">
                  <span className={cn(!showSidebarDetails && "lg:hidden")}>Sweet Whispers UI</span>
                  <span className={cn("hidden", !showSidebarDetails && "lg:inline")}>SW</span>
                </p>
                <h1
                  className={cn(
                    "sweet-title mt-3 text-3xl font-extrabold tracking-tight text-[color:var(--text-strong)]",
                    !showSidebarDetails && "lg:text-xl",
                  )}
                >
                  甜耳空间
                </h1>
                <p
                  className={cn(
                    "mt-2 text-sm leading-6 text-[color:var(--text-body)]",
                    !showSidebarDetails && "lg:hidden",
                  )}
                >
                  搜索、收集、下载与播放，全都切进更轻盈的萌系玻璃舞台。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="pink" className={cn("shrink-0", !showSidebarDetails && "lg:hidden")}>
                  Beta
                </Badge>
              </div>
            </div>

            <div className={cn("mt-5 flex flex-wrap gap-2", !showSidebarDetails && "lg:hidden")}>
              <Badge variant={resolvedTheme === "dark" ? "violet" : "gold"}>
                {resolvedTheme === "dark" ? "深夜电台" : "元气舞台"}
              </Badge>
              <Badge variant="blue">动态玻璃</Badge>
              <Badge variant="violet">轻动画</Badge>
            </div>

            <nav
              className={cn(
                "mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1",
                !showSidebarDetails && "lg:mt-8 lg:grid-cols-1 lg:gap-3",
              )}
            >
              {navItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * index, duration: 0.28 }}
                  >
                    <Link
                      to={item.to}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        "group flex items-center gap-3 rounded-[1.6rem] border border-white/40 bg-white/40 px-4 py-3 text-sm text-[color:var(--text-body)] transition hover:-translate-y-0.5 hover:border-[color:var(--interactive-border)] hover:bg-[color:var(--interactive-bg)] hover:text-[color:var(--text-strong)] hover:shadow-[var(--interactive-shadow)]",
                        !showSidebarDetails && "lg:justify-center lg:px-0 lg:py-3",
                      )}
                      activeProps={{
                        className:
                          "border-[color:var(--interactive-border)] bg-[color:var(--interactive-bg-strong)] text-[color:var(--text-strong)] shadow-[var(--interactive-shadow)]",
                      }}
                      >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_10px_22px_rgba(255,182,193,0.22)]",
                          item.accent,
                        )}
                      >
                        <Icon className="h-5 w-5" weight="duotone" />
                      </span>
                      <div className={cn("min-w-0", !showSidebarDetails && "lg:hidden")}>
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs text-[color:var(--text-muted)]">
                          {navHint(item.to)}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className={cn("mt-auto space-y-3 pt-6", !showSidebarDetails && "lg:pt-5")}>
              <div
                className={cn(
                  "rounded-[1.75rem] border border-white/45 bg-white/45 p-4",
                  !showSidebarDetails && "lg:hidden",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-200 text-lg shadow-[0_12px_26px_rgba(255,182,193,0.22)]">
                    🐱
                  </span>
                  <div>
                    <div className="sweet-title text-base font-bold text-[color:var(--text-strong)]">
                      今日氛围
                    </div>
                    <div className="text-sm text-[color:var(--text-body)]">
                      {resolvedTheme === "dark"
                        ? "切到深夜电台模式，亮色反馈会更克制。"
                        : "用更软的反馈，把工具感压低一点。"}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-[1.5rem] border border-white/35 bg-white/36 p-4",
                  !showSidebarDetails && "lg:px-3 lg:py-4",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between",
                    !showSidebarDetails && "lg:justify-center",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold text-[color:var(--text-strong)]",
                      !showSidebarDetails && "lg:hidden",
                    )}
                  >
                    当前区域
                  </span>
                  {!showSidebarDetails ? (
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_12px_24px_rgba(255,182,193,0.18)]",
                        activeNav.accent,
                      )}
                    >
                      <ActiveNavIcon className="h-5 w-5" weight="duotone" />
                    </span>
                  ) : (
                    <Sparkle className="h-4 w-4 text-[color:var(--accent-rose)]" weight="fill" />
                  )}
                </div>
                <div
                  className={cn(
                    "sweet-title mt-2 text-xl font-bold text-[color:var(--text-strong)]",
                    !showSidebarDetails && "lg:mt-3 lg:text-center lg:text-sm",
                  )}
                >
                  {activeNav.label}
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm text-[color:var(--text-body)]",
                    !showSidebarDetails && "lg:hidden",
                  )}
                >
                  {navHint(activeNav.to)}
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-3 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 shadow-[0_14px_30px_rgba(255,182,193,0.1)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="hidden h-11 w-11 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-white/58 text-[color:var(--text-strong)] transition hover:bg-white/78 lg:inline-flex"
                onClick={() => setSidebarCollapsed((value) => !value)}
                aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-300 to-sky-300 text-white shadow-[0_12px_26px_rgba(255,182,193,0.2)]">
                <Sparkle className="h-5 w-5" weight="fill" />
              </span>
              <div>
                <div className="sweet-title text-lg font-bold text-[color:var(--text-strong)]">
                  {activeNav.label}
                </div>
                <div className="text-sm text-[color:var(--text-body)]">
                  轻盈卡片、浮动反馈和更明确的内容层级
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="pink">萌系改造中</Badge>
              <Badge variant="mint">实时数据流</Badge>
              <div className="flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] bg-white/52 p-1">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = themeMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition",
                        active
                          ? "bg-[color:var(--interactive-bg-strong)] text-[color:var(--text-strong)] shadow-[var(--interactive-shadow)]"
                          : "text-[color:var(--text-body)] hover:bg-[color:var(--interactive-bg)] hover:text-[color:var(--text-strong)]",
                      )}
                      onClick={() => setThemeMode(option.value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="pb-4"
            >
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function resolveNav(pathname: string) {
  if (pathname.startsWith("/discover")) {
    return navItems[1];
  }
  if (pathname.startsWith("/queue")) {
    return navItems[2];
  }
  if (pathname.startsWith("/library")) {
    return navItems[3];
  }
  if (pathname.startsWith("/sync")) {
    return navItems[4];
  }
  if (pathname.startsWith("/settings")) {
    return navItems[5];
  }
  return navItems[0];
}

function navHint(to: NavTo) {
  switch (to) {
    case "/":
      return "个人面板与系统节奏";
    case "/discover":
      return "抽卡式封面墙与筛选";
    case "/queue":
      return "后勤任务面板";
    case "/library":
      return "作品卡册与播放器";
    case "/sync":
      return "同步编队与批量导出";
    case "/settings":
      return "后台参数与环境整理";
    default:
      return "";
  }
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}

function getResolvedTheme(themeMode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  if (themeMode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return themeMode;
}

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}
