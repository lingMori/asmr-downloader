import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AirTrafficControl,
  Archive,
  Broadcast,
  Database,
  GearSix,
  Gauge,
  Headphones,
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
  { to: "/", label: "总览", icon: Gauge, hint: "任务、同步、本地库" },
  { to: "/discover", label: "搜索", icon: AirTrafficControl, hint: "查找远端作品" },
  { to: "/queue", label: "任务", icon: Database, hint: "进度、失败、重试" },
  { to: "/library", label: "媒体库", icon: Archive, hint: "已下载作品与播放" },
  { to: "/sync", label: "同步", icon: Broadcast, hint: "刷新清单与批量下载" },
  { to: "/settings", label: "设置", icon: GearSix, hint: "账号、目录、代理" },
] satisfies Array<{
  to: NavTo;
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
      const resolved = themeMode === "system"
        ? (mediaQuery.matches ? "dark" : "light")
        : themeMode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = themeMode;
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    };

    applyTheme();
    const handleSystemThemeChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "true" : "false",
    );
  }, [sidebarCollapsed]);

  return (
    <div className="console-shell">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[140] border border-[color:var(--accent)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm font-semibold text-[color:var(--text-display)] focus:not-sr-only"
      >
        跳到主要内容
      </a>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1680px] gap-3 px-3 py-3 lg:px-4 lg:py-4">
        <aside
          className="app-sidebar hidden transition-[width] duration-200 lg:block"
          data-collapsed={sidebarCollapsed ? "true" : undefined}
        >
          <div className="deck-chassis sticky top-4 flex h-[calc(100dvh-2rem)] flex-col p-2">
            <div className={cn("flex min-h-16 items-center gap-3 px-2", !showSidebarDetails && "justify-center px-0")}>
              <Headphones className="h-6 w-6 shrink-0 text-[color:var(--accent)]" weight="duotone" />
              {showSidebarDetails ? (
                <div className="min-w-0">
                  <div className="console-title truncate text-xl font-bold text-[color:var(--text-display)]">
                    ASMRoner
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[color:var(--text-mute)]">
                    YORU 夜间工作台
                  </div>
                </div>
              ) : null}
            </div>

            <nav className="mt-2 grid gap-1" aria-label="主导航">
              {navItems.map((item) => (
                <PrimaryNavLink
                  key={item.to}
                  item={item}
                  active={activeNav.to === item.to}
                  showDetails={showSidebarDetails}
                />
              ))}
            </nav>

            {showSidebarDetails ? (
              <div className="mt-auto border-t border-[color:var(--border)] px-2 py-3 text-xs leading-5 text-[color:var(--text-mute)]">
                本地运行。媒体与任务数据保留在当前服务中。
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <nav className="mobile-primary-nav lg:hidden" aria-label="主导航">
            {navItems.map((item) => (
              <PrimaryNavLink
                key={item.to}
                item={item}
                active={activeNav.to === item.to}
                showDetails
                compact
              />
            ))}
          </nav>

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
            <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[color:var(--telltale-red)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--text-body)]">
              <span>本地 API 无法连接。搜索、同步和任务操作暂不可用。</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => void healthQuery.refetch()}>
                  重新连接
                </Button>
                <Link to="/settings" className="deck-button-secondary inline-flex min-h-9 items-center border px-3 text-xs font-semibold">
                  检查设置
                </Link>
              </div>
            </div>
          ) : null}

          <main id="main-content" tabIndex={-1} className="crt-route">
            <div className="mx-auto max-w-[1420px]">{children}</div>
          </main>
        </div>
      </div>

      <DeckDialog
        open={taskPanelOpen}
        onOpenChange={setTaskPanelOpen}
        kicker="任务"
        title="进行中的任务"
        description="所有排队和执行中的后台任务。"
        tone={activeTasks.length > 0 ? "signal" : "mute"}
        footer={
          <Link
            to="/queue"
            onClick={() => setTaskPanelOpen(false)}
            className="deck-button-secondary inline-flex min-h-10 items-center border px-4 text-xs font-semibold"
          >
            打开任务中心
          </Link>
        }
      >
        <div className="divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border)]">
          {activeTasks.map((task) => (
            <Link
              key={task.id}
              to="/queue"
              onClick={() => setTaskPanelOpen(false)}
              className="grid gap-2 py-3 transition-colors hover:bg-[color:var(--interactive-bg)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-2"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-[color:var(--text-display)]">{task.name}</div>
                <div className="mt-1 flex min-w-0 gap-2 text-xs text-[color:var(--text-mute)]">
                  <span className="console-mono shrink-0">#{task.id}</span>
                  <span className="truncate">{task.message || "等待后台更新"}</span>
                </div>
              </div>
              <Badge variant={task.status === "RUNNING" ? "live" : "warn"}>
                {task.status === "RUNNING" ? "执行中" : "排队中"}
              </Badge>
            </Link>
          ))}
          {activeTasks.length === 0 ? (
            <div className="py-8 text-sm text-[color:var(--text-body)]">
              当前没有排队或执行中的任务。
            </div>
          ) : null}
        </div>
      </DeckDialog>
    </div>
  );
}

function PrimaryNavLink({
  item,
  active,
  showDetails,
  compact = false,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  showDetails: boolean;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className="primary-nav-link"
      data-active={active ? "true" : undefined}
    >
      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" weight={active ? "fill" : "regular"} />
      {showDetails ? (
        <div className={cn("min-w-0", compact && "text-center")}>
          <div className="whitespace-nowrap text-sm font-semibold leading-tight">{item.label}</div>
          {!compact ? (
            <div className="mt-0.5 truncate text-xs text-[color:var(--text-mute)]">{item.hint}</div>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function resolveNav(pathname: string) {
  if (pathname.startsWith("/discover")) return navItems[1];
  if (pathname.startsWith("/queue")) return navItems[2];
  if (pathname.startsWith("/library")) return navItems[3];
  if (pathname.startsWith("/sync")) return navItems[4];
  if (pathname.startsWith("/settings")) return navItems[5];
  return navItems[0];
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

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}
