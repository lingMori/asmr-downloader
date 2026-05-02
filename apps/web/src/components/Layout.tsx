import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AirTrafficControl,
  Archive,
  Broadcast,
  Database,
  GearSix,
  Gauge,
  HardDrives,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { DeckFooter } from "@/components/DeckFooter";
import { DeckStatusBar } from "@/components/DeckStatusBar";
import { useTaskEvents } from "@/lib/useTaskEvents";
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
  { to: "/discover", label: "发现雷达", code: "RADAR", icon: AirTrafficControl, hint: "REMOTE INDEX" },
  { to: "/queue", label: "任务队列", code: "QUEUE", icon: Database, hint: "JOB CONTROL" },
  { to: "/library", label: "媒体档案", code: "ARCH", icon: Archive, hint: "LOCAL MEDIA" },
  { to: "/sync", label: "同步舱", code: "SYNC", icon: Broadcast, hint: "BATCH OPS" },
  { to: "/settings", label: "系统参数", code: "SYS", icon: GearSix, hint: "CONFIG BUS" },
] satisfies Array<{
  to: NavTo;
  label: string;
  code: string;
  icon: Icon;
  hint: string;
}>;

type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "asmroner-command-theme";
const SIDEBAR_STORAGE_KEY = "asmroner-command-sidebar-collapsed";

export function Layout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNav = resolveNav(pathname);
  const ActiveNavIcon = activeNav.icon;
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => getInitialSidebarState());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    getResolvedTheme(getInitialThemeMode()),
  );
  const [packetCount, setPacketCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const showSidebarDetails = !sidebarCollapsed;

  useTaskEvents(() => {
    setPacketCount((value) => value + 1);
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextResolved = themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.dataset.themeMode = themeMode;
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      setResolvedTheme(nextResolved);
      setFlashKey((value) => value + 1);
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
    <div className="console-shell pb-9">
      <div key={flashKey} className="console-wallpaper theme-flash" />
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-3 px-3 py-3 lg:flex-row lg:px-4 lg:py-4">
        <motion.aside
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.6, 0, 0.4, 1] }}
          className={cn(
            "w-full shrink-0 transition-[width] duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]",
            sidebarCollapsed ? "lg:w-[5.75rem]" : "lg:w-[19rem]",
          )}
        >
          <div className={cn("deck-chassis flex h-full flex-col p-4", !showSidebarDetails && "lg:p-3")}>
            <div className={cn(!showSidebarDetails && "lg:text-center")}>
              <div className={cn("flex items-start justify-between gap-3", !showSidebarDetails && "lg:justify-center")}>
                <div className="min-w-0">
                  <span className="deck-decal">{showSidebarDetails ? "ASMRoner" : "ASM"}</span>
                  <h1
                    className={cn(
                      "console-title mt-3 font-black text-[color:var(--text-display)]",
                      showSidebarDetails ? "text-3xl" : "text-lg",
                    )}
                  >
                    {showSidebarDetails ? "Command Deck" : "Deck"}
                  </h1>
                </div>
                <Badge variant={resolvedTheme === "dark" ? "signal" : "warn"} className={cn(!showSidebarDetails && "lg:hidden")}>
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
                "mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1",
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
                    transition={{ delay: 0.025 * index, duration: 0.16 }}
                  >
                    <Link
                      to={item.to}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        "deck-plate group flex items-center gap-3 px-3 py-3 text-sm text-[color:var(--text-body)] transition hover:border-[color:var(--telltale-amber)] hover:text-[color:var(--text-display)]",
                        !showSidebarDetails && "lg:justify-center lg:px-0",
                      )}
                      activeProps={{
                        className:
                          "border-[color:var(--tape-pink)] text-[color:var(--text-display)] shadow-[var(--glow-tape)]",
                      }}
                    >
                      <span className="deck-screen flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--phosphor-primary)]">
                        <Icon className="h-4 w-4" weight="duotone" />
                      </span>
                      <div className={cn("min-w-0", !showSidebarDetails && "lg:hidden")}>
                        <div className="console-title text-base font-bold text-[color:var(--text-display)]">
                          {item.label}
                        </div>
                        <div className="console-mono mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
                          {item.code} / {item.hint}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className={cn("mt-auto space-y-3 pt-5", !showSidebarDetails && "lg:pt-4")}>
              <div className={cn("deck-screen p-3", !showSidebarDetails && "lg:px-2")}>
                <div className={cn("flex items-center justify-between gap-3", !showSidebarDetails && "lg:justify-center")}>
                  <span className={cn("console-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-mute)]", !showSidebarDetails && "lg:hidden")}>
                    Active Module
                  </span>
                  <span className="deck-plate flex h-9 w-9 items-center justify-center text-[color:var(--telltale-amber)]">
                    <ActiveNavIcon className="h-4 w-4" weight="duotone" />
                  </span>
                </div>
                <div className={cn("console-title mt-2 text-xl font-bold text-[color:var(--text-display)]", !showSidebarDetails && "lg:hidden")}>
                  {activeNav.label}
                </div>
                <div className={cn("console-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]", !showSidebarDetails && "lg:hidden")}>
                  {activeNav.code} / {activeNav.hint}
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        <div className="min-w-0 flex-1">
          <DeckStatusBar
            activeLabel={activeNav.label}
            activeCode={activeNav.code}
            activeHint={activeNav.hint}
            packetCount={packetCount}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
          />

          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.6, 0, 0.4, 1] }}
              className="crt-route pb-4"
            >
              <div className="mx-auto max-w-[1420px]">{children}</div>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <DeckFooter packetCount={packetCount} />
    </div>
  );
}

function SystemChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="deck-screen px-2 py-2">
      <div className="console-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
        {label}
      </div>
      <div className="console-mono mt-1 text-[10px] font-bold uppercase text-[color:var(--phosphor-primary)]">
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

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
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

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}
