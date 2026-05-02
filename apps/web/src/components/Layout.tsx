import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  DatabaseZap,
  Gauge,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  RadioTower,
  Settings2,
  Sun,
  TerminalSquare,
} from "lucide-react";
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
  { to: "/", label: "总览", code: "DASH", icon: Gauge, hint: "COMMAND STATUS" },
  { to: "/discover", label: "发现雷达", code: "RADAR", icon: Radar, hint: "REMOTE INDEX" },
  { to: "/queue", label: "任务队列", code: "QUEUE", icon: DatabaseZap, hint: "JOB CONTROL" },
  { to: "/library", label: "媒体档案", code: "ARCH", icon: Archive, hint: "LOCAL MEDIA" },
  { to: "/sync", label: "同步舱", code: "SYNC", icon: RadioTower, hint: "BATCH OPS" },
  { to: "/settings", label: "系统参数", code: "SYS", icon: Settings2, hint: "CONFIG BUS" },
] satisfies Array<{
  to: NavTo;
  label: string;
  code: string;
  icon: typeof Gauge;
  hint: string;
}>;

type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "asmroner-command-theme";
const LEGACY_THEME_STORAGE_KEY = "sweet-whispers-theme";
const SIDEBAR_STORAGE_KEY = "asmroner-command-sidebar-collapsed";
const LEGACY_SIDEBAR_STORAGE_KEY = "sweet-whispers-sidebar-collapsed";
const themeOptions = [
  { value: "dark", label: "CRT", icon: Moon },
  { value: "light", label: "PANEL", icon: Sun },
  { value: "system", label: "AUTO", icon: Monitor },
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
    <div className="console-shell">
      <div className="console-wallpaper" />
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-3 px-3 py-3 lg:flex-row lg:px-4 lg:py-4">
        <motion.aside
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "w-full shrink-0 transition-[width] duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]",
            sidebarCollapsed ? "lg:w-[5.75rem]" : "lg:w-[19rem]",
          )}
        >
          <div
            className={cn(
              "console-panel relative flex h-full flex-col overflow-hidden rounded-lg border border-[color:var(--panel-border-strong)] bg-[color:var(--panel-bg-strong)] shadow-[var(--shadow-glass)] backdrop-blur-xl",
              showSidebarDetails ? "p-4" : "p-3",
            )}
          >
            <div className={cn("relative z-10", !showSidebarDetails && "lg:text-center")}>
              <div className={cn("flex items-start justify-between gap-3", !showSidebarDetails && "lg:justify-center")}>
                <div className="min-w-0">
                  <p className="console-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[color:var(--accent-amber)]">
                    {showSidebarDetails ? "ASMRoner" : "ASM"}
                  </p>
                  <h1
                    className={cn(
                      "console-title mt-2 font-extrabold uppercase text-[color:var(--text-strong)]",
                      showSidebarDetails ? "text-3xl" : "text-lg",
                    )}
                  >
                    {showSidebarDetails ? "Command Deck" : "Deck"}
                  </h1>
                </div>
                <Badge variant={resolvedTheme === "dark" ? "mint" : "gold"} className={cn(!showSidebarDetails && "lg:hidden")}>
                  {resolvedTheme === "dark" ? "CRT" : "PANEL"}
                </Badge>
              </div>

              <div className={cn("mt-4 grid grid-cols-3 gap-2", !showSidebarDetails && "lg:hidden")}>
                <SystemChip label="CORE" value="ONLINE" />
                <SystemChip label="BUS" value="SSE" />
                <SystemChip label="MODE" value="LOCAL" />
              </div>
            </div>

            <nav
              className={cn(
                "relative z-10 mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1",
                !showSidebarDetails && "lg:mt-6 lg:grid-cols-1",
              )}
            >
              {navItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.035 * index, duration: 0.22 }}
                  >
                    <Link
                      to={item.to}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        "group flex items-center gap-3 rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-3 py-3 text-sm text-[color:var(--text-body)] transition hover:border-[color:var(--interactive-border)] hover:bg-[color:var(--interactive-bg-strong)] hover:text-[color:var(--text-strong)] hover:shadow-[var(--interactive-shadow)]",
                        !showSidebarDetails && "lg:justify-center lg:px-0",
                      )}
                      activeProps={{
                        className:
                          "border-[color:var(--interactive-border)] bg-[color:var(--interactive-bg-strong)] text-[color:var(--text-strong)] shadow-[var(--interactive-shadow)]",
                      }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[color:var(--panel-border)] bg-[rgba(68,190,129,0.1)] text-[color:var(--accent-green)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className={cn("min-w-0", !showSidebarDetails && "lg:hidden")}>
                        <div className="console-title text-base font-bold uppercase text-[color:var(--text-strong)]">
                          {item.label}
                        </div>
                        <div className="console-mono mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                          {item.code} / {item.hint}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className={cn("relative z-10 mt-auto space-y-3 pt-5", !showSidebarDetails && "lg:pt-4")}>
              <div
                className={cn(
                  "rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-3",
                  !showSidebarDetails && "lg:px-2",
                )}
              >
                <div className={cn("flex items-center justify-between gap-3", !showSidebarDetails && "lg:justify-center")}>
                  <span className={cn("console-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]", !showSidebarDetails && "lg:hidden")}>
                    Active Module
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-[color:var(--panel-border)] bg-[rgba(228,164,72,0.12)] text-[color:var(--accent-amber)]">
                    <ActiveNavIcon className="h-4 w-4" />
                  </span>
                </div>
                <div className={cn("console-title mt-2 text-xl font-bold uppercase text-[color:var(--text-strong)]", !showSidebarDetails && "lg:hidden")}>
                  {activeNav.label}
                </div>
                <div className={cn("console-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]", !showSidebarDetails && "lg:hidden")}>
                  {activeNav.code} / {activeNav.hint}
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-3 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2.5 shadow-[var(--shadow-glass)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="hidden h-10 w-10 items-center justify-center rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] text-[color:var(--text-strong)] transition hover:border-[color:var(--interactive-border)] hover:bg-[color:var(--interactive-bg-strong)] lg:inline-flex"
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--interactive-border)] bg-[rgba(68,190,129,0.12)] text-[color:var(--accent-green)] shadow-[var(--shadow-glow)]">
                <TerminalSquare className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="console-title truncate text-lg font-bold uppercase text-[color:var(--text-strong)]">
                  {activeNav.label}
                </div>
                <div className="console-mono truncate text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                  ASMRONER / {activeNav.code} / {activeNav.hint}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="mint">STATUS ONLINE</Badge>
              <Badge variant="blue">LOCAL API</Badge>
              <div className="flex items-center gap-1 rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-1">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = themeMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition",
                        active
                          ? "bg-[color:var(--interactive-bg-strong)] text-[color:var(--text-strong)] shadow-[var(--interactive-shadow)]"
                          : "text-[color:var(--text-body)] hover:bg-[color:var(--interactive-bg-strong)] hover:text-[color:var(--text-strong)]",
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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pb-4"
            >
              <div className="mx-auto max-w-[1420px]">{children}</div>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SystemChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-2 py-2">
      <div className="console-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="console-mono mt-1 text-[10px] font-bold uppercase text-[color:var(--accent-green)]">
        {value}
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

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored =
    window.localStorage.getItem(THEME_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "dark";
}

function getResolvedTheme(themeMode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
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

  return (
    window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY)
  ) === "true";
}
