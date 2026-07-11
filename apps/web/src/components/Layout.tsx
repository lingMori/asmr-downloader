import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AirTrafficControl,
  Archive,
  Broadcast,
  Database,
  GearSix,
  Gauge,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { DeckStatusBar } from "@/components/DeckStatusBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeckDialog } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavTo =
  | "/"
  | "/discover"
  | "/queue"
  | "/library"
  | "/sync"
  | "/settings";

const navItems = [
  { to: "/", code: "DASH", label: "总览", icon: Gauge, hint: "任务、同步、本地库" },
  { to: "/discover", code: "RADAR", label: "搜索", icon: AirTrafficControl, hint: "查找远端作品" },
  { to: "/queue", code: "QUEUE", label: "任务", icon: Database, hint: "进度、失败、重试" },
  { to: "/library", code: "ARCH", label: "媒体库", icon: Archive, hint: "已下载作品与播放" },
  { to: "/sync", code: "SYNC", label: "同步", icon: Broadcast, hint: "刷新清单与批量下载" },
  { to: "/settings", code: "SYS", label: "设置", icon: GearSix, hint: "账号、目录、代理" },
] satisfies Array<{
  to: NavTo;
  code: string;
  label: string;
  icon: Icon;
  hint: string;
}>;

type ThemeMode = "light" | "dark" | "system";
type ServiceState = "online" | "checking" | "offline";

const THEME_STORAGE_KEY = "asmroner-command-theme";
const SIDEBAR_STORAGE_KEY = "asmroner-command-sidebar-collapsed";

export function Layout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNav = resolveNav(pathname);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => getInitialSidebarState());
  const [flashKey, setFlashKey] = useState(0);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const showSidebarDetails = !sidebarCollapsed;
  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000,
    retry: 1,
  });
  const serviceState: ServiceState = healthQuery.isError
    ? "offline"
    : healthQuery.data
      ? "online"
      : "checking";
  const activeTasksQuery = useQuery({
    queryKey: ["tasks", "global-active"],
    queryFn: () => apiClient.getTasks({ status: ["QUEUED", "RUNNING"], pageSize: 50 }),
    refetchInterval: 15000,
  });
  const activeTasks = activeTasksQuery.data?.items ?? [];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextResolved = themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.dataset.themeMode = themeMode;
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
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
    <div className="console-shell">
      <div key={flashKey} className="console-wallpaper theme-flash" />
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-3 px-3 py-3 lg:flex-row lg:px-4 lg:py-4">
        <motion.aside
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.6, 0, 0.4, 1] }}
          className={cn(
            "w-full shrink-0 transition-[width] duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]",
            sidebarCollapsed ? "lg:w-[4.75rem]" : "lg:w-[16.25rem]",
          )}
        >
          <div
            className={cn("deck-chassis flex h-full flex-col gap-3 p-2.5 lg:p-3", !showSidebarDetails && "lg:p-2.5")}
            data-live={serviceState === "online" ? "soft" : undefined}
          >
            <div className={cn(!showSidebarDetails && "lg:text-center")}>
              <div className={cn("flex items-start gap-2", !showSidebarDetails && "lg:justify-center")}>
                <span className="deck-decal">{showSidebarDetails ? "ASMRoner" : "A"}</span>
                <div className={cn("min-w-0", !showSidebarDetails && "lg:hidden")}>
                  <div className="console-title text-lg font-black leading-none text-[color:var(--text-display)]">
                    Command Deck
                  </div>
                  <div className="mt-1 truncate text-xs text-[color:var(--text-mute)]">
                    本地下载控制台
                  </div>
                </div>
              </div>
            </div>

            <nav
              className={cn(
                "grid grid-cols-3 gap-2 lg:grid-cols-1",
                !showSidebarDetails && "lg:grid-cols-1",
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
                        "deck-plate group flex min-h-[3.15rem] items-center gap-2 px-2 py-2 text-sm text-[color:var(--text-body)] transition hover:border-[color:var(--telltale-amber)] hover:text-[color:var(--text-display)] lg:min-h-[3.1rem] lg:gap-2.5",
                        !showSidebarDetails && "lg:justify-center lg:px-0",
                      )}
                      activeProps={{
                        className:
                          "border-[color:var(--tape-pink)] text-[color:var(--text-display)] shadow-[var(--glow-tape)]",
                      }}
                    >
                      <span className="deck-screen flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--phosphor-primary)]">
                        <Icon className="h-4 w-4" weight="duotone" />
                      </span>
                      <div className={cn("min-w-0", !showSidebarDetails && "lg:hidden")}>
                        <div className="flex items-center gap-2">
                          <span className="console-mono hidden text-[10px] font-bold text-[color:var(--tape-pink)] sm:inline">
                            {item.code}
                          </span>
                          <span className="whitespace-nowrap text-sm font-semibold leading-tight text-[color:var(--text-display)]">
                            {item.label}
                          </span>
                        </div>
                        <div className="mt-0.5 hidden text-xs text-[color:var(--text-mute)] sm:block">
                          {item.hint}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

          </div>
        </motion.aside>

        <div className="min-w-0 flex-1">
          <DeckStatusBar
            activeLabel={activeNav.label}
            activeHint={activeNav.hint}
            serviceState={serviceState}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
            activeTaskCount={activeTasks.length}
            onOpenTasks={() => setTaskPanelOpen(true)}
          />

          {serviceState === "offline" ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-[color:var(--telltale-red)] bg-[color:var(--screen-void)] px-4 py-3 text-sm text-[color:var(--text-body)]">
              <span>本地 API 无法连接。搜索、同步和任务操作暂不可用。</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => void healthQuery.refetch()}>重新连接</Button>
                <Link to="/settings" className="deck-button-secondary inline-flex min-h-9 items-center border px-3 text-xs font-bold">检查设置</Link>
              </div>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.6, 0, 0.4, 1] }}
              className="crt-route pb-8 md:pb-10"
            >
              <div className="mx-auto max-w-[1420px]">{children}</div>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <DeckDialog
        open={taskPanelOpen}
        onOpenChange={setTaskPanelOpen}
        kicker="Task Activity"
        title="进行中的任务"
        description="这里汇总所有排队和执行中的后台任务。"
        tone={activeTasks.length > 0 ? "signal" : "mute"}
        footer={<Link to="/queue" onClick={() => setTaskPanelOpen(false)} className="deck-button-secondary inline-flex min-h-10 items-center border px-4 text-xs font-bold">打开任务中心</Link>}
      >
        <div className="space-y-3">
          {activeTasks.map((task) => (
            <Link
              key={task.id}
              to="/queue"
              onClick={() => setTaskPanelOpen(false)}
              className="deck-plate block p-4 transition hover:border-[color:var(--telltale-amber)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[color:var(--text-display)]">{task.name}</div>
                  <div className="mt-1 text-xs text-[color:var(--text-mute)]">#{task.id} · {task.message || "等待后台更新"}</div>
                </div>
                <Badge variant={task.status === "RUNNING" ? "live" : "warn"}>{task.status === "RUNNING" ? "执行中" : "排队中"}</Badge>
              </div>
            </Link>
          ))}
          {activeTasks.length === 0 ? <div className="deck-screen p-5 text-sm text-[color:var(--text-body)]">当前没有排队或执行中的任务。</div> : null}
        </div>
      </DeckDialog>
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

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}
